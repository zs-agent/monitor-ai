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
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator, ConfigDict

from . import signals as sig
from .insights import router as insights_router
from . import runner as persistence
from .evolution import prepare_research
from .research_state import build_state, infer_type, action_options, allocate, schedule
from .structured_workflow import run_structured
from .contracts import TaskType, AgentRole, ActionPackage, VerificationStatus, UpdateStatus, RunStatus, SchedulerConfig, QuestionSpec, ManualAssociation, HumanReview, AssociationConfig
from .postprocess import normalize_report_labels
from .roles import run_intelligence_roles
from .runner import RUNS_DIR, EventBus, default_model, load_history, load_run, run_task, save_run

SERVICE_ROOT = Path(__file__).resolve().parents[1]
# 派生产物（情报岗位作业等）单独放子目录：运行记录用 runs/*.json 通配加载，
# 混在一起会把同一 task_id 读成两条记录（曾导致前端 React key 重复）。
INTEL_DIR = SERVICE_ROOT / "runs" / "intel"

@asynccontextmanager
async def lifespan(application):
    # Recover interrupted provisional runs; never pretend they completed.
    if persistence.RUNS_DIR.is_dir():
        for path in persistence.RUNS_DIR.glob("*.json"):
            if not path.stem.isdigit():
                continue
            try:
                record = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(record, dict) and record.get("status") == "running":
                    record.update(status="failed", error="服务重启导致任务中断；请重新发起研究", finished_at=time.time(), report=None)
                    temporary = path.with_suffix(".json.tmp")
                    temporary.write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")
                    os.replace(temporary, path)
            except (OSError, ValueError):
                logging.getLogger(__name__).warning("Could not reconcile interrupted run %s", path.name)
    yield
    jobs = [r["job"] for r in RUNS.values() if r.get("job") and not r["job"].done()]
    for job in jobs:
        job.cancel()
    if jobs:
        await asyncio.gather(*jobs, return_exceptions=True)

app = FastAPI(title="monitor-ai research service", version="0.3.0", lifespan=lifespan)
app.include_router(insights_router)


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
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False, str_strip_whitespace=True)
    engine: Literal["structured", "legacy"] = "structured"
    task_type: TaskType | None = None
    @field_validator('task_type', mode='before')
    @classmethod
    def legacy_task_type(cls, value):
        from .research_state import normalize_type
        return normalize_type(value)
    scheduler_mode: Literal["adaptive", "fixed", "full", "single", "greedy"] = "adaptive"
    association_mode: Literal["structured", "jaccard", "unfiltered", "keyword", "semantic", "hybrid"] = "structured"
    association_config: AssociationConfig = Field(default_factory=AssociationConfig)
    action_budget: int = Field(default=6, ge=0, le=64, strict=True)
    scheduler_config: SchedulerConfig = Field(default_factory=SchedulerConfig)
    questions: list[QuestionSpec] | None = Field(default=None, max_length=20)
    manual_associations: list[ManualAssociation] = Field(default_factory=list, max_length=50)
    data_mode: Literal['live', 'synthetic_demo'] = 'live'
    time_scope: str = Field(default="", max_length=200)
    action_timeout_sec: int = Field(default=120, ge=10, le=300)
    parent_task_id: str | None = Field(default=None, pattern=r"^[0-9]+$")
    policy_mode: Literal["adaptive", "fixed"] = "adaptive"
    focus: str = Field(default="AI 领域近期技术动向", max_length=500)
    query: str | None = Field(default=None, max_length=2000)
    snapshot: list[dict] | None = Field(default=None, max_length=500)
    categories: list[str] | None = None
    top: int = Field(default=10, ge=1, le=50)
    max_sections: int = Field(default=3, ge=1, le=8)
    total_words: int = Field(default=1500, ge=300, le=6000)


