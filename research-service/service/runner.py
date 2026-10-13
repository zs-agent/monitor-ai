"""调用上游 multi_agents（LangGraph）并把协作事件流式回传，同时把每次运行落盘。

上游要求 websocket 与 stream_output 同时存在才会推送日志（见 multi_agents/agents/*.py），
所以这里给一个最小替身 _StreamWebSocket，把事件统一进 EventBus：
- CLI（run_task.py）直接打印；
- HTTP 服务（app.py）转成 SSE 给前端；
- 结束后 save_run() 写 runs/<task_id>.json，作为报告库的持久化来源（重启不丢）。
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

SERVICE_ROOT = Path(__file__).resolve().parents[1]
VENDOR_ROOT = SERVICE_ROOT / "gpt-researcher"
RUNS_DIR = SERVICE_ROOT / "runs"

if not (VENDOR_ROOT / "multi_agents").is_dir():
    raise RuntimeError(f"未找到上游仓库 {VENDOR_ROOT}，先运行 setup.ps1")

# 上游以仓库根为工作目录（多智能体入口 main.py 也是这么做的）
sys.path.insert(0, str(VENDOR_ROOT))
load_dotenv(SERVICE_ROOT / ".env")

from gpt_researcher.utils.enum import Tone  # noqa: E402
from multi_agents.agents import ChiefEditorAgent  # noqa: E402

from .postprocess import normalize_report_labels  # noqa: E402


def default_model() -> str:
    """task['model'] 取自 STRATEGIC_LLM 的模型名，与上游 main.py 的 open_task() 一致。"""
    strategic = os.environ.get("STRATEGIC_LLM", "").strip()
    if ":" in strategic:
        return strategic.split(":", 1)[1]
    return strategic or "deepseek-chat"


class EventBus:
    """协作事件：留档 + 广播给订阅者。"""

    def __init__(self, keep: int = 5000):
        self.events: list[dict] = []
        self._keep = keep
        self._subscribers: set[asyncio.Queue] = set()

    def publish(self, event: dict) -> None:
        event.setdefault("ts", time.time())
        self.events.append(event)
        if len(self.events) > self._keep:
            del self.events[: len(self.events) - self._keep]
        for q in list(self._subscribers):
            q.put_nowait(event)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)


class _StreamWebSocket:
    """websocket 替身：上游核心（GPTResearcher）与多智能体都会往里推事件。"""

    def __init__(self, bus: EventBus):
        self.bus = bus

    async def send_json(self, payload: dict) -> None:
        if not isinstance(payload, dict):
            payload = {"output": str(payload)}
        self.bus.publish(
            {
                "type": payload.get("type", "ws"),
                "event": payload.get("content", ""),
                "output": payload.get("output", ""),
            }
        )


def _make_stream_output(bus: EventBus):
    async def stream_output(msg_type: str, content: str, output: str, websocket=None):
        bus.publish({"type": msg_type, "event": content, "output": output})

    return stream_output


async def run_task(task: dict, *, bus: EventBus | None = None, tone: Tone = Tone.Analytical) -> dict:
    """跑一次多智能体研究，返回 {report, output_dir, elapsed_sec, ...}。"""
    bus = bus or EventBus()
    chief = ChiefEditorAgent(
        task,
        websocket=_StreamWebSocket(bus),
        stream_output=_make_stream_output(bus),
        tone=tone,
    )
    bus.publish(
        {
            "type": "run",
            "event": "started",
            "output": f"task_id={chief.task_id} workspace={chief.output_dir} model={task.get('model')}",
        }
    )
    started = time.time()
    state = await chief.run_research_task(task_id=chief.task_id)
    elapsed = time.time() - started

    state = state if isinstance(state, dict) else {}
    result = {
        "task_id": chief.task_id,
        "query": task.get("query"),
        "output_dir": str(chief.output_dir),
        "report": state.get("report"),
        "diagrams": state.get("diagrams"),
        "sections": state.get("sections"),
        "elapsed_sec": round(elapsed, 1),
        "events": len(bus.events),
    }
    bus.publish({"type": "run", "event": "finished", "output": f"{elapsed:.1f}s, {len(bus.events)} events"})
    return result


# ---------------------------------------------------------------- 报告库持久化


def save_run(
    task: dict,
    result: dict,
    events: list[dict],
    *,
    status: str = "done",
    error: str | None = None,
    created_at: float | None = None,
) -> Path | None:
    """把一次运行写成 runs/<task_id>.json（报告库的唯一持久化来源）。"""
    task_id = result.get("task_id")
    if not task_id:
        return None
    RUNS_DIR.mkdir(exist_ok=True)
    payload = {
        "task_id": task_id,
        "focus": task.get("focus"),
        "query": task.get("query"),
        "model": task.get("model"),
        "guidelines": task.get("guidelines"),
        "signals_used": task.get("signals_used", []),
        "signals_detail": task.get("signals_detail", []),
        "research_policy": task.get("research_policy"),
        "parent_task_id": (task.get("research_policy") or {}).get("parent_task_id"),
        "status": status,
        "error": error,
        "elapsed_sec": result.get("elapsed_sec"),
        "output_dir": result.get("output_dir"),
        "report": result.get("report"),
        "diagrams": result.get("diagrams") or [],
        "events": events,
        "created_at": created_at or time.time(),
        "finished_at": time.time(),
    }
    path = RUNS_DIR / f"{task_id}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    # 给人读的 Markdown 用展示层规范化后的标题（JSON 里保留上游原文，便于追溯）
    if result.get("report"):
        (RUNS_DIR / f"{task_id}.md").write_text(normalize_report_labels(result["report"]) or "", encoding="utf-8")
    return path


def load_history(limit: int = 40) -> list[dict]:
    """读取历史运行摘要（按时间倒序），不含报告正文与事件明细。"""
    if not RUNS_DIR.is_dir():
        return []
    items: list[dict] = []
    for path in RUNS_DIR.glob("*.json"):
        # 只认 <task_id>.json 这种运行记录；派生产物（如 intel）不允许混进来
        if not path.stem.isdigit():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue  # 半截文件（正在写）直接跳过
        items.append(
            {
                "task_id": data.get("task_id"),
                "focus": data.get("focus"),
                "status": data.get("status"),
                "model": data.get("model"),
                "elapsed_sec": data.get("elapsed_sec"),
                "created_at": data.get("created_at"),
                "report_chars": len(data.get("report") or ""),
                "events": len(data.get("events") or []),
                "error": data.get("error"),
            }
        )
    items.sort(key=lambda i: i.get("created_at") or 0, reverse=True)
    return items[:limit]


def load_run(task_id: str) -> dict | None:
    normalized = str(task_id).strip()
    if not normalized.isdigit():
        return None  # 只接受数字 task_id，避免路径穿越
    path = RUNS_DIR / f"{normalized}.json"
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
