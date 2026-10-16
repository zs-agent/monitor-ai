import asyncio
from copy import deepcopy
import json
import time
from fastapi.testclient import TestClient
import pytest
from service.research_state import build_state, apply_research, apply_review, evidence_record, action_options, allocate
from service.structured_workflow import run_structured
from service.runner import EventBus
from service import app as api, runner
from service.signals import build_task_from_query, load_signals, select_signals

SIGNAL = dict(title='Atlas model benchmark', summary='Atlas model capability', sourceUrl='https://example.org/atlas', publishedAt='2026-10-01')

def make_task(state, budget=4, mode='adaptive'):
    return dict(structured_state=state, structured_task_id='123456', action_budget=budget, scheduler_mode=mode, query='Atlas')

class Adapter:
    async def search(self, query): return [evidence_record(SIGNAL)]
    async def generate(self, role, payload):
        return dict(claims=[dict(text='Atlas finding', conditions='v1 controlled test', comparison=dict(dimension='capability', conditions='same test', comparable=True), source_urls=['https://example.org/atlas'])]) if role == 'research' else dict(checks=[dict(index=0, verdict='supported')])

def test_cross_source_dedup_and_explainability():
    signals = [SIGNAL, dict(SIGNAL, sourceUrl='https://example.org/atlas?utm_campaign=x'), dict(SIGNAL, sourceUrl='https://copy.org/repost')]
    state = build_state('Atlas', 'fact_check', signals)
    reasons = [r['reason'] for r in state['association']['cleaning']]
    assert reasons == ['accepted', 'duplicate_url', 'duplicate_content']
    assert state['association']['matches'][0]['score'] > 0
    assert not state['association']['matches'][1]['question_ids']
    assert state['dependency_graph']['R']

@pytest.mark.parametrize('malformed', [None, 'text', {}, 1])
def test_malformed_arrays_rejected(malformed):
    state = build_state('Atlas', 'fact_check', [SIGNAL])
    q = next(iter(state['issues']))
    with pytest.raises(ValueError): apply_research(state, q, dict(claims=malformed), [])
    with pytest.raises(ValueError): apply_review(state, q, dict(checks=malformed))

def test_inline_hallucination_and_empty_evidence_rejected():
    state = build_state('Atlas', 'fact_check', [SIGNAL])
    q = next(iter(state['issues']))
    apply_research(state, q, dict(claims=[dict(text='see https://fake.org/claim', source_urls=['https://example.org/atlas','https://fake.org/claim'])]), [evidence_record(SIGNAL)])
    claim = state['issues'][q]['claims'][0]
    assert 'https://fake.org' not in claim['text']
    assert claim['rejected_sources'] == ['https://fake.org/claim']
    assert claim['evidence_keys'] == ['https://example.org/atlas']

def test_cancelled_action_is_charged_and_parent_isolated():
    class Slow(Adapter):
        def __init__(self, started): self.started = started
        async def search(self, query):
            self.started.set()
            await asyncio.sleep(20)
    async def run():
        parent = build_state('Atlas', 'fact_check', [SIGNAL])
        before = deepcopy(parent)
        task = make_task(parent)
        started = asyncio.Event()
        job = asyncio.create_task(run_structured(task, EventBus(), Slow(started)))
        await asyncio.wait_for(started.wait(), 2)
        job.cancel()
        with pytest.raises(asyncio.CancelledError): await job
        assert task['structured_state']['allocation']['spent_units'] == 1
        assert task['structured_state']['actions'][0]['outcome'] == 'cancelled'
        assert parent == before
    asyncio.run(run())

def test_failed_research_never_verifies_historical_claims():
    class Broken(Adapter):
        async def search(self, query): raise RuntimeError('offline')
    parent = build_state('Atlas', 'fact_check', [SIGNAL])
    for q in parent['issues']:
        apply_research(parent,q,dict(claims=[dict(text='old',source_urls=['https://example.org/atlas'])]),[evidence_record(SIGNAL)])
        apply_review(parent,q,dict(checks=[dict(index=0,verdict='supported')]))
    state = build_state('Atlas','fact_check',[],parent)
    result = asyncio.run(run_structured(make_task(state), EventBus(), Broken()))
    assert all(c['status'] == 'pending_verification' for q in result['structured_state']['issues'].values() for c in q['claims'])
    assert any(a['outcome'] == 'skipped_no_new_claims' for a in result['structured_state']['actions'])

def test_baselines_same_budget_and_stable_incremental_zero_calls():
    async def run():
        state = build_state('Atlas','object_comparison',[SIGNAL])
        parent = (await run_structured(make_task(state, 6),EventBus(),Adapter()))['structured_state']
        stable = build_state('Atlas','object_comparison',[SIGNAL], parent)
        assert not stable['affected']
        for mode in ['adaptive','fixed','single','full']:
            result = await run_structured(make_task(stable,2,mode),EventBus(),Adapter())
            graph = result['structured_state']
            assert graph['allocation']['spent_units'] <= 2
            if mode != 'full': assert not graph['actions']
            else: assert graph['actions']
        single = await run_structured(make_task(state,6,'single'),EventBus(),Adapter())
        assert all(a['kind'] == 'research' for a in single['structured_state']['actions'])
    asyncio.run(run())