def _build_task(req: ResearchRequest) -> tuple[dict, list[dict]]:
    model = default_model()
    if req.query and req.engine == 'legacy':
        return (
            sig.build_task_from_query(req.query, model=model, max_sections=req.max_sections, total_words=req.total_words),
            [],
        )
    if req.engine == "structured":
        all_signals = req.snapshot if req.snapshot is not None else sig.load_signals()[0]
        chosen = sig.select_signals(all_signals, categories=req.categories, top=req.top, min_credibility=0, exclude_providers=(), focus=req.query or req.focus)
        task = sig.build_task_from_query(req.focus, model=model, max_sections=req.max_sections, total_words=req.total_words)
        task["signals_detail"] = chosen
        return task, chosen
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
async def research_history(limit: int = Query(default=40, ge=1, le=200)):
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
        if r["status"] == "running" or r.get("persistence_failed")
    ]
    persisted = {str(i.get("task_id")) for i in items}
    return {"items": live + [i for i in items if str(i.get("task_id")) not in {str(x.get("task_id")) for x in live}], "persisted": len(items), "live_run_ids": [x["run_id"] for x in live], "persisted_ids": sorted(persisted)}


@app.get("/research/history/{task_id}")
async def research_history_item(task_id: str):
    record = load_run(task_id)
    if not record:
        raise HTTPException(status_code=404, detail="run not found")
    # 上游 writer 会把 guidelines 塞进固定槽位的标题里，展示层统一还原
    if not record.get("structured_state"):
        record["report"] = normalize_report_labels(record.get("report"))
    return record


# ---------------------------------------------------------------- 运行


def _prepare_task(req: ResearchRequest, semantic=None):
    try:
        task, chosen = _build_task(req)
    except (ValueError, OSError, StopIteration) as exc:
        raise HTTPException(status_code=400, detail="invalid signal snapshot: " + str(exc)) from exc
    parent = load_run(req.parent_task_id) if req.parent_task_id else None
    if req.parent_task_id and parent is None:
        raise HTTPException(status_code=404, detail="parent report not found")
    try:
        if req.engine == "structured":
            if parent and (parent.get("status") not in ("done", "partial") or not parent.get("structured_state")):
                raise ValueError("请选择具有结构化状态的已完成或部分完成报告；旧报告可使用原流程继续研究")
            focus = (req.query or req.focus).strip()
            if not focus:
                raise ValueError("focus must not be empty")
            if parent and parent.get('data_mode') == 'synthetic_demo':
                raise ValueError('合成样例不得作为真实研究的父任务，请在样例入口内比较T1与T2')
            kind = req.task_type.value if req.task_type else infer_type(focus)
            graph = build_state(focus, kind, chosen, (parent or {}).get("structured_state"), req.time_scope, req.association_mode,
                req.scheduler_config.model_dump(), [q.model_dump(mode='json') for q in req.questions] if req.questions else None,
                [m.model_dump() for m in req.manual_associations], semantic, req.association_config.model_dump())
            graph['data_mode'] = req.data_mode
            allocation = schedule(graph, req.scheduler_mode, req.action_budget)
            task.update(engine="structured", structured_state=graph, action_budget=req.action_budget,
                        data_mode=req.data_mode, storage_group='demos' if req.data_mode == 'synthetic_demo' else 'normal',
                        scheduler_mode=req.scheduler_mode, scheduler_config=req.scheduler_config.model_dump(), action_timeout_sec=req.action_timeout_sec,
                        parent_state_for_refresh=(parent or {}).get("structured_state"),
                        research_policy={"version":"structured-v1", "task_type":kind,
                          "scheduler_mode":req.scheduler_mode,"allocation":allocation,
                          "parent_task_id":req.parent_task_id,"affected":graph["affected"],"delta":graph["delta"]})
            task["research_policy"]["task_type"] = graph["task_type"]
            return task, chosen
        task["engine"] = "legacy"
        return prepare_research(task, chosen, parent, req.policy_mode), chosen
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


async def _prepare_request(req):
    semantic = None
    if req.association_mode in ('semantic', 'hybrid'):
        from .semantic import semantic_scores
        try:
            _, chosen = _build_task(req)
            semantic = await semantic_scores((req.query or req.focus).strip(), chosen, req.association_config.model_dump())
        except Exception as exc:
            raise HTTPException(status_code=400, detail='语义关联不可用：' + str(exc)) from exc
    return _prepare_task(req, semantic)


