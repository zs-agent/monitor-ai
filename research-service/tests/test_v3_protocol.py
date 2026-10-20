import asyncio
from copy import deepcopy
from datetime import datetime, timezone
from itertools import product
import random
import pytest
from service.contracts import SchedulerConfig
from service.research_state import build_state, action_options, allocate, allocate_greedy, schedule, evidence_record, apply_research, apply_review
from service.structured_workflow import run_structured
from service.runner import EventBus
from service.source_refresh import refresh_cited_sources
from service.manual_evaluation import make_template, validation_errors, summarize, recheck_ids


def graph(kind='fact_check', critical=False, rows=None):
    return build_state('Atlas',kind,rows or [],questions=[dict(id='a',axis='capability',question='Atlas capability?',task_type=kind,critical=critical)])


def test_v3_formula_legacy_and_critical():
    for kind,beta in zip(('fact_check','object_comparison','dynamic_analysis','risk_assessment'),(2,4,4,8)):
        state=graph(kind); options=action_options(state)['a']
        assert options[2]['utility']-options[1]['utility']==beta
        assert action_options(state,'fixed')['a'][2]['utility']==6
        assert action_options(state,config=dict(ablations=['drop_t']))['a'][2]['utility']==14
    critical=graph('risk_assessment',True)
    assert [o['kind'] for o in action_options(critical)['a']]==['defer','research_and_verify']
    assert not schedule(critical,'adaptive',1)['selected']
    assert SchedulerConfig.model_validate(dict(beta_verify=5)).utility_profile=='legacy_v2'


def test_integer_reserve_and_exact_tie_oracle():
    state=graph()
    assert schedule(state,'adaptive',8,dict(reserve_ratio=.1))['reserve_units']==1
    assert schedule(state,'adaptive',1,dict(reserve_units=8))['initial_budget']==0
    options={k:[dict(kind='defer',cost=0,utility=0),dict(kind='research',cost=1,utility=4),dict(kind='research_and_verify',cost=2,utility=6)] for k in ('b','a')}
    result=allocate(options,1)
    assert result['selected'][0]['issue_id']=='a'
    assert allocate({'a':[dict(kind='research',cost=1,utility=4),dict(kind='research_and_verify',cost=2,utility=4)]},2)['reserved_units']==1
    rng=random.Random(5)
    for _ in range(30):
        opts={k:[dict(kind='defer',cost=0,utility=0),dict(kind='research',cost=1,utility=rng.randint(1,9)),dict(kind='research_and_verify',cost=2,utility=rng.randint(10,20))] for k in ('c','a','b')}
        for budget in range(7):
            brute=max(sum(o['utility'] for o in row) for row in product(*opts.values()) if sum(o['cost'] for o in row)<=budget)
            assert allocate(opts,budget)['proxy_utility']==brute
            assert allocate_greedy(opts,budget)['reserved_units']<=budget


def test_greedy_has_real_algorithmic_difference():
    opts={'a':[dict(kind='defer',cost=0,utility=0),dict(kind='research_and_verify',cost=2,utility=11)],
          'b':[dict(kind='defer',cost=0,utility=0),dict(kind='research',cost=1,utility=6)]}
    assert allocate(opts,2)['proxy_utility']==11
    assert allocate_greedy(opts,2)['proxy_utility']==6