def test_api_empty_snapshot_taxonomy_and_experiment_log(monkeypatch,tmp_path):
    monkeypatch.setattr(runner,'RUNS_DIR',tmp_path)
    api.RUNS.clear()
    with TestClient(api.app) as client:
        payload=dict(focus='Atlas',snapshot=[],task_type='dynamic_analysis',action_budget=0)
        preview=client.post('/research/preview',json=payload)
        assert preview.status_code == 200
        assert preview.json()['structured_state']['task_type'] == 'dynamic_analysis'
        response=client.post('/research',json=payload)
        rid=response.json()['run_id']
        for _ in range(100):
            record=client.get('/research/'+rid).json()
            if record['status']!='running': break
            time.sleep(.01)
        assert record['status']=='partial'
        path=tmp_path/'experiments'/f"{record['task_id']}.json"
        assert json.loads(path.read_text(encoding='utf-8'))['action_budget']==0
        # A subscriber joining after completion must get a terminal stream.
        stream=client.get('/research/'+rid+'/events')
        assert 'stream_end' in stream.text

def test_invalid_signals_do_not_crash_selection_and_missing_snapshot(tmp_path):
    assert load_signals(tmp_path/'missing.json') == ([],None)
    assert select_signals([None,dict(SIGNAL,credibility='bad'),dict(SIGNAL,credibility=5)])

def test_bounded_bus():
    bus=EventBus(2)
    queue=bus.subscribe()
    for i in range(10): bus.publish(dict(output=i))
    assert len(bus.events)==2 and queue.qsize()==2
    assert bus.events[-1]['sequence']==10

def test_persistence_failure_is_terminal(monkeypatch):
    def broken(*args, **kwargs): raise OSError('disk full')
    monkeypatch.setattr(api, 'save_run', broken)
    record=dict(task={},result={},status='done',error=None,bus=EventBus())
    api._persist_terminal(record)
    assert record['status']=='failed'
    assert record['bus'].events[-1]['event']=='failed'

def test_restart_marks_provisional_run_interrupted(monkeypatch,tmp_path):
    monkeypatch.setattr(runner,'RUNS_DIR',tmp_path)
    path=tmp_path/'123.json'
    path.write_text(json.dumps(dict(task_id='123',status='running')),encoding='utf-8')
    with TestClient(api.app):
        record=json.loads(path.read_text(encoding='utf-8'))
        assert record['status']=='failed' and '中断' in record['error']

@pytest.mark.parametrize('address', ['127.0.0.1', '10.0.0.2', '169.254.169.254', '::1'])
def test_private_evidence_hosts_blocked(monkeypatch,address):
    from service import safe_sources
    monkeypatch.setattr(safe_sources.socket,'getaddrinfo',lambda *args: [(2,1,6,'',(address,443))])
    assert not asyncio.run(safe_sources.public_url('https://example.test/source'))

def test_association_ablation_is_explicit():
    unrelated=dict(SIGNAL,title='Other platform',summary='Unrelated release')
    structured=build_state('Atlas','fact_check',[unrelated])
    unfiltered=build_state('Atlas','fact_check',[unrelated],association_mode='unfiltered')
    assert not any(m['question_ids'] for m in structured['association']['matches'])
    assert all(m['question_ids'] for m in unfiltered['association']['matches'])
    assert unfiltered['association_mode']=='unfiltered'

def test_changed_source_preserves_cited_original_version():
    parent=build_state('Atlas','fact_check',[SIGNAL])
    q=next(iter(parent['issues']))
    e=evidence_record(SIGNAL)
    apply_research(parent,q,dict(claims=[dict(text='original finding',source_urls=[e['url']])]),[e])
    apply_review(parent,q,dict(checks=[dict(index=0,verdict='supported')]))
    newer=dict(SIGNAL,summary='Atlas new model capability')
    state=build_state('Atlas','fact_check',[newer],parent)
    claim=state['issues'][q]['claims'][0]
    assert claim['evidence_fingerprints'][e['key']]==e['fingerprint']
    assert state['evidence_versions'][e['key']][e['fingerprint']]['content']==e['content']
    assert claim['status']=='pending_verification'
    conflict=build_state('Atlas','fact_check',[SIGNAL,newer],parent)
    assert conflict['association']['conflicting_versions']==[e['key']]
    assert e['key'] in conflict['delta']['changed']

def test_structured_comparison_headings_not_rewritten_as_legacy_layout(monkeypatch,tmp_path):
    monkeypatch.setattr(runner,'RUNS_DIR',tmp_path)
    state=build_state('AtlasComparisonLongName','object_comparison',[])
    result=asyncio.run(run_structured(make_task(state,0),EventBus(),Adapter()))
    runner.save_run(dict(engine='structured'),result,[],status='partial')
    with TestClient(api.app) as client:
        record=client.get('/research/history/'+str(result['task_id'])).json()
        assert record['report']==result['report']
        assert (tmp_path/f"{result['task_id']}.md").read_text(encoding='utf-8')==result['report']
        assert '## 引言' not in record['report'] and '## 目录' not in record['report']
