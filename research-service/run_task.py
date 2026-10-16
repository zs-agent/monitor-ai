"""Run the owned structured workflow; --engine legacy is explicit compatibility."""
from __future__ import annotations
import argparse
import asyncio
import contextlib
import io
import json
import time

async def run(args):
    from service import signals as sig
    from service.app import ResearchRequest, _prepare_request
    from service.runner import EventBus, run_task, save_run
    from service.structured_workflow import run_structured
    snapshot = sig.load_signals(args.snapshot)[0]
    request = ResearchRequest(engine=args.engine,focus=args.focus,query=args.query, snapshot=snapshot,
                              categories=args.categories.split(',') if args.categories else None,
                              top=args.top,max_sections=args.max_sections,total_words=args.total_words,
                              task_type=args.task_type,action_budget=args.action_budget,scheduler_mode=args.mode,
                              association_mode=args.association_mode,time_scope=args.time_scope,parent_task_id=args.parent_task_id)
    task,chosen=await _prepare_request(request)
    task['structured_task_id']=str(time.time_ns())
    task['signals_used']=[s.get('id') for s in chosen]
    if args.signals_only:
        return 0,dict(signals=chosen,research_policy=task['research_policy'],structured_state=task.get('structured_state'))
    bus=EventBus()
    queue=bus.subscribe()
    async def printer():
        while True:
            event=await queue.get()
            if not args.json: print(f"[{event.get('event')}] {event.get('output','')}"[:400],flush=True)
    job=asyncio.create_task(printer())
    started=time.monotonic()
    error=None
    try:
        result=await (run_structured(task,bus) if args.engine=='structured' else run_task(task,bus=bus))
        status='failed' if result.get('execution_status')=='failed' else 'partial' if result.get('execution_status')=='partial' else 'done' if result.get('report') else 'failed'
    except (Exception,asyncio.CancelledError) as exc:
        error=f'{type(exc).__name__}: {exc}'
        status='cancelled' if isinstance(exc,asyncio.CancelledError) else 'failed'
        result=dict(task_id=task['structured_task_id'],query=task['query'],structured_state=task.get('structured_state'),elapsed_sec=round(time.monotonic()-started,1))
    finally:
        job.cancel()
        with contextlib.suppress(asyncio.CancelledError): await job
        bus.unsubscribe(queue)
    if result.get('structured_state'):
        result['structured_state']['run_status'] = status
    path=save_run(task,result,bus.events,status=status,error=error)
    payload={k:v for k,v in result.items() if k!='report'}
    payload.update(status=status,error=error,record_path=str(path) if path else None,report_preview=(result.get('report') or '')[:400])
    return (0 if status in ('done','partial') else 1),payload

def main():
    parser=argparse.ArgumentParser(description='结构化多智能体技术情报研究')
    parser.add_argument('--engine',choices=['structured','legacy'],default='structured')
    parser.add_argument('--focus',default='AI 领域近期技术动向')
    parser.add_argument('--query')
    parser.add_argument('--task-type',choices=['fact_check','object_comparison','dynamic_analysis','risk_assessment'])
    parser.add_argument('--action-budget',type=int,default=6)
    parser.add_argument('--mode',choices=['adaptive','fixed','single','full'],default='adaptive')
    parser.add_argument('--association-mode',choices=['structured','unfiltered','keyword','semantic'],default='structured')
    parser.add_argument('--time-scope',default='')
    parser.add_argument('--parent-task-id')
    parser.add_argument('--categories')
    parser.add_argument('--top',type=int,default=10)
    parser.add_argument('--max-sections',type=int,default=3)
    parser.add_argument('--total-words',type=int,default=1500)
    parser.add_argument('--snapshot',default='../data/signals-snapshot.json')
    parser.add_argument('--signals-only',action='store_true')
    parser.add_argument('--json',action='store_true')
    args=parser.parse_args()
    try:
        with contextlib.redirect_stdout(io.StringIO()) if args.json else contextlib.nullcontext():
            code,payload=asyncio.run(run(args))
    except Exception as exc:
        code,payload=1,dict(error=str(getattr(exc,'detail',None) or exc))
    print(json.dumps(payload,ensure_ascii=False,indent=2))
    return code

if __name__=='__main__': raise SystemExit(main())
