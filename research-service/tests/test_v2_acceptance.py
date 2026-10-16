import asyncio
from copy import deepcopy
from itertools import product
import json
import subprocess
import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from service import app as api, runner
from service.contracts import SchedulerConfig
from service.research_state import action_options, allocate, build_state, apply_research, apply_review, evidence_record
from service.structured_workflow import run_structured
from service.runner import EventBus

SIGNAL = dict(title='Atlas model deployment', summary='Atlas model deployment cost capability', url='https://example.org/atlas?utm_source=test', published_at='2026-10-01')


def state(kind='fact_check', config=None):
    return build_state('Atlas', kind, [SIGNAL], scheduler_config=config)


def test_default_formula_and_fractional_mckp_matches_exhaustive():
    graph = state('risk_assessment')
    options = action_options(graph)
    for qid, values in options.items():
        features = graph['issues'][qid]['features']
        priority = 1 + features['n'] + features['u'] + int(features['c'] < 1)
        assert values[1]['utility'] == 4 * priority
        assert values[2]['utility'] == 4 * priority + 3  # verify=2, risk=1
    cfg = SchedulerConfig(alpha=1.5, beta_verify=.25, wn=.5).model_dump()
    options = action_options(graph, config=cfg)
    for budget in range(5):
        optimal = max(sum(x['utility'] for x in row) for row in product(*options.values()) if sum(x['cost'] for x in row) <= budget)
        assert allocate(options, budget)['proxy_utility'] == optimal
    for invalid in [float('nan'), float('inf'), True]:
        with pytest.raises(ValueError):
            allocate({'q': [dict(kind='research', cost=1, utility=invalid)]}, 1)


def test_ablations_remove_only_corresponding_contribution():
    graph = state('risk_assessment', dict(ablations=['drop_n', 'drop_c', 'drop_t']))
    options = action_options(graph)
    assert all(q['features']['priority'] == 2 for q in graph['issues'].values())
    assert all(rows[2]['utility'] == 10 for rows in options.values())
    fixed = action_options(graph, 'fixed')
    assert all(rows[1]['utility'] == 4 and rows[2]['utility'] == 6 for rows in fixed.values())


@pytest.mark.parametrize('kind', ['object_comparison', 'dynamic_analysis', 'risk_assessment'])
def test_missing_domain_fields_cannot_be_supported_by_a_model(kind):
    graph = state(kind)
    qid = next(iter(graph['issues']))
    apply_research(graph, qid, dict(claims=[dict(text='Unsupported domain assertion', conditions='v1', evidence_keys=['https://example.org/atlas'])]), [evidence_record(SIGNAL)])
    apply_review(graph, qid, dict(checks=[dict(index=0, verdict='supported', reason='LLM says yes')]))
    claim = graph['issues'][qid]['claims'][0]
    assert claim['status'] == 'insufficient'
    assert claim['contract_errors']


def test_fabricated_source_never_passes_even_with_a_valid_source():
    graph = state()
    qid = next(iter(graph['issues']))
    apply_research(graph, qid, dict(claims=[dict(text='See https://fabricated.invalid/proof', conditions='v1', evidence_keys=['https://example.org/atlas', 'https://fabricated.invalid/proof'])]), [evidence_record(SIGNAL)])
    apply_review(graph, qid, dict(checks=[dict(index=0, verdict='supported')]))
    claim = graph['issues'][qid]['claims'][0]
    assert claim['status'] != 'supported'
    assert 'https://fabricated.invalid' not in claim['text']
    assert claim['rejected_sources']


def test_manual_association_records_reason_and_blocks_foreign_question():
    graph = state()
    qid = next(iter(graph['issues']))
    correction = dict(evidence_key='https://example.org/atlas', object_name='Atlas', question_ids=[qid], reason='人工核对对象名称')
    updated = build_state('Atlas', 'fact_check', [SIGNAL], manual_associations=[correction])
    assert updated['association']['matches'][0]['question_ids'] == [qid]
    assert updated['association']['matches'][0]['manual']['reason'] == correction['reason']
    with pytest.raises(ValueError):
        build_state('Atlas', 'fact_check', [SIGNAL], manual_associations=[dict(correction, question_ids=['foreign'])])
    corrected_object = build_state('Atlas', 'fact_check', [SIGNAL], manual_associations=[dict(correction, object_name='Other', question_ids=[])])
    assert not corrected_object['association']['matches'][0]['question_ids']