def test_alias_version_dimensions_and_repost_coverage():
    rows=[dict(url='https://example.org/a',title='阿特拉斯 v2.0 model',content='阿特拉斯 v2.0 model deployment',retrieval_level='full_text'),
          dict(url='https://example.org/b',title='reposted',content='阿特拉斯 v2.0 model deployment',retrieval_level='full_text')]
    cfg=dict(aliases={'Atlas':['阿特拉斯']},expected_versions=['v2.0'])
    state=build_state('Atlas','fact_check',rows,association_mode='jaccard',association_config=cfg)
    assert state['association']['matches'][0]['question_ids']
    assert state['association']['matches'][1]['duplicate_of']=='https://example.org/a'
    action_options(state)
    assert all(q['features']['c']==1 for q in state['issues'].values())
    wrong=build_state('Atlas','fact_check',rows,association_config=dict(cfg,expected_versions=['v1.0']))
    assert not any(a['question_ids'] for a in wrong['association']['matches'])
    hybrid=build_state('Atlas','fact_check',rows,association_mode='hybrid',association_config=cfg,semantic_scores={**{r['url']:.8 for r in rows}, '__dimensions__': {r['url']:{'capability':.8,'deployment':.8} for r in rows}})
    assert hybrid['association']['matches'][0]['semantic_score']==.9
    with pytest.raises(ValueError): build_state('Atlas','fact_check',rows,association_mode='hybrid')


def test_refresh_failure_keeps_history_and_cannot_support():
    state=graph(); e=evidence_record(dict(url='https://example.org/a',content='Atlas model capability',retrieval_level='full_text'))
    apply_research(state,'a',dict(claims=[dict(text='Atlas fact',conditions='v1',evidence_keys=[e['key']])]),[e]); apply_review(state,'a',dict(checks=[dict(index=0,verdict='supported')]))
    original=deepcopy(state)
    async def failed(url,cached=None): raise OSError('offline')
    rows,checks=asyncio.run(refresh_cited_sources(state,[],failed))
    assert not rows and checks[0]['outcome']=='unavailable' and state==original
    state['source_refresh']=checks
    apply_review(state,'a',dict(checks=[dict(index=0,verdict='supported')]))
    assert state['issues']['a']['claims'][0]['status']=='insufficient'
    async def changed(url,cached=None): return dict(raw_content='Atlas model changed fact')
    rows,checks=asyncio.run(refresh_cited_sources(original,[],changed))
    current=build_state('Atlas','fact_check',rows,original)
    assert e['key'] in current['delta']['changed']


class Adapter:
    async def search(self,query): return [evidence_record(dict(url='https://example.org/a',content='Atlas model capability',retrieval_level='full_text'))]
    async def generate(self,role,payload):
        return dict(claims=[dict(text='Atlas fact',conditions='v1',evidence_keys=['https://example.org/a'])]) if role=='research' else dict(checks=[dict(index=0,verdict='contradicted',reason='counterevidence')])


def test_feedback_one_unit_cannot_replace_missing_research():
    task=dict(structured_state=graph(),action_budget=3,structured_task_id='v3',scheduler_config=dict(reserve_units=1))
    result=asyncio.run(run_structured(task,EventBus(),Adapter()))
    state=result['structured_state']
    assert state['allocation']['spent_units']==2
    decision=state['feedback_decisions'][-1]
    assert decision['action']=='pending' and decision['required_cost']==2 and decision['available']==1
    assert all(not a.get('feedback') for a in state['actions'])


