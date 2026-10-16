import asyncio
import pytest
from service import search_gateway
from service.research_state import build_state, evidence_record
from service.structured_workflow import run_structured
from service.runner import EventBus

def test_domestic_fallback_is_attempted_after_primary_outage(monkeypatch):
    from service import domestic_sources
    async def broken(query): raise TimeoutError('offline')
    async def domestic(query): return [dict(href='https://modelscope.cn/model/proof',title='Model card')]
    monkeypatch.setenv('RETRIEVER','openalex')
    monkeypatch.setenv('RESEARCH_SEARCH_FALLBACK','none')
    monkeypatch.setenv('RESEARCH_DOMESTIC_FALLBACK','modelscope')
    monkeypatch.setattr(search_gateway,'openalex',broken)
    monkeypatch.setattr(domestic_sources,'modelscope',domestic)
    metrics=dict(retriever_calls=0)
    rows=asyncio.run(search_gateway.search('Qwen model benchmark capability',None,metrics))
    assert rows[0]['href'].startswith('https://modelscope.cn/')
    assert metrics['retriever_calls']==2
    assert metrics['retrieval_attempts'][-1]['provider']=='modelscope'

def test_primary_results_are_preferred_without_domestic_requests(monkeypatch):
    from service import domestic_sources
    async def fresh(query): return [dict(href='https://example.org/current')]
    async def unnecessary(query): raise AssertionError('fresh retrieval succeeded')
    monkeypatch.setenv('RETRIEVER','openalex')
    monkeypatch.setenv('RESEARCH_DOMESTIC_FALLBACK','modelscope')
    monkeypatch.setattr(search_gateway,'openalex',fresh)
    monkeypatch.setattr(domestic_sources,'modelscope',unnecessary)
    assert asyncio.run(search_gateway.search('Atlas',None,dict(retriever_calls=0)))[0]['href'].endswith('current')

def test_recoverable_search_outage_preserves_report_and_other_findings():
    class Adapter:
        async def search(self, query):
            if 'deployment' in query: raise search_gateway.RetrievalUnavailable('网络连接暂不可用')
            return [evidence_record(dict(title='Atlas release',sourceUrl='https://example.org/atlas',content='Original source'))]
        async def generate(self,role,payload):
            return dict(claims=[dict(text='Atlas finding',conditions='v1',evidence_keys=['https://example.org/atlas'])]) if role=='research' else dict(checks=[dict(index=0,verdict='supported')])
    state=build_state('Atlas','fact_check',[])
    result=asyncio.run(run_structured(dict(structured_state=state,action_budget=4,structured_task_id='601',query='Atlas'),EventBus(),Adapter()))
    assert result['execution_status']=='partial'
    assert 'Atlas finding' in result['report'] and '暂不能判断' in result['report']
    actions=result['structured_state']['actions']
    assert any(a['outcome']=='failed' and a['error_code']=='retrieval_unavailable' for a in actions)
    assert result['structured_state']['consumption']['model_calls']==2

def test_all_searches_unavailable_still_produce_pending_without_fake_facts():
    class Adapter:
        async def search(self,query): raise search_gateway.RetrievalUnavailable('没有取得来源，暂不能判断')
        async def generate(self,*args): raise AssertionError('must not fabricate')
    state=build_state('Atlas','fact_check',[])
    result=asyncio.run(run_structured(dict(structured_state=state,action_budget=4,structured_task_id='602',query='Atlas'),EventBus(),Adapter()))
    assert result['execution_status']=='partial'
    assert result['report'] and '暂不能判断' in result['report']
    assert not any(q['claims'] for q in result['structured_state']['issues'].values())

def test_circuit_breaker_skips_requests_but_records_the_skip(monkeypatch):
    async def broken(query): raise TimeoutError('offline')
    monkeypatch.setenv('RETRIEVER','openalex')
    monkeypatch.setenv('RESEARCH_SEARCH_FALLBACK','none')
    monkeypatch.setattr(search_gateway,'openalex',broken)
    metrics=dict(retriever_calls=0)
    for _ in range(3):
        with pytest.raises(search_gateway.RetrievalUnavailable):
            asyncio.run(search_gateway.search('Atlas',None,metrics))
    assert metrics['retriever_calls']==2
    assert metrics['retrieval_attempts'][-1]['outcome']=='skipped_circuit_open'

def test_domestic_metadata_uses_documented_public_api_and_original_card(monkeypatch):
    import httpx
    from service import domestic_sources
    real_client=httpx.AsyncClient
    def respond(request):
        assert request.url.host=='modelscope.cn'
        assert request.url.params['search']=='Qwen'
        return httpx.Response(200,json=dict(success=True,data=dict(models=[
            dict(id='Qwen/Qwen-Example',description='Model card',last_modified='2026-10-16',tasks=['text-generation']),
            dict(id='private/secret',private=True),
        ])))
    monkeypatch.setattr(domestic_sources.httpx,'AsyncClient',lambda **kwargs: real_client(transport=httpx.MockTransport(respond),**kwargs))
    rows=asyncio.run(domestic_sources.modelscope('Qwen model benchmark capability'))
    assert len(rows)==1
    assert 'FilePath=README.md' in rows[0]['href']
    assert rows[0]['published_at']=='2026-10-16'

def test_domestic_api_error_is_not_fabricated_as_empty_success(monkeypatch):
    import httpx
    from service import domestic_sources
    real_client=httpx.AsyncClient
    def respond(request): return httpx.Response(200,json=dict(success=False,message='unavailable'))
    monkeypatch.setattr(domestic_sources.httpx,'AsyncClient',lambda **kwargs: real_client(transport=httpx.MockTransport(respond),**kwargs))
    with pytest.raises(ValueError):
        asyncio.run(domestic_sources.modelscope('Qwen'))