def test_semantic_adapter_requires_real_scores_and_keyword_mode_is_separate():
    with pytest.raises(ValueError, match='语义'):
        build_state('Atlas', 'fact_check', [SIGNAL], association_mode='semantic')
    graph = build_state('Atlas', 'fact_check', [SIGNAL], association_mode='semantic', semantic_scores={'https://example.org/atlas': .8})
    assert graph['association']['matches'][0]['score'] == .8
    assert graph['association']['matches'][0]['question_ids']
    assert build_state('Atlas', 'fact_check', [SIGNAL], association_mode='keyword')['association_mode'] == 'keyword'


class FeedbackAdapter:
    def __init__(self): self.reviews = {}
    async def search(self, query): return [evidence_record(SIGNAL)]
    async def generate(self, role, payload):
        if role == 'research':
            return dict(claims=[dict(text='Controlled finding', conditions='v1', evidence_keys=['https://example.org/atlas'])])
        qid = payload['question_id']
        self.reviews[qid] = self.reviews.get(qid, 0) + 1
        return dict(checks=[dict(index=0, verdict='insufficient' if self.reviews[qid] == 1 else 'supported', reason='Needs additional evidence')])


def test_budgeted_loopback_reserves_selected_actions_and_terminates():
    graph = state()
    bus = EventBus()
    task = dict(structured_state=graph, action_budget=8, scheduler_mode='adaptive', structured_task_id='777', query='Atlas')
    result = asyncio.run(run_structured(task, bus, FeedbackAdapter()))
    actual = result['structured_state']
    assert actual['allocation']['spent_units'] == 8
    assert sum(a.get('feedback', False) for a in actual['actions']) == 4
    assert all(q['status'] == 'reviewed' for q in actual['issues'].values())
    assert any(e['event'] == 'structured_feedback' for e in bus.events)
    snapshots = [e['state'] for e in bus.events if e['event'] == 'shared_state']
    assert snapshots[-1]['remaining_budget'] == 0
    assert len(snapshots) == 1  # replay coalesces source-heavy state projections
    assert snapshots[-1]['consumption']['model_calls'] == 8


def test_zero_budget_yields_pending_not_supported():
    task = dict(structured_state=state(), action_budget=0, structured_task_id='778', query='Atlas')
    result = asyncio.run(run_structured(task, EventBus(), FeedbackAdapter()))
    assert result['execution_status'] == 'partial'
    assert result['structured_state']['remaining_budget'] == 0
    assert all(q['verification_status'] == 'pending_verification' for q in result['structured_state']['issues'].values())


def test_graph_nodes_publish_on_the_owning_event_loop():
    import threading
    class ThreadCheckingBus(EventBus):
        def __init__(self):
            super().__init__()
            self.thread = threading.get_ident()
        def publish(self, event):
            assert threading.get_ident() == self.thread, 'asyncio queues must not be mutated by a graph executor thread'
            super().publish(event)
    async def execute():
        task = dict(structured_state=state(), action_budget=4, structured_task_id='779', query='Atlas')
        return await run_structured(task, ThreadCheckingBus(), FeedbackAdapter())
    assert asyncio.run(execute())['structured_state']['allocation']['spent_units'] == 4


