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
RUNS_DIR = Path(os.environ.get('RESEARCH_RUNS_DIR') or SERVICE_ROOT / "runs")

if not (VENDOR_ROOT / "multi_agents").is_dir():
    raise RuntimeError(f"未找到上游仓库 {VENDOR_ROOT}，先运行 setup.ps1")

# 上游以仓库根为工作目录（多智能体入口 main.py 也是这么做的）
sys.path.insert(0, str(VENDOR_ROOT))
load_dotenv(SERVICE_ROOT / ".env")

from gpt_researcher.utils.enum import Tone  # noqa: E402
from multi_agents.agents import ChiefEditorAgent  # noqa: E402

from .postprocess import normalize_report_labels  # noqa: E402
from .contracts import RunStatus


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
        event = dict(event)
        event.setdefault("ts", time.time())
        event.setdefault("sequence", (self.events[-1].get("sequence", 0) if self.events else 0) + 1)
        if event.get('event') == 'shared_state':
            # Keep one full-state projection for replay; action logs already
            # preserve transitions. Do not retain O(actions * source text).
            self.events[:] = [past for past in self.events if past.get('event') != 'shared_state']
        self.events.append(event)
        if len(self.events) > self._keep:
            del self.events[: len(self.events) - self._keep]
        for q in list(self._subscribers):
            if q.full():
                q.get_nowait()
            q.put_nowait(event)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=min(self._keep, 128))
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
        "task_id": task.get("structured_task_id") or str(chief.task_id),
        "upstream_task_id": str(chief.task_id),
        "query": task.get("query"),
        "output_dir": str(chief.output_dir),
        "report": state.get("report"),
        "diagrams": state.get("diagrams"),
        "sections": state.get("sections"),
        "elapsed_sec": round(elapsed, 1),
        "events": len(bus.events),
    }
    # HTTP orchestrator publishes terminal event after saving the result.
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
    status = RunStatus('failed' if status == 'error' else status).value
    folder = RUNS_DIR / 'demos' if task.get('storage_group') == 'demos' else RUNS_DIR
    folder.mkdir(exist_ok=True, parents=True)
    event_log = list(events)
    if status != "running" and not any(e.get("event") in ("finished", "failed", "cancelled") for e in event_log):
        event_log.append(dict(type="run", event="cancelled" if status == "cancelled" else "failed" if status in ("error", 'failed') else "finished",
                              output=error or status, ts=time.time(), sequence=(event_log[-1].get("sequence", 0) if event_log else 0) + 1))
    payload = {
        "task_id": task_id,
        "focus": task.get("focus"),
        "query": task.get("query"),
        "model": task.get("model"),
        "guidelines": task.get("guidelines"),
        "signals_used": task.get("signals_used", []),
        "signals_detail": task.get("signals_detail", []),
        "research_policy": task.get("research_policy"),
        "engine": task.get("engine", "legacy"),
        "data_mode": task.get('data_mode', 'live'),
        "structured_state": result.get("structured_state") or task.get("structured_state"),
        "execution_status": result.get("execution_status"),
        "parent_task_id": (task.get("research_policy") or {}).get("parent_task_id"),
        "status": 'failed' if status == 'error' else status,
        "error": error,
        "elapsed_sec": result.get("elapsed_sec"),
        "output_dir": result.get("output_dir"),
        "report": result.get("report") if status in ('done', 'partial') else None,
        "diagrams": result.get("diagrams") or [],
        "events": event_log,
        "created_at": created_at or time.time(),
        "finished_at": time.time(),
    }
    if not str(task_id).isdigit():
        raise ValueError("task_id must contain only digits")
    path = folder / f"{task_id}.json"
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    # 给人读的 Markdown 用展示层规范化后的标题（JSON 里保留上游原文，便于追溯）
    if payload.get("report"):
        markdown = result["report"] if task.get("engine") == "structured" else normalize_report_labels(result["report"])
        (folder / f"{task_id}.md").write_text(markdown or "", encoding="utf-8")
    state = payload.get("structured_state") or {}
    if state.get("experiment"):
        folder = folder / "experiments"
        folder.mkdir(exist_ok=True)
        log = dict(state["experiment"], task_id=str(task_id), status=status, parent_task_id=payload["parent_task_id"], actions=state.get("actions", []), allocation=state.get("allocation"), delta=state.get("delta"), affected=state.get("affected"))
        temp = folder / f"{task_id}.json.tmp"
        temp.write_text(json.dumps(log, ensure_ascii=False), encoding="utf-8")
        os.replace(temp, folder / f"{task_id}.json")
    # Commit the primary record only after all ancillary writes succeeded.
    # A failed save must not leave a completed report in the normal library.
    os.replace(temporary, path)
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
        if not isinstance(data, dict):
            continue
        if data.get('status') == 'error':
            data['status'] = 'failed'
        if data.get('status') == 'failed' and data.get('error') == '所有已执行研究动作均失败；请查看异常及消耗记录':
            from .errors import failure_summary
            data['error'] = failure_summary(data.get('structured_state') or {})
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
        path = RUNS_DIR / 'demos' / f'{normalized}.json'
    if not path.is_file():
        return None
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(record, dict):
            return None
        if record.get('status') == 'error': record['status'] = 'failed'
        if record.get('status') == 'failed' and record.get('error') == '所有已执行研究动作均失败；请查看异常及消耗记录':
            from .errors import failure_summary
            record['error'] = failure_summary(record.get('structured_state') or {})
        return record
    except (json.JSONDecodeError, OSError):
        return None


def update_record(task_id, record):
    if not str(task_id).isdigit():
        raise ValueError('invalid task id')
    path = RUNS_DIR / f'{task_id}.json'
    if not path.is_file(): path = RUNS_DIR / 'demos' / f'{task_id}.json'
    if not path.is_file(): raise FileNotFoundError('run not found')
    temporary = path.with_suffix('.review.tmp')
    temporary.write_text(json.dumps(record, ensure_ascii=False), encoding='utf-8')
    os.replace(temporary, path)
