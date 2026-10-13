"""research-service HTTP 接口：monitor-ai 的 BFF 通过它发起研究并消费协作事件（SSE）。

启动：.venv/Scripts/python.exe -m uvicorn service.app:app --host 127.0.0.1 --port 8000

路由顺序注意：/research/history* 必须声明在 /research/{run_id} 之前，否则会被后者吞掉。
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import signals as sig
from .evolution import prepare_research
from .postprocess import normalize_report_labels
from .roles import run_intelligence_roles
from .runner import RUNS_DIR, EventBus, default_model, load_history, load_run, run_task, save_run

SERVICE_ROOT = Path(__file__).resolve().parents[1]
# 派生产物（情报岗位作业等）单独放子目录：运行记录用 runs/*.json 通配加载，
# 混在一起会把同一 task_id 读成两条记录（曾导致前端 React key 重复）。
INTEL_DIR = SERVICE_ROOT / "runs" / "intel"

app = FastAPI(title="monitor-ai research service", version="0.2.0")


class _ForeignProbeFilter(logging.Filter):
    """滤掉外部 OpenAI 兼容客户端对 /v1/models 的持续探测（本服务不提供该路径，恒 404）。

    已确认这不是本仓库的配置：环境变量与代码里都没有指向 127.0.0.1:8000 的 LLM 端点，
    是机器上某个外部工具把 8000 当成了 OpenAI 端点。响应行为不变（仍然 404），
    只是不让它把访问日志淹掉——日志要留给真实请求。
    """

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        return not ("/v1/models" in message and " 404" in message)


logging.getLogger("uvicorn.access").addFilter(_ForeignProbeFilter())
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3100", "http://127.0.0.1:3100"],
    allow_methods=["*"],
    allow_headers=["*"],
)

RUNS: dict[str, dict] = {}


class ResearchRequest(BaseModel):
    parent_task_id: str | None = Field(default=None, pattern=r"^[0-9]+$")
    policy_mode: Literal["adaptive", "fixed"] = "adaptive"
    focus: str = "AI 领域近期技术动向"
    query: str | None = None
    categories: list[str] | None = None
    top: int = Field(default=10, ge=1, le=50)
    max_sections: int = Field(default=3, ge=1, le=8)
    total_words: int = Field(default=1500, ge=300, le=6000)


def _build_task(req: ResearchRequest) -> tuple[dict, list[dict]]:
    model = default_model()
    if req.query:
        return (
            sig.build_task_from_query(req.query, model=model, max_sections=req.max_sections, total_words=req.total_words),
            [],
        )
    all_signals, _ = sig.load_signals()
    chosen = sig.select_signals(all_signals, categories=req.categories, top=req.top)
    task = sig.build_task_from_signals(
        chosen, focus=req.focus, model=model, max_sections=req.max_sections, total_words=req.total_words
    )
    return task, chosen


@app.get("/health")
async def health():
    pin = SERVICE_ROOT / "pinned-commit.txt"
    return {
        "ok": True,
        "upstream_commit": pin.read_text().strip() if pin.exists() else None,
        "model": default_model(),
        "retriever": os.environ.get("RETRIEVER", ""),
        "llm_key_present": bool(os.environ.get("DEEPSEEK_API_KEY") or os.environ.get("OPENAI_API_KEY")),
        "signals_snapshot": str(sig.DEFAULT_SNAPSHOT),
        "snapshot_exists": sig.DEFAULT_SNAPSHOT.exists(),
        "active_runs": [rid for rid, r in RUNS.items() if r["status"] == "running"],
    }


# ---------------------------------------------------------------- 报告库（须在 /research/{run_id} 之前）


@app.get("/research/history")
async def research_history(limit: int = 40):
    items = load_history(limit)
    # 运行中的任务也要出现在列表顶部，否则用户看不到自己刚发起的任务
    live = [
        {
            "task_id": r.get("task_id"),
            "focus": r["task"].get("focus"),
            "status": r["status"],
            "model": r["task"].get("model"),
            "elapsed_sec": None,
            "created_at": r.get("created_at"),
            "report_chars": 0,
            "events": len(r["bus"].events),
            "error": r.get("error"),
            "run_id": rid,
        }
        for rid, r in RUNS.items()
        if r["status"] == "running"
    ]
    persisted = {str(i.get("task_id")) for i in items}
    return {"items": live + [i for i in items if str(i.get("task_id")) not in {str(x.get("task_id")) for x in live}], "persisted": len(items), "live_run_ids": [x["run_id"] for x in live], "persisted_ids": sorted(persisted)}


@app.get("/research/history/{task_id}")
async def research_history_item(task_id: str):
    record = load_run(task_id)
    if not record:
        raise HTTPException(status_code=404, detail="run not found")
    # 上游 writer 会把 guidelines 塞进固定槽位的标题里，展示层统一还原
    record["report"] = normalize_report_labels(record.get("report"))
    return record


# ---------------------------------------------------------------- 运行


def _prepare_task(req: ResearchRequest):
    task, chosen = _build_task(req)
    parent = load_run(req.parent_task_id) if req.parent_task_id else None
    if req.parent_task_id and parent is None:
        raise HTTPException(status_code=404, detail="parent report not found")
    try:
        return prepare_research(task, chosen, parent, req.policy_mode), chosen
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/research/preview")
async def preview_research(req: ResearchRequest):
    task, chosen = _prepare_task(req)
    return {"query_preview": task["query"][:300], "signals_used": len(chosen),
            "research_policy": task["research_policy"]}


@app.post("/research")
async def create_research(req: ResearchRequest):
    task, chosen = _prepare_task(req)
    run_id = uuid.uuid4().hex[:12]
    bus = EventBus()
    bus.publish({"type": "policy", "event": "research_policy", "output": json.dumps(task["research_policy"], ensure_ascii=False)})
    RUNS[run_id] = {
        "run_id": run_id,
        "status": "running",
        "bus": bus,
        "task": task,
        "job": None,
        "signals_used": [s.get("id") for s in chosen],
        "result": None,
        "error": None,
        "created_at": time.time(),
        "task_id": None,
    }
    task["signals_used"] = RUNS[run_id]["signals_used"]
    # 保留句柄：/research/{run_id}/cancel 靠它中断这次运行
    RUNS[run_id]["job"] = asyncio.create_task(_execute(run_id))
    return {"run_id": run_id, "query_preview": task["query"][:300], "signals_used": len(chosen), "research_policy": task["research_policy"]}


async def _execute(run_id: str) -> None:
    record = RUNS[run_id]
    try:
        record["result"] = await run_task(record["task"], bus=record["bus"])
        record["status"] = "done"
    except asyncio.CancelledError:
        # 取消是顶层任务被中断，这里把状态落定后不再向上抛（避免 "Task exception was never retrieved"）。
        # 注意：已发出的模型请求会在下一个 await 点中断，但服务端可能已经计费。
        record["status"] = "cancelled"
        record["error"] = "已被用户取消"
        record["result"] = {
            "task_id": record.get("task_id") or int(record.get("created_at") or time.time()),
            "query": record["task"].get("query"),
            "report": None,
            "elapsed_sec": round(time.time() - (record.get("created_at") or time.time()), 1),
        }
        record["bus"].publish({"type": "run", "event": "cancelled", "output": "运行已被用户取消"})
        record["task_id"] = record["result"]["task_id"]
        save_run(
            record["task"],
            record["result"],
            record["bus"].events,
            status=record["status"],
            error=record["error"],
            created_at=record.get("created_at"),
        )
        return
    except Exception as exc:  # 失败要能被前端看见，不能静默
        record["status"] = "error"
        record["error"] = f"{type(exc).__name__}: {exc}"
        # 广播失败事件：否则 SSE 订阅方会一直等一个永不到来的 finished
        record["bus"].publish({"type": "error", "event": "failed", "output": record["error"]})
        record["result"] = {"task_id": record.get("task_id"), "query": record["task"].get("query")}
    record["task_id"] = (record["result"] or {}).get("task_id")
    save_run(
        record["task"],
        record["result"] or {},
        record["bus"].events,
        status=record["status"],
        error=record["error"],
        created_at=record.get("created_at"),
    )


@app.post("/research/{run_id}/cancel")
async def cancel_research(run_id: str):
    record = RUNS.get(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="run not found")
    if record["status"] != "running":
        return {"run_id": run_id, "status": record["status"], "cancelled": False}
    job = record.get("job")
    if job is None or job.done():
        return {"run_id": run_id, "status": record["status"], "cancelled": False}
    job.cancel()
    return {"run_id": run_id, "status": "cancelling", "cancelled": True}


# ---------------------------------------------------------------- 情报岗位作业（自有层；须在 /research/{run_id} 之前）


@app.post("/research/intel/{task_id}")
async def create_intel(task_id: str):
    record = load_run(task_id)
    if not record:
        raise HTTPException(status_code=404, detail="run not found")
    if not record.get("report"):
        raise HTTPException(status_code=400, detail="该记录没有报告正文，无法做情报加工")
    # 岗位作业看的是给人读的报告，所以先用规范化后的正文
    record["report"] = normalize_report_labels(record.get("report"))
    artifacts = await run_intelligence_roles(record, default_model())
    INTEL_DIR.mkdir(parents=True, exist_ok=True)
    (INTEL_DIR / f"{task_id}.json").write_text(json.dumps(artifacts, ensure_ascii=False), encoding="utf-8")
    return artifacts


@app.get("/research/intel/{task_id}")
async def get_intel(task_id: str):
    if not str(task_id).strip().isdigit():
        raise HTTPException(status_code=404, detail="intel not generated")
    path = INTEL_DIR / f"{task_id}.json"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="intel not generated")
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/research/{run_id}")
async def get_research(run_id: str):
    record = RUNS.get(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="run not found")
    result = record["result"] or {}
    return {
        "run_id": run_id,
        "task_id": record.get("task_id"),
        "status": record["status"],
        "error": record["error"],
        "created_at": record.get("created_at"),
        "elapsed_sec": result.get("elapsed_sec"),
        "output_dir": result.get("output_dir"),
        "signals_used": record["signals_used"],
        "report": normalize_report_labels(result.get("report")),
        "diagrams": result.get("diagrams") or [],
        "events": record["bus"].events,
        "research_policy": record["task"].get("research_policy"),
    }


@app.get("/research/{run_id}/events")
async def stream_events(run_id: str, request: Request):
    record = RUNS.get(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="run not found")
    bus: EventBus = record["bus"]
    queue = bus.subscribe()

    async def generator():
        try:
            history = list(bus.events)
            for past in history:
                yield f"data: {json.dumps(past, ensure_ascii=False)}\n\n"
            # 订阅晚于运行结束时，回放完历史就必须收尾，否则客户端会一直挂着
            if any(e.get("event") in ("finished", "failed", "cancelled") for e in history):
                yield f"data: {json.dumps({'event': 'stream_end'}, ensure_ascii=False)}\n\n"
                return
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
                    continue
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                if event.get("event") in ("finished", "failed", "cancelled"):
                    yield f"data: {json.dumps({'event': 'stream_end'}, ensure_ascii=False)}\n\n"
                    break
        finally:
            bus.unsubscribe(queue)

    return StreamingResponse(generator(), media_type="text/event-stream")