def test_demo_proves_three_updates_one_stable_and_no_real_model_calls(monkeypatch, tmp_path):
    monkeypatch.setattr(runner, 'RUNS_DIR', tmp_path)
    api.RUNS.clear()
    with TestClient(api.app) as client:
        response = client.post('/research/demo', json=dict(action_budget=10))
        assert response.status_code == 200, response.text
        demo = response.json()
        t1, t2 = [x['structured_state'] for x in demo['snapshots']]
        assert all(q['status'] == 'reviewed' for q in t1['issues'].values())
        identity = next(q for q in t2['issues'].values() if q['axis'] == 'identity')
        assert identity['status'] == 'carried'
        assert identity['claims'][0]['update_status'] == 'retained'
        assert not any(a['issue_id'] == identity['id'] for a in t2['actions'])
        assert {t2['issues'][k]['axis'] for k in t2['affected']} == {'deployment', 'capability', 'risk'}
        comparison = next(q for q in t2['issues'].values() if q['axis'] == 'capability')['claims'][0]
        assert comparison['comparison']['comparable'] is False
        assert '不能' in comparison['text']
        assert t2['consumption']['model_calls'] == 0
        assert any(a.get('feedback') for a in t2['actions'])
        assert t2['evaluation']['link_availability']['value'] is None
        assert not list(tmp_path.glob('*.json'))  # samples isolated from ordinary reports
        assert len(list((tmp_path/'demos').glob('*.json'))) == 2
        tid = demo['snapshots'][1]['task_id']
        claim = identity['claims'][0]
        review = dict(question_id=identity['id'], claim_id=claim['id'], reviewer='Reviewer A', verdict='supported', score=5)
        assert client.post(f'/research/history/{tid}/reviews', json=review).status_code == 200
        other = client.post(f'/research/history/{tid}/reviews', json=dict(review, reviewer='Reviewer B', verdict='insufficient', resolution='需增加独立证据'))
        assert other.json()['evaluation']['disagreements'] == 1
        assert len(client.get(f'/research/history/{tid}').json()['structured_state']['human_reviews']) == 2
        assert client.get('/research/experiments').json()['items'] == []
        assert client.post('/research/preview', json=dict(parent_task_id=tid, focus='AtlasDemo')).status_code == 400


def test_request_configuration_and_query_snapshot_are_not_lost():
    with TestClient(api.app) as client:
        request = dict(query='Atlas', focus='Atlas', snapshot=[SIGNAL], scheduler_config=dict(alpha=2.5, beta_verify=1, ablations=['drop_c']), action_budget=4)
        response = client.post('/research/preview', json=request)
        assert response.status_code == 200
        graph = response.json()['structured_state']
        assert graph['signal_evidence']
        assert graph['scheduler_config']['alpha'] == 2.5
        assert client.post('/research/preview', json=dict(request, scheduler_config=dict(alpha=-1))).status_code == 422
        assert client.post('/research/preview', json=dict(request, action_budget=True)).status_code == 422
        contract = client.get('/research/contracts').json()
        assert contract['agent_roles'] == ['planner', 'researcher', 'verifier', 'integrator']
        assert 'failed' in contract['run_statuses'] and 'error' not in contract['run_statuses']
        for malformed in [[], {}, 123]:
            assert client.post('/research/preview', json=dict(task_type=malformed)).status_code == 422


def test_generated_types_match_python_contracts():
    root = Path(__file__).resolve().parents[2]
    subprocess.run([sys.executable, str(root/'scripts/export_contracts.py'), '--check'], check=True, capture_output=True)


def test_two_questions_in_same_dimension_are_distinct_and_ids_survive_correction():
    specs = [dict(axis='deployment', task_type='fact_check', question='显存需求是多少？'), dict(axis='deployment', task_type='fact_check', question='支持何种量化方式？')]
    graph = build_state('Atlas', 'fact_check', [SIGNAL], questions=specs)
    assert len(graph['issues']) == 2
    qid = next(iter(graph['issues']))
    posted_specs = [dict(id=q['id'], axis=q['axis'], task_type=q['task_type'], question=q['question']) for q in graph['issues'].values()]
    corrected = build_state('Atlas', 'fact_check', [SIGNAL], questions=posted_specs, manual_associations=[dict(evidence_key='https://example.org/atlas', object_name='Atlas', question_ids=[qid], reason='人工核对')])
    assert set(corrected['issues']) == set(graph['issues'])
    assert corrected['association']['matches'][0]['question_ids'] == [qid]


@pytest.mark.parametrize('payload', [dict(text='bad', comparison=[]), dict(text='bad', kind=['fact']), dict(text='bad', evidence_keys='url'), dict(text='bad', versions=dict(before='v1'))])
def test_malformed_nested_model_fields_are_recorded_without_false_support(payload):
    graph = state()
    qid = next(iter(graph['issues']))
    apply_research(graph, qid, dict(claims=[payload]), [evidence_record(SIGNAL)])
    assert not graph['issues'][qid]['claims']
    assert graph['issues'][qid]['rejected_outputs']