@app.get('/research/contracts')
async def contracts():
    return dict(task_types=[x.value for x in TaskType], agent_roles=[x.value for x in AgentRole],
        action_packages=[x.value for x in ActionPackage], verification_statuses=[x.value for x in VerificationStatus],
        update_statuses=[x.value for x in UpdateStatus], run_statuses=[x.value for x in RunStatus],
        scheduler_schema=SchedulerConfig.model_json_schema(), scheduler_defaults=SchedulerConfig().model_dump())


@app.get('/research/experiments')
async def experiments(limit: int = Query(default=40, ge=1, le=200)):
    items = []
    folder = persistence.RUNS_DIR / 'experiments'
    for path in sorted(folder.glob('*.json'), key=lambda p: p.name, reverse=True)[:limit * 3]:
        try:
            record = json.loads(path.read_text(encoding='utf-8'))
            run = load_run(record.get('task_id', '')) if isinstance(record, dict) else None
            if run and run.get('status') in ('done', 'partial') and run.get('data_mode') != 'synthetic_demo':
                record['evaluation'] = (run.get('structured_state') or {}).get('evaluation')
                items.append(record)
        except (ValueError, OSError):
            logging.getLogger(__name__).warning('Invalid experiment log %s', path.name)
        if len(items) >= limit:
            break
    return dict(items=items)


class DemoRequest(BaseModel):
    action_budget: int = Field(default=10, ge=0, le=64, strict=True)
    scheduler_config: SchedulerConfig = Field(default_factory=SchedulerConfig)
    scheduler_mode: Literal['adaptive', 'fixed', 'single', 'full', 'greedy'] = 'adaptive'


@app.post('/research/demo')
async def demo(req: DemoRequest):
    from .demo import run_demo
    return await run_demo(req.action_budget, req.scheduler_config.model_dump(), req.scheduler_mode)


@app.post('/research/history/{task_id}/reviews')
async def human_review(task_id: str, review: HumanReview):
    record = load_run(task_id)
    if not record:
        raise HTTPException(status_code=404, detail='run not found')
    if record.get('status') not in ('done', 'partial'):
        raise HTTPException(status_code=409, detail='只能评价已完成或部分完成的任务')
    state = record.get('structured_state') or {}
    issue = state.get('issues', {}).get(review.question_id)
    if not issue or not any(c.get('id') == review.claim_id for c in issue.get('claims', [])):
        raise HTTPException(status_code=400, detail='结论不属于指定问题')
    state.setdefault('human_reviews', []).append(dict(**review.model_dump(), reviewed_at=time.time()))
    from .evaluation import evaluate
    state['evaluation'] = evaluate(state)
    try:
        persistence.update_record(task_id, record)
    except OSError as exc:
        raise HTTPException(status_code=503, detail='评阅记录保存失败') from exc
    return dict(human_reviews=state['human_reviews'], evaluation=state['evaluation'])


@app.post("/research/preview")
async def preview_research(req: ResearchRequest):
    task, chosen = await _prepare_request(req)
    return {"query_preview": task["query"][:300], "signals_used": len(chosen),
            "research_policy": task["research_policy"], "structured_state": task.get("structured_state")}


@app.post("/research")
async def create_research(req: ResearchRequest):
    if sum(r["status"] == "running" for r in RUNS.values()) >= 8:
        raise HTTPException(status_code=429, detail="同时运行的任务已达上限，请稍后重试")
    # Full histories stay on disk; retain only recent runtime handles in memory.
    completed = sorted((rid for rid, r in RUNS.items() if r["status"] != "running"), key=lambda rid: RUNS[rid].get("created_at", 0))
    for rid in completed[:max(0, len(RUNS) - 127)]:
        RUNS.pop(rid, None)
    task, chosen = await _prepare_request(req)
    if sum(r['status'] == 'running' for r in RUNS.values()) >= 8:
        raise HTTPException(status_code=429, detail='同时运行的任务已达上限')
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
    task["structured_task_id"] = str(time.time_ns())
    RUNS[run_id]["task_id"] = task["structured_task_id"]
    try:
        save_run(task, {"task_id": task["structured_task_id"], "structured_state":task.get("structured_state")}, bus.events,
                 status="running", created_at=RUNS[run_id]["created_at"])
    except OSError as exc:
        RUNS.pop(run_id, None)
        raise HTTPException(status_code=503, detail="运行记录无法保存，请检查存储权限") from exc
    # 保留句柄：/research/{run_id}/cancel 靠它中断这次运行
    RUNS[run_id]["job"] = asyncio.create_task(_execute(run_id))
    def cancelled_before_entry(job):
        record = RUNS.get(run_id)
        if job.cancelled() and record and record['status'] == 'running':
            record.update(status='cancelled', error='任务在执行前取消', result=dict(task_id=record['task_id'], report=None))
            _persist_terminal(record)
    RUNS[run_id]['job'].add_done_callback(cancelled_before_entry)
    return {"run_id": run_id, "query_preview": task["query"][:300], "signals_used": len(chosen), "research_policy": task["research_policy"]}


