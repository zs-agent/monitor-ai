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
from service.contracts import SchedulerConfig, QuestionSpec, AssociationConfig
from copy import deepcopy
from service.research_state import digest

from service.runner import EventBus, default_model, save_run
from service.research_state import build_state, evidence_record, TASK_TYPES
from service.structured_workflow import ResearchAdapter, run_structured

class FrozenAdapter(ResearchAdapter):
    def __init__(self, evidence):
        super().__init__()
        self.evidence = evidence
    async def search_with_sources(self, query, sources):
        return await self.search(query)
    async def search(self, query, seed_sources=None):
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
        if any(not (row.get('raw_content') or row.get('content') or row.get('body')) for row in rows):
            raise ValueError('冻结证据必须含原文，不可用摘要冒充正文')
        fixtures.append([dict(evidence_record(row), retrieval_level='frozen_source', link_available=None) for row in rows])
    return fixtures


async def execute(args):
    # Preserve callers that construct the pre-V3 argparse namespace directly.
    for key,value in dict(utility_profile='proposal_v3',reserve_units=1,reserve_ratio=None,beta_scale=1,
                          questions=None,budget_scale=None,labels=None,association_config=None,parent=None,association_only=False).items():
        if not hasattr(args,key): setattr(args,key,value)
    if args.utility_profile == 'proposal_v3' and (args.beta_verify != [2] or args.beta_risk != [1]):
        raise ValueError('V3使用--beta-scale；旧beta参数请显式指定--utility-profile legacy_v2')
    configurations = [SchedulerConfig(alpha=a, beta_verify=v, beta_risk=r, utility_profile=args.utility_profile,
                       reserve_units=args.reserve_units, reserve_ratio=args.reserve_ratio,
                       beta_fact=2*args.beta_scale, beta_comparison=4*args.beta_scale,
                       beta_dynamic=4*args.beta_scale, beta_risk_v3=8*args.beta_scale,
                       wn=args.weights[0], wu=args.weights[1], wc=args.weights[2],
                       ablations=[] if ablation == 'none' else [ablation]).model_dump()
                      for a,v,r,ablation in product(args.alpha, args.beta_verify, args.beta_risk, args.ablation)]
    questions = None
    if args.questions:
        raw = json.loads(Path(args.questions).read_text(encoding='utf-8'))
        questions = [QuestionSpec.model_validate(q).model_dump(mode='json') for q in raw]
        if not questions or len(questions)>20: raise ValueError('需1..20个问题')
    if args.budget_scale:
        if not questions: raise ValueError('--budget-scale需要--questions，N取全问题数')
        if args.budget: raise ValueError('--budget与--budget-scale请选择一种，避免覆盖预算配置')
        args.budget = [len(questions)*scale for scale in args.budget_scale]
    args.budget = args.budget or [4]
    if any(b>64 or b<0 for b in (args.budget or [])): raise ValueError('budget 0..64')
    if any(cfg['reserve_ratio'] is None and 'drop_reserve' not in cfg['ablations'] and
           cfg['reserve_units'] > budget for cfg in configurations for budget in args.budget):
        raise ValueError('正式实验的整数预留不得大于任一总预算；请调整--reserve-units或拆分配置')
    labels = json.loads(Path(args.labels).read_text(encoding='utf-8')) if args.labels else {}
    if not isinstance(labels, dict): raise ValueError('labels必须为对象')
    association_config = AssociationConfig.model_validate(json.loads(Path(args.association_config).read_text(encoding='utf-8')) if args.association_config else {}).model_dump()
    common_parent = None
    if args.parent:
        record = json.loads(Path(args.parent).read_text(encoding='utf-8'))
        if 'structured_state' in record:
            if record.get('execution_status') not in ('completed','partial') and record.get('status') not in ('done','partial'):
                raise ValueError('共同父快照必须是有效完成记录')
            common_parent = record['structured_state']
        else:
            common_parent = record
        if common_parent.get('run_status') not in ('done','partial'): raise ValueError('共同父状态必须有效')
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
    manifest = dict(protocol='proposal-v3', configurations=configurations, budgets=args.budget, question_count=len(questions or {}),
                    dataset_hashes=[digest(s) for s in snapshots], fixture_hashes=[digest(f) for f in fixtures] if fixtures is not None else None,
                    questions_hash=digest(questions), labels_hash=digest(labels), common_parent_hash=digest(common_parent) if common_parent else None)
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    results = []
    for repeat, config in product(range(args.repeats), configurations):
        for budget in args.budget:
            for mode in args.mode:
                parent = deepcopy(common_parent)
                parent_task_id = 'common:' + digest(common_parent) if common_parent else None
                for version, snapshot in enumerate(snapshots):
                    prepared = {evidence_record(row)['key']:dict(row) for row in snapshot}
                    if fixtures is not None:
                        for row in fixtures[version]:
                            prepared[row['key']] = dict(prepared.get(row['key'],{}), **row)
                    inputs = list(prepared.values())
                    scores = None
                    if args.association_mode in ('semantic', 'hybrid'):
                        from service.semantic import semantic_scores
                        scores = await semantic_scores(args.focus, inputs, association_config)
                    state = build_state(args.focus,args.task_type,inputs,parent,args.time_scope,args.association_mode, scheduler_config=config, semantic_scores=scores, questions=questions, association_config=association_config)
                    state['evaluation_labels'] = deepcopy(labels)
                    if args.association_only:
                        from service.evaluation import association_metrics
                        (output/f'association-{repeat}-{mode}-{budget}-{version}.json').write_text(json.dumps(dict(association=state['association'], metrics=association_metrics(state,labels), dataset_hash=digest(snapshot), labels_hash=digest(labels)),ensure_ascii=False,indent=2),encoding='utf-8')
                        continue
                    task = dict(engine='structured',focus=args.focus,query=args.focus,structured_state=state,
                                action_budget=budget,scheduler_mode=mode,structured_task_id=str(time.time_ns()),
                                model=default_model(), data_mode='frozen_evidence' if fixtures is not None else 'live', parent_state_for_refresh=parent if fixtures is None else None, research_policy=dict(parent_task_id=parent_task_id))
                    evidence = fixtures[version] if fixtures is not None else None
                    adapter = FrozenAdapter(evidence) if evidence is not None else ResearchAdapter()
                    bus = EventBus()
                    result = await run_structured(task,bus,adapter)
                    state = result['structured_state']
                    state['experiment'].update(dataset_hash=digest(snapshot), labels_hash=digest(labels),
                        common_parent_hash=digest(common_parent) if common_parent else None,
                        candidate_state_hash=digest({k:q.get('features') for k,q in state['issues'].items()}),
                        selection_hash=digest([(o['issue_id'],o['kind'],o['cost']) for o in state.get('allocation',{}).get('selected',[])]),
                        repeat=repeat,snapshot_version=version,retrieval_mode='frozen_evidence' if evidence is not None else 'live_retrieval')
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
    parser.add_argument('--ablation', nargs='+', choices=['none','drop_n','drop_u','drop_c','drop_t','drop_reserve','equal_utility'], default=['none'])
    parser.add_argument('--task-type',choices=TASK_TYPES,default='fact_check')
    parser.add_argument('--budget',nargs='+',type=int)
    parser.add_argument('--budget-scale',nargs='+',type=int,choices=[1,2,3])
    parser.add_argument('--mode',nargs='+',choices=['adaptive','fixed','greedy','single','full'],default=['adaptive','fixed','greedy'])
    parser.add_argument('--repeats',type=int,default=1)
    parser.add_argument('--time-scope',default='')
    parser.add_argument('--association-mode',choices=['structured','jaccard','hybrid','unfiltered','keyword','semantic'],default='structured')
    parser.add_argument('--evidence-fixture', nargs='+', help='每个快照对应一个冻结资料文件；单快照仅需一个文件')
    parser.add_argument('--questions', help='固定问题JSON列表，含id/task_type/axis/question/critical')
    parser.add_argument('--labels', help='预先固定的人工真值标签JSON；只用于评价，绝不进入模型输入')
    parser.add_argument('--parent', help='所有T2对照共同使用的有效T1状态/运行JSON')
    parser.add_argument('--reserve-units',type=int,default=1)
    parser.add_argument('--reserve-ratio',type=float)
    parser.add_argument('--utility-profile',choices=['proposal_v3','legacy_v2'],default='proposal_v3')
    parser.add_argument('--beta-scale',type=float,default=1)
    parser.add_argument('--association-config', help='别名/版本/阈值冻结配置JSON')
    parser.add_argument('--association-only',action='store_true',help='仅输出关联结果，不调用报告模型')
    parser.add_argument('--output',required=True)
    args=parser.parse_args()
    if not 1<=args.repeats<=20 or any(not 0<=b<=64 for b in (args.budget or [])): parser.error('repeats 1..20 and budget 0..64 required')
    asyncio.run(execute(args))