def test_partial_review_preserves_supported_claim_and_pending_claim_separately():
    graph = state()
    qid = next(iter(graph['issues']))
    claims = [dict(text=text, conditions='v1', evidence_keys=['https://example.org/atlas']) for text in ['supported claim', 'unresolved claim']]
    apply_research(graph, qid, dict(claims=claims), [evidence_record(SIGNAL)])
    apply_review(graph, qid, dict(checks=[dict(index=0, verdict='supported'), dict(index=1, verdict='insufficient')]))
    assert [c['status'] for c in graph['issues'][qid]['claims']] == ['supported', 'insufficient']
    assert graph['issues'][qid]['status'] == 'unresolved'


def test_failed_or_cancelled_runs_cannot_contaminate_parent_or_reports(monkeypatch, tmp_path):
    monkeypatch.setattr(runner, 'RUNS_DIR', tmp_path)
    for status in ('failed', 'cancelled'):
        tid = '910' if status == 'failed' else '911'
        runner.save_run(dict(engine='structured'), dict(task_id=tid, report='MUST NOT BE A REPORT', structured_state=state()), [], status=status)
        record = runner.load_run(tid)
        assert record['report'] is None
        assert not (tmp_path/f'{tid}.md').exists()
        with TestClient(api.app) as client:
            assert client.post('/research/preview', json=dict(focus='Atlas', parent_task_id=tid)).status_code == 400


def test_http_cancellation_persists_terminal_state_and_charged_actions(monkeypatch, tmp_path):
    import time
    class Blocking(FeedbackAdapter):
        async def search(self, query):
            await asyncio.sleep(60)
    async def execute(task, bus):
        return await run_structured(task, bus, Blocking())
    monkeypatch.setattr(runner, 'RUNS_DIR', tmp_path)
    monkeypatch.setattr(api, 'run_structured', execute)
    api.RUNS.clear()
    with TestClient(api.app) as client:
        created = client.post('/research', json=dict(focus='Atlas', snapshot=[SIGNAL], action_budget=2)).json()
        rid = created['run_id']
        assert client.post(f'/research/{rid}/cancel').status_code == 200
        for _ in range(100):
            detail = client.get(f'/research/{rid}').json()
            if detail['status'] == 'cancelled': break
            time.sleep(.01)
        assert detail['status'] == 'cancelled' and not detail['report']
        record = runner.load_run(detail['task_id'])
        assert record['status'] == 'cancelled' and record['report'] is None
        graph = record['structured_state']
        assert graph['run_status'] == 'cancelled'
        assert graph.get('allocation', {}).get('spent_units', 0) == sum(a['unit_cost'] for a in graph.get('actions', []))
        assert 'stream_end' in client.get(f'/research/{rid}/events').text


def test_rate_limit_is_logged_and_fallback_is_bounded(monkeypatch):
    import httpx
    from service import search_gateway
    async def limited(query):
        request = httpx.Request('GET', 'https://api.openalex.org/works')
        raise httpx.HTTPStatusError('limited', request=request, response=httpx.Response(429, request=request))
    async def fallback(query): return [dict(href='https://example.org/proof', body='actual search record')]
    monkeypatch.setenv('RETRIEVER', 'openalex')
    monkeypatch.setenv('RESEARCH_SEARCH_FALLBACK', 'duckduckgo')
    monkeypatch.setattr(search_gateway, 'openalex', limited)
    monkeypatch.setattr(search_gateway, 'duckduckgo', fallback)
    metrics = dict(retriever_calls=0)
    records = asyncio.run(search_gateway.search('query', None, metrics))
    assert records and metrics['retriever_calls'] == 2
    assert metrics['retrieval_attempts'][0]['http_status'] == 429
    async def empty(query): return []
    monkeypatch.setattr(search_gateway, 'duckduckgo', empty)
    with pytest.raises(RuntimeError, match='429'):
        asyncio.run(search_gateway.search('query', None, dict(retriever_calls=0)))


def test_experiment_fixtures_are_isolated_by_snapshot(tmp_path):
    import experiment
    first, second = tmp_path/'t1.json', tmp_path/'t2.json'
    first.write_text(json.dumps([dict(SIGNAL, summary='old release')]), encoding='utf-8')
    second.write_text(json.dumps([dict(SIGNAL, summary='new release')]), encoding='utf-8')
    with pytest.raises(ValueError, match='T2'):
        experiment.load_fixtures([str(first)], 2)
    fixtures = experiment.load_fixtures([str(first), str(second)], 2)
    assert fixtures[0][0]['summary'] == 'old release'
    assert fixtures[1][0]['summary'] == 'new release'
    assert experiment.terminal_status('failed') == 'failed'
    with pytest.raises(ValueError):
        experiment.terminal_status('unexpected')


