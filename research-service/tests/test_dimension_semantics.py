"""Deterministic vector fixtures validate mechanisms, not external service quality."""
import asyncio
import json
from types import SimpleNamespace
from service import semantic
from service.research_state import build_state, AXIS_DESCRIPTIONS
from service.structured_workflow import ResearchAdapter


QUESTIONS=[dict(id='deployment',axis='deployment',task_type='fact_check',question='Atlas hardware?'),
           dict(id='risk',axis='risk',task_type='risk_assessment',question='Atlas weaknesses?')]


def score_fixture(rows, object_cos=1, deployment_cos=0, risk_cos=1):
    return {**{r['url']:object_cos for r in rows}, '__dimensions__': {r['url']:{'deployment':deployment_cos,'risk':risk_cos} for r in rows}}


def test_actual_embedding_adapter_embeds_dimensions_separately(monkeypatch):
    monkeypatch.setenv('ASSOCIATION_EMBEDDING_URL','https://example.org/embeddings')
    monkeypatch.setenv('ASSOCIATION_EMBEDDING_MODEL','deterministic-unit-vectors')
    from service import safe_sources
    async def public(url): return True
    monkeypatch.setattr(safe_sources,'public_url',public)
    calls=[]
    vectors=[[1,0,0],[0,1,0],[0,1,0],[0,0,1],[0,-1,0],[1,0,0],[1,0,0]]
    class Response:
        def raise_for_status(self): pass
        def json(self): return dict(data=[dict(index=i,embedding=v) for i,v in enumerate(vectors)],usage=dict(prompt_tokens=10))
    class Client:
        def __init__(self,**kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def post(self,url,headers,json): calls.append(json); return Response()
    monkeypatch.setattr(semantic.httpx,'AsyncClient',Client)
    rows=[dict(url='https://example.org/a',title='Atlas susceptible to hostile prompts',summary='Atlas vulnerable to jailbreaks.')]
    scores=asyncio.run(semantic.semantic_scores('Atlas',rows))
    assert len(calls[0]['input'])==7
    assert all(description in calls[0]['input'] for description in AXIS_DESCRIPTIONS.values())
    assert scores['__dimensions__'][rows[0]['url']]['deployment']==0
    assert scores['__dimensions__'][rows[0]['url']]['risk']==1
    for mode in ('semantic','hybrid'):
        state=build_state('Atlas','fact_check',rows,association_mode=mode,questions=QUESTIONS,semantic_scores=scores)
        match=state['association']['matches'][0]
        assert match['dimension_hits']['risk']==[]  # Semantic mode needs no keyword hit.
        assert match['question_ids']==['risk']
        assert match['dimension_semantic_scores']['risk']==1
        assert match['dimension_semantic_scores']['deployment']==.5
    assert not build_state('Atlas','fact_check',rows,questions=QUESTIONS)['association']['matches'][0]['question_ids']


def test_semantic_recall_ablation_has_real_candidate_effect():
    text='Atlas '+ ' '.join('term'+str(i) for i in range(120))
    rows=[dict(url='https://example.org/a',title='Atlas',content=text)]
    scores=score_fixture(rows)
    state=build_state('Atlas','fact_check',rows,association_mode='hybrid',questions=QUESTIONS,semantic_scores=scores)
    match=state['association']['matches'][0]
    assert match['lexical_candidate'] is False and match['semantic_candidate'] is True
    assert match['question_ids']==['risk']
    ablated=build_state('Atlas','fact_check',rows,association_mode='hybrid',questions=QUESTIONS,semantic_scores=scores,association_config=dict(semantic_recall=False))
    assert not ablated['association']['matches'][0]['question_ids']


def test_neutral_semantics_and_known_wrong_object_never_mount():
    rows=[dict(url='https://example.org/a',title='AI model security risk',content='AI security risk')]
    state=build_state('Atlas AI','fact_check',rows,association_mode='hybrid',questions=QUESTIONS,semantic_scores=score_fixture(rows,object_cos=0))
    assert not state['association']['matches'][0]['question_ids']
    wrong=[dict(url='https://example.org/b',title='Beta model security risk',content='Beta model security risk')]
    cfg=dict(aliases={'Atlas':['阿特拉斯'],'Beta':['贝塔']})
    for mode in ('keyword','jaccard','semantic','hybrid'):
        state=build_state('Atlas','fact_check',wrong,association_mode=mode,questions=QUESTIONS,
                          semantic_scores=score_fixture(wrong) if mode in ('semantic','hybrid') else None,association_config=cfg)
        assert state['association']['matches'][0]['reason']=='object_mismatch'
        assert not state['association']['matches'][0]['question_ids']
        same_version=[dict(wrong[0],title='Beta v2 model security risk',content='Beta v2 model security risk')]
        versioned=build_state('Atlas v2','fact_check',same_version,association_mode=mode,questions=QUESTIONS,
                             semantic_scores=score_fixture(same_version) if mode in ('semantic','hybrid') else None,association_config=cfg)
        assert not versioned['association']['matches'][0]['question_ids']


def test_real_generate_message_boundary_drops_evaluation_labels(monkeypatch):
    from gpt_researcher.config import config
    from gpt_researcher.utils import llm
    captured=[]
    class Provider:
        last_usage_metadata=dict(input_tokens=1,output_tokens=1)
        async def get_chat_response(self,messages,*args): captured.extend(messages); return '{"claims":[]}'
    monkeypatch.setattr(config,'Config',lambda:SimpleNamespace(smart_llm_provider='unit',smart_llm_model='unit',llm_kwargs={}))
    monkeypatch.setattr(llm,'get_llm',lambda *args,**kwargs:Provider())
    asyncio.run(ResearchAdapter().generate('research',dict(question='Atlas?',task_type='fact_check',evidence=[],previous_claims=[],
        evaluation_labels=dict(secret='EVALUATION_LABEL_MUST_NOT_LEAK'),ground_truth='GOLD_MUST_NOT_LEAK')))
    text=json.dumps(captured)
    assert 'EVALUATION_LABEL_MUST_NOT_LEAK' not in text and 'GOLD_MUST_NOT_LEAK' not in text
    user=json.loads(captured[1]['content'])
    assert set(user)=={'question','task_type','evidence','previous_claims'}