def test_blinded_fixed_slots_no_answer_and_recheck():
    types=('fact_check','object_comparison','dynamic_analysis','risk_assessment')
    plan=[dict(id=str(i),object_id=str(i//2),task_type=t) for i,t in enumerate(types*2)]
    sheet,key=make_template(plan,[],123)
    assert len(sheet['answers'])==24 and all(not a['answered'] for a in sheet['answers'])
    assert all('method' not in a for a in sheet['answers'])
    assert not validation_errors(sheet,True)
    result=summarize(sheet,key)
    assert result['methods']['adaptive']['all']['effective_coverage']==0
    assert result['methods']['adaptive']['all']['content_support'] is None
    answer=sheet['answers'][0]
    answer['facts']=[dict(fact_id='f',text='uncited fact',source_keys=[],confirmed_split=True,initial=dict(verdict='supported',location='none',reviewed_at='2026-10-01T00:00:00+00:00'))]
    assert validation_errors(sheet,True)
    assert recheck_ids(sheet,1,datetime(2026,10,5,tzinfo=timezone.utc))==[]
    assert recheck_ids(sheet,1,datetime(2026,10,9,tzinfo=timezone.utc))==['f']


def test_conditional_304_uses_only_acquired_body(monkeypatch):
    from service import safe_sources
    async def resolve(url): return ['8.8.8.8']
    seen=[]
    async def download(url, addresses, headers=None):
        seen.append(headers)
        return 304,{},b''
    monkeypatch.setattr(safe_sources,'resolve_public_url',resolve)
    monkeypatch.setattr(safe_sources,'_download_once',download)
    cached=dict(content='previously acquired body',retrieval_level='full_text',etag='abc')
    result=asyncio.run(safe_sources.fetch_source('https://example.org/a',cached))
    assert result['not_modified'] and result['raw_content']==cached['content']
    assert seen[0]['If-None-Match']=='abc'
    with pytest.raises(safe_sources.SourceAccessError):
        asyncio.run(safe_sources.fetch_source('https://example.org/a',dict(content='snippet',etag='abc')))


def test_frozen_adapter_never_fetches_network_and_current_slice_only():
    from experiment import FrozenAdapter
    records=[evidence_record(dict(url='https://example.org/t1',content='T1 body',retrieval_level='frozen_source'))]
    result=asyncio.run(FrozenAdapter(records).search_with_sources('q',[dict(url='https://example.org/t2')]))
    assert [r['key'] for r in result]==['https://example.org/t1']


def test_refresh_cancellation_records_started_requests():
    state=graph(); e=evidence_record(dict(url='https://example.org/a',content='Atlas model',retrieval_level='full_text'))
    apply_research(state,'a',dict(claims=[dict(text='Atlas fact',conditions='v1',evidence_keys=[e['key']])]),[e])
    checks=[]
    async def cancelled(url,cached=None): raise asyncio.CancelledError()
    with pytest.raises(asyncio.CancelledError): asyncio.run(refresh_cited_sources(state,[],cancelled,checks))
    assert checks[0]['outcome']=='cancelled' and checks[0]['requests']==1


def test_full_original_survives_304_without_false_body_diff():
    body='Atlas model release '+('original body '*1800)
    record=evidence_record(dict(url='https://example.org/a',content=body,retrieval_level='full_text'))
    assert record['content']==body and len(body)>12000
    state=graph(rows=[record])
    apply_research(state,'a',dict(claims=[dict(text='Atlas fact',conditions='v1',evidence_keys=[record['key']])]),[record])
    apply_review(state,'a',dict(checks=[dict(index=0,verdict='supported')]))
    async def unchanged(url,cached=None): return dict(raw_content=cached['content'],not_modified=True)
    rows,checks=asyncio.run(refresh_cited_sources(state,[],unchanged))
    current=build_state('Atlas','fact_check',rows,state)
    assert current['delta']['stable']==[record['key']] and not current['delta']['changed']


def test_missing_source_sets_n_and_snippet_never_counts_coverage():
    row=dict(url='https://example.org/a',title='Atlas model',summary='Atlas model capability')
    state=graph(rows=[row]); action_options(state)
    assert state['issues']['a']['features']['c']==0
    e=evidence_record(dict(row,content='Atlas original body',retrieval_level='full_text'))
    apply_research(state,'a',dict(claims=[dict(text='Atlas fact',conditions='v1',evidence_keys=[e['key']])]),[e])
    apply_review(state,'a',dict(checks=[dict(index=0,verdict='supported')]))
    missing=build_state('Atlas','fact_check',[],state)
    action_options(missing)
    assert missing['issues']['a']['features']['n']==1
    assert missing['issues']['a']['features']['c']==0


def test_skipped_review_releases_budget_for_complete_retry():
    class Recover(Adapter):
        attempts=0
        async def search(self,query):
            self.attempts+=1
            if self.attempts==1: raise RuntimeError('first retrieval failed')
            return await super().search(query)
        async def generate(self,role,payload):
            if role=='review': return dict(checks=[dict(index=0,verdict='supported',reason='fetched original')])
            return await super().generate(role,payload)
    result=asyncio.run(run_structured(dict(structured_state=graph(),action_budget=4,structured_task_id='retry',scheduler_config=dict(reserve_units=0)),EventBus(),Recover()))
    assert result['execution_status']=='completed'
    assert result['structured_state']['allocation']['spent_units']==3
    assert sum(a.get('feedback',False) for a in result['structured_state']['actions'])==2


def test_common_parent_frozen_protocol_and_labels_never_enter_prompt(monkeypatch,tmp_path):
    import json
    import experiment
    from types import SimpleNamespace
    e=evidence_record(dict(url='https://example.org/a',title='Atlas model',content='Atlas model old body',retrieval_level='frozen_source'))
    parent=graph(rows=[e])
    apply_research(parent,'a',dict(claims=[dict(text='T1 finding',conditions='v1',evidence_keys=[e['key']])]),[e])
    apply_review(parent,'a',dict(checks=[dict(index=0,verdict='supported')]))
    parent['run_status']='done'
    paths={name:tmp_path/(name+'.json') for name in ('parent','snapshot','fixture','questions','labels')}
    data=dict(parent=parent,snapshot=[dict(url=e['url'],title='Atlas model',content='Atlas model new body')],
              fixture=[dict(url=e['url'],title='Atlas model',content='Atlas model new body')],
              questions=[dict(id='a',axis='capability',question='Atlas capability?',task_type='fact_check')],labels=dict(expected_update_ids=['a'],secret_label='DO_NOT_SEND'))
    for name,path in paths.items(): path.write_text(json.dumps(data[name]),encoding='utf-8')
    seen=[]
    class Controlled(experiment.FrozenAdapter):
        async def generate(self,role,payload):
            assert 'DO_NOT_SEND' not in json.dumps(payload)
            return dict(claims=[dict(text='T2 finding',conditions='v2',evidence_keys=[e['key']])]) if role=='research' else dict(checks=[dict(index=0,verdict='supported')])
    monkeypatch.setattr(experiment,'FrozenAdapter',Controlled)
    monkeypatch.setattr(experiment,'save_run',lambda task,result,events,status:seen.append(result))
    args=SimpleNamespace(alpha=[4],beta_verify=[2],beta_risk=[1],weights=[1,1,1],ablation=['none'],budget=[3],repeats=1,mode=['adaptive','full'],demo=False,snapshot=[str(paths['snapshot'])],focus='Atlas',
        evidence_fixture=[str(paths['fixture'])],output=str(tmp_path/'out'),association_mode='structured',task_type='fact_check',time_scope='',
        questions=str(paths['questions']),labels=str(paths['labels']),parent=str(paths['parent']))
    asyncio.run(experiment.execute(args))
    assert len(seen)==2
    assert len({r['structured_state']['experiment']['common_parent_hash'] for r in seen})==1
    assert all(r['structured_state']['source_refresh_policy']=='frozen_input_stability_only' for r in seen)
    assert parent['issues']['a']['claims'][0]['text']=='T1 finding'


def test_formal_experiment_rejects_integer_reserve_above_budget(tmp_path):
    import experiment
    from types import SimpleNamespace
    args=SimpleNamespace(alpha=[4],beta_verify=[2],beta_risk=[1],weights=[1,1,1],ablation=['none'],
        budget=[2],reserve_units=3,repeats=1,mode=['adaptive'],demo=True,output=str(tmp_path))
    with pytest.raises(ValueError,match='整数预留不得大于'):
        asyncio.run(experiment.execute(args))
    assert not list(tmp_path.iterdir())  # Rejected before any experiment executes.