async def _execute(run_id: str) -> None:
    record = RUNS[run_id]
    try:
        executor = run_structured if record["task"].get("engine") == "structured" else run_task
        record["result"] = await executor(record["task"], bus=record["bus"])
        execution = record["result"].get("execution_status")
        record["status"] = 'failed' if execution == 'failed' else "partial" if execution == "partial" else "done"
        if execution == 'failed':
            from .errors import failure_summary
            record['error'] = failure_summary(record['result'].get('structured_state') or {})
    except asyncio.CancelledError:
        # 取消是顶层任务被中断，这里把状态落定后不再向上抛（避免 "Task exception was never retrieved"）。
        # 注意：已发出的模型请求会在下一个 await 点中断，但服务端可能已经计费。
        record["status"] = "cancelled"
        record["error"] = "已被用户取消"
        record["result"] = {
            "task_id": record.get("task_id") or record["task"].get("structured_task_id") or int(record.get("created_at") or time.time()),
            "query": record["task"].get("query"),
            "report": None,
            "elapsed_sec": round(time.time() - (record.get("created_at") or time.time()), 1),
        }
        record["result"]["structured_state"] = record["task"].get("structured_state")
        record["task_id"] = record["result"]["task_id"]
        _persist_terminal(record)
        return
    except Exception as exc:  # 失败要能被前端看见，不能静默
        record["status"] = "failed"
        record["error"] = f"{type(exc).__name__}: {exc}"
        # 广播失败事件：否则 SSE 订阅方会一直等一个永不到来的 finished
        # Terminal notification follows persistence below.
        record["result"] = {"task_id": record.get("task_id") or record["task"].get("structured_task_id"), "query": record["task"].get("query")}
    record["task_id"] = (record["result"] or {}).get("task_id")
    _persist_terminal(record)


def _persist_terminal(record):
    if record.get('task', {}).get('structured_state'):
        record['task']['structured_state']['run_status'] = record['status']
    if record['status'] in ('failed', 'cancelled') and record.get('result'):
        record['result']['report'] = None
    try:
        save_run(record["task"], record["result"] or {}, record["bus"].events,
                 status=record["status"], error=record["error"], created_at=record.get("created_at"))
    except Exception as exc:
        record["status"] = "failed"
        if record.get('result'): record['result']['report'] = None
        if record.get('task', {}).get('structured_state'):
            record['task']['structured_state']['run_status'] = 'failed'
        record["persistence_failed"] = True
        record["error"] = f"保存运行记录失败：{type(exc).__name__}"
        logging.getLogger(__name__).exception("Run persistence failed")
    event = "cancelled" if record["status"] == "cancelled" else "failed" if record["status"] == "failed" else "finished"
    record["bus"].publish({"type":"run", "event":event, "output":record["error"] or record["status"]})



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
    if not record.get("structured_state"):
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
        "report": result.get("report") if record["task"].get("engine") == "structured" else normalize_report_labels(result.get("report")),
        "diagrams": result.get("diagrams") or [],
        "events": record["bus"].events,
        "research_policy": record["task"].get("research_policy"),
        "structured_state": result.get("structured_state") or record["task"].get("structured_state"),
    }


@app.get("/research/{run_id}/events")
async def stream_events(run_id: str, request: Request):
    record = RUNS.get(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="run not found")
    bus: EventBus = record["bus"]

    async def generator():
        queue = bus.subscribe()
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

    return StreamingResponse(generator(), media_type="text/event-stream", headers={"Cache-Control":"no-cache", "X-Accel-Buffering":"no"})
