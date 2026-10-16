"""Reproducible scenario matrix with live models and optional frozen evidence.

Run from research-service. Results record resource use, not fabricated quality
scores. A frozen evidence fixture holds retrieval inputs constant across arms.
"""
import argparse
import asyncio
import json
from pathlib import Path
import time
from itertools import product
from service.contracts import SchedulerConfig

from service.runner import EventBus, default_model, save_run
from service.research_state import build_state, evidence_record, TASK_TYPES
from service.structured_workflow import ResearchAdapter, run_structured

class FrozenAdapter(ResearchAdapter):
    def __init__(self, evidence):
        super().__init__()
        self.evidence = evidence
    async def search(self, query):
        self.metrics['search_batches'] += 1
        return [dict(e) for e in self.evidence]

def terminal_status(execution_status):
    statuses = {'completed': 'done', 'partial': 'partial', 'failed': 'failed', 'cancelled': 'cancelled'}
    if execution_status not in statuses:
        raise ValueError('unknown execution status: ' + str(execution_status))
    return statuses[execution_status]


def load_fixtures(paths, snapshot_count):
    if not paths:
        return None
    if isinstance(paths, str):
        paths = [paths]
    if len(paths) != snapshot_count:
        raise ValueError('冻结资料文件数量必须与快照数量一致，避免T2资料泄漏到T1')
    fixtures = []
    for path in paths:
        rows = json.loads(Path(path).read_text(encoding='utf-8'))
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValueError('冻结资料必须是资料对象数组')
        fixtures.append([dict(evidence_record(row), retrieval_level=row.get('retrieval_level', 'frozen_source')) for row in rows])
    return fixtures


async def execute(args):
    configurations = [SchedulerConfig(alpha=a, beta_verify=v, beta_risk=r, wn=args.weights[0], wu=args.weights[1], wc=args.weights[2], ablations=[] if ablation == 'none' else [ablation]).model_dump()
                      for a,v,r,ablation in product(args.alpha, args.beta_verify, args.beta_risk, args.ablation)]
    if len(configurations) * len(args.budget) * args.repeats * len(args.mode) > 256:
        raise ValueError('实验矩阵过大，请拆分为不超过256个配置/预算/重复组合')
    if args.demo:
        from service.demo import run_demo
        output = Path(args.output)
        output.mkdir(parents=True, exist_ok=True)
        rows = []
        for repeat, config, budget, mode in product(range(args.repeats), configurations, args.budget, args.mode):
            result = await run_demo(budget, config, mode)
            summary = dict(repeat=repeat, strategy=mode, config=config, action_budget=budget, data_mode='synthetic_demo', snapshots=[dict(task_id=s['task_id'], evaluation=s['structured_state']['evaluation'], allocation=s['structured_state']['allocation']) for s in result['snapshots']])
            rows.append(summary)
        (output/'matrix.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(dict(configurations=len(rows), data_mode='synthetic_demo', output=str(output/'matrix.json')), ensure_ascii=False))
        return
    if not args.snapshot or not args.focus:
        raise ValueError('真实实验需要--snapshot与--focus；离线验收使用--demo')
    snapshots = [json.loads(Path(p).read_text(encoding='utf-8')) for p in args.snapshot]
    if any(not isinstance(s, list) for s in snapshots): raise ValueError('each snapshot must be an array of signals')
    fixtures = load_fixtures(args.evidence_fixture, len(snapshots))
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    results = []
    for repeat, config in product(range(args.repeats), configurations):
        for budget in args.budget:
            for mode in args.mode:
                parent = None
                parent_task_id = None
                for version, snapshot in enumerate(snapshots):
                    scores = None
                    if args.association_mode == 'semantic':
                        from service.semantic import semantic_scores
                        scores = await semantic_scores(args.focus, snapshot)
                    state = build_state(args.focus,args.task_type,snapshot,parent,args.time_scope,args.association_mode, scheduler_config=config, semantic_scores=scores)
                    task = dict(engine='structured',focus=args.focus,query=args.focus,structured_state=state,
                                action_budget=budget,scheduler_mode=mode,structured_task_id=str(time.time_ns()),
                                model=default_model(),research_policy=dict(parent_task_id=parent_task_id))
                    evidence = fixtures[version] if fixtures is not None else None
                    adapter = FrozenAdapter(evidence) if evidence is not None else ResearchAdapter()
                    bus = EventBus()
                    result = await run_structured(task,bus,adapter)
                    state = result['structured_state']
                    state['experiment'].update(repeat=repeat,snapshot_version=version,retrieval_mode='frozen_evidence' if evidence is not None else 'live_retrieval')
                    status = terminal_status(result['execution_status'])
                    save_run(task,result,bus.events,status=status)
                    path=output/f"{task['structured_task_id']}.json"
                    path.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
                    summary=dict(state['experiment'],task_id=task['structured_task_id'],status=status,affected=len(state['affected']),
                                 carried=sum(q['status']=='carried' for q in state['issues'].values()))
                    results.append(summary)
                    if status in ('failed', 'cancelled'):
                        # An unsuccessful snapshot cannot become the next phase's
                        # historical evidence. Stop this arm, keep other arms running.
                        break
                    parent,parent_task_id=state,task['structured_task_id']
                    print(json.dumps(summary,ensure_ascii=False),flush=True)
    (output/'matrix.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--snapshot',nargs='+')
    parser.add_argument('--focus')
    parser.add_argument('--demo', action='store_true', help='合成样例链路验收，不是真实模型质量实验')
    parser.add_argument('--alpha', nargs='+', type=float, default=[4])
    parser.add_argument('--beta-verify', nargs='+', type=float, default=[2])
    parser.add_argument('--beta-risk', nargs='+', type=float, default=[1])
    parser.add_argument('--weights', nargs=3, type=float, default=[1,1,1], metavar=('WN','WU','WC'))
    parser.add_argument('--ablation', nargs='+', choices=['none','drop_n','drop_u','drop_c','drop_t','equal_utility'], default=['none'])
    parser.add_argument('--task-type',choices=TASK_TYPES,default='fact_check')
    parser.add_argument('--budget',nargs='+',type=int,default=[4])
    parser.add_argument('--mode',nargs='+',choices=['adaptive','fixed','single','full'],default=['adaptive','fixed','single','full'])
    parser.add_argument('--repeats',type=int,default=1)
    parser.add_argument('--time-scope',default='')
    parser.add_argument('--association-mode',choices=['structured','unfiltered','keyword','semantic'],default='structured')
    parser.add_argument('--evidence-fixture', nargs='+', help='每个快照对应一个冻结资料文件；单快照仅需一个文件')
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    if not 1<=args.repeats<=20 or any(not 0<=b<=64 for b in args.budget): parser.error('repeats 1..20 and budget 0..64 required')
    asyncio.run(execute(args))