def test_experiment_failed_arm_stops_before_creating_a_parent(monkeypatch, tmp_path):
    import experiment
    from types import SimpleNamespace
    snapshot = tmp_path/'snapshot.json'
    snapshot.write_text(json.dumps([SIGNAL]), encoding='utf-8')
    calls, saved = [], []
    async def fail(task, bus, adapter):
        calls.append(task)
        task['structured_state']['experiment'] = {}
        return dict(execution_status='failed', structured_state=task['structured_state'], report=None)
    monkeypatch.setattr(experiment, 'run_structured', fail)
    monkeypatch.setattr(experiment, 'save_run', lambda task, result, events, status: saved.append(status))
    args = SimpleNamespace(alpha=[4], beta_verify=[2], beta_risk=[1], weights=[1,1,1], ablation=['none'],
                           budget=[4], repeats=1, mode=['adaptive'], demo=False, snapshot=[str(snapshot), str(snapshot)],
                           focus='Atlas', evidence_fixture=None, output=str(tmp_path/'results'),
                           association_mode='structured', task_type='fact_check', time_scope='')
    asyncio.run(experiment.execute(args))
    assert len(calls) == 1
    assert saved == ['failed']
    rows = json.loads((tmp_path/'results/matrix.json').read_text(encoding='utf-8'))
    assert rows[0]['status'] == 'failed'


def test_full_recheck_preview_and_execution_share_priority_and_pending_states():
    parent = asyncio.run(run_structured(dict(structured_state=state(), action_budget=8, structured_task_id='880', query='Atlas'), EventBus(), FeedbackAdapter()))['structured_state']
    graph = build_state('Atlas', 'fact_check', [SIGNAL], parent=parent)
    assert not graph['affected']
    preview_options = deepcopy(action_options(graph, 'full'))
    assert set(graph['affected']) == set(graph['issues'])
    assert all(c['status'] == 'pending_verification' for q in graph['issues'].values() for c in q['claims'])
    result = asyncio.run(run_structured(dict(structured_state=graph, action_budget=4, scheduler_mode='full', structured_task_id='881', query='Atlas'), EventBus(), FeedbackAdapter()))
    assert result['structured_state']['allocation']['candidates'] == preview_options
    assert all(reasons.count('full_recheck_policy') == 1 for reasons in graph['impact_reasons'].values())


def test_cli_preserves_query_snapshot_and_returns_canonical_failure(monkeypatch, tmp_path):
    import run_task as cli
    from types import SimpleNamespace
    from service import signals, structured_workflow
    monkeypatch.setattr(runner, 'RUNS_DIR', tmp_path)
    monkeypatch.setattr(signals, 'load_signals', lambda _: ([SIGNAL], {}))
    args = SimpleNamespace(snapshot='fixture', query='Atlas', engine='structured', focus='Atlas', categories=None,
                           top=10, max_sections=3, total_words=1500, task_type='fact_check', action_budget=2,
                           mode='adaptive', association_mode='keyword', time_scope='', parent_task_id=None,
                           signals_only=True, json=True)
    code, preview = asyncio.run(cli.run(args))
    assert code == 0 and preview['structured_state']['signal_evidence']
    async def fail(task, bus):
        return dict(task_id=task['structured_task_id'], execution_status='failed', report=None, structured_state=task['structured_state'])
    monkeypatch.setattr(structured_workflow, 'run_structured', fail)
    args.signals_only = False
    code, result = asyncio.run(cli.run(args))
    assert code == 1 and result['status'] == 'failed'
    record = runner.load_run(result['task_id'])
    assert record['status'] == 'failed' and record['report'] is None


def test_content_support_does_not_count_one_claim_as_multiple_verified_relations():
    from service.evaluation import evaluate
    graph = state()
    first = next(iter(graph['issues'].values()))
    first['claims'] = [dict(text='supported', status='supported', evidence_keys=['a', 'b', 'c']),
                       dict(text='pending', status='pending_verification', evidence_keys=[])]
    metric = evaluate(graph)['content_support']
    assert metric['numerator'] == 1 and metric['denominator'] == 2
