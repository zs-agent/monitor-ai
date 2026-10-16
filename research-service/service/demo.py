"""Synthetic two-snapshot acceptance scenario, never an empirical model result."""
from copy import deepcopy
import time
from .research_state import build_state, evidence_record, render_report
from .structured_workflow import run_structured
from .runner import EventBus

FOCUS = 'AtlasDemo'
QUESTIONS = [
    dict(axis='identity', task_type='fact_check', question='AtlasDemo基础架构事实是否保持成立？'),
    dict(axis='deployment', task_type='dynamic_analysis', question='AtlasDemo部署硬件和量化要求如何变化？'),
    dict(axis='capability', task_type='object_comparison', question='AtlasDemo前后性能数据在相同测试条件下是否可比？'),
    dict(axis='risk', task_type='risk_assessment', question='AtlasDemo安全补丁和社区反馈是否改变应用风险？'),
]

def snapshots():
    def row(name, summary, date='2026-10-01'):
        return dict(id=name, title=f'AtlasDemo {name}', summary=summary, content=summary,
                    sourceUrl=f'https://example.org/atlas-demo/{name}', publishedAt=date, source='synthetic_fixture')
    architecture = row('architecture', 'AtlasDemo release architecture: decoder-only，32层；发布架构事实适用v1和v2。')
    deployment = row('deployment', 'AtlasDemo deployment hardware: v1需要48GB GPU；仅支持FP16量化配置。')
    benchmark = row('benchmark', 'AtlasDemo benchmark性能：v1得分70，统一硬件A，batch=1，FP16。')
    risk = row('security', 'AtlasDemo security风险：社区在外部工具输入下复现注入；反例为禁用外部工具后未复现。')
    t1 = [architecture, deployment, benchmark, risk]
    t2 = [architecture,
          row('deployment', 'AtlasDemo deployment hardware: v2支持INT4量化，GPU显存要求降至16GB。', '2026-10-08'),
          row('benchmark', 'AtlasDemo benchmark性能：v2得分82，硬件B，batch=8，INT4；与v1测试条件不同。', '2026-10-08'),
          row('security', 'AtlasDemo security风险：v2安全补丁增加输入隔离；新增社区反馈仍有绕过；反例为隔离开启时攻击未复现。', '2026-10-08')]
    return t1, t2


class DemoAdapter:
    def __init__(self, rows, phase):
        self.rows, self.phase = rows, phase
        self.review_counts = {}
        self.metrics = dict(search_batches=0, model_calls=0, input_tokens=0, output_tokens=0, usage_available=False)
        self.last_model, self.last_provider = 'deterministic-fixture', 'synthetic_demo'

    async def search(self, query):
        self.metrics['search_batches'] += 1
        # All are actual supplied fixture records, not fabricated citations.
        return [dict(evidence_record(r), retrieval_level='synthetic_fixture', link_available=None) for r in self.rows]

    async def generate(self, role, payload):
        axis = payload['axis']
        keys = {r['url'].rsplit('/', 1)[-1]: r['key'] for r in payload['evidence']}
        if role == 'review':
            self.review_counts[axis] = self.review_counts.get(axis, 0) + 1
            needs_feedback = self.phase == 2 and axis == 'risk' and self.review_counts[axis] == 1
            return dict(checks=[dict(index=i, verdict='insufficient' if needs_feedback else 'supported',
                reason='新增绕过反馈需要补查反例及补丁适用条件（合成场景）' if needs_feedback else '合成样例规则核对：原始资料及适用条件一致；非真实模型评测。') for i, _ in enumerate(payload['previous_claims'])])
        phase = self.phase
        if axis == 'identity':
            claim = dict(text='基础架构为32层decoder-only；v1与v2适用条件未变。', evidence_keys=[keys['architecture']], kind='fact_statement')
        elif axis == 'deployment':
            claim = dict(text='部署要求为48GB GPU、FP16。' if phase == 1 else 'v2支持INT4，最低显存要求修订为16GB。', evidence_keys=[keys['deployment']], kind='trend_inference',
                         versions=dict(before='v1', after='v1' if phase == 1 else 'v2', before_time='2026-10-01T00:00:00Z', after_time='2026-10-01T00:00:00Z' if phase == 1 else '2026-10-08T00:00:00Z'))
        elif axis == 'capability':
            claim = dict(text='v1基准得分70，仅适用于硬件A、batch=1、FP16。' if phase == 1 else 'v2得分82使用硬件B、batch=8、INT4，与v1条件不同，不能据此直接排名。',
                         evidence_keys=[keys['benchmark']], kind='comparison_judgment',
                         comparison=dict(dimension='基准性能', conditions='硬件A、batch=1、FP16' if phase == 1 else 'v1: A/batch1/FP16；v2: B/batch8/INT4', comparable=phase == 1,
                                         mismatch_reason='' if phase == 1 else '硬件、批量及精度三项均不同，原始分数不可直接比较'))
        else:
            claim = dict(text='外部工具输入存在注入风险。' if phase == 1 else '安全补丁缓解部分输入风险，但社区反馈仍有绕过，需继续核查。', evidence_keys=[keys['security']], kind='fact_statement',
                         counter_evidence=[dict(text='关闭外部工具或开启隔离时未复现；仅覆盖该合成样例的测试范围。', evidence_keys=[keys['security']])],
                         uncertainty='样例覆盖有限输入，不能据此判断所有部署环境安全。')
        claim['conditions'] = '合成教学数据；不得用于实际模型选型'
        return dict(claims=[claim])


async def run_demo(budget=8, scheduler_config=None, scheduler_mode='adaptive'):
    t1, t2 = snapshots()
    results = []
    parent = None
    for phase, rows in enumerate([t1, t2], 1):
        state = build_state(FOCUS, 'dynamic_analysis', rows, parent, '2026-10',
                            scheduler_config=scheduler_config, questions=QUESTIONS)
        state['data_mode'] = 'synthetic_demo'
        expected = [key for key, q in state['issues'].items() if phase == 1 or q['axis'] != 'identity']
        state['evaluation_labels'] = dict(expected_update_ids=expected,
            stale_claim_texts=['部署要求为48GB GPU、FP16。'] if phase == 2 else [])
        task = dict(engine='structured', data_mode='synthetic_demo', storage_group='demos', focus=FOCUS, query=FOCUS,
                    structured_state=state, structured_task_id=str(time.time_ns()), scheduler_mode=scheduler_mode,
                    action_budget=budget, scheduler_config=scheduler_config or {}, model='deterministic-fixture',
                    research_policy=dict(parent_task_id=results[-1]['task_id'] if results else None))
        bus = EventBus()
        result = await run_structured(task, bus, DemoAdapter(rows, phase))
        result['status'] = 'partial' if result['execution_status'] == 'partial' else 'done'
        result['data_mode'] = 'synthetic_demo'
        result['events'] = bus.events
        result['snapshot'] = f'T{phase}'
        from .runner import save_run
        save_run(task, result, bus.events, status=result['status'])
        results.append(result)
        parent = deepcopy(result['structured_state'])
    return dict(data_mode='synthetic_demo', description='预置合成教学样例；不调用外部模型，不代表真实分析质量；链接为示例地址。', snapshots=results)
