import asyncio
import pytest
from service import search_gateway
from service.research_state import build_state, evidence_record
from service.structured_workflow import run_structured
from service.runner import EventBus

def test_search_client_failure_is_not_silently_returned_as_empty(monkeypatch):
    import ddgs
    from ddgs.exceptions import TimeoutException
    class Broken:
        def __init__(self, *args, **kwargs): pass
        def text(self, *args, **kwargs): raise TimeoutException('timed out')
    monkeypatch.setattr(ddgs, 'DDGS', Broken)
    with pytest.raises(TimeoutException):
        asyncio.run(search_gateway.duckduckgo('Opus 5.5 benchmark'))


def test_true_empty_search_returns_no_evidence_not_system_error(monkeypatch):
    async def empty(query): return []
    monkeypatch.setenv('RETRIEVER', 'openalex')
    monkeypatch.setattr(search_gateway, 'openalex', empty)
    monkeypatch.setattr(search_gateway, 'duckduckgo', empty)
    assert asyncio.run(search_gateway.search('Opus 5.5 benchmark', None, dict(retriever_calls=0))) == []


def test_no_search_results_produce_pending_report_without_model_calls():
    class Empty:
        async def search(self, query): return []
        async def generate(self, *args): raise AssertionError('must not invent an answer without evidence')
    state=build_state('opus5.5 的综合实力是不是当下top1', 'fact_check', [])
    result=asyncio.run(run_structured(dict(structured_state=state, action_budget=4, structured_task_id='101', query='Opus'), EventBus(), Empty()))
    assert result['execution_status'] == 'partial'
    assert result['report'] and '待核查' in result['report']
    assert result['structured_state']['consumption']['model_calls'] == 0


def test_version_name_in_natural_question_is_spaced_in_search():
    queries=[]
    class Capture:
        async def search(self, query):
            queries.append(query)
            return []
        async def generate(self, *args): raise AssertionError()
    state=build_state('opus5.5 的综合实力是不是当下top1', 'fact_check', [])
    asyncio.run(run_structured(dict(structured_state=state, action_budget=2, structured_task_id='102', query='Opus'), EventBus(), Capture()))
    assert queries and 'opus 5.5' in queries[0].lower()


def test_transport_outage_is_still_failed_not_no_evidence(monkeypatch):
    async def broken(query): raise TimeoutError('network down')
    monkeypatch.setenv('RETRIEVER', 'openalex')
    monkeypatch.setattr(search_gateway, 'openalex', broken)
    monkeypatch.setattr(search_gateway, 'duckduckgo', broken)
    metrics=dict(retriever_calls=0)
    with pytest.raises(RuntimeError, match='TimeoutError'):
        asyncio.run(search_gateway.search('Opus 5.5 model benchmark capability',None,metrics))
    assert metrics['retriever_calls'] == 3
    assert all(row['outcome']=='failed' for row in metrics['retrieval_attempts'])


def test_simplified_query_retry_is_bounded_and_logged(monkeypatch):
    async def empty(query): return []
    async def web(query):
        return [dict(href='https://example.org/evidence',body='evidence')] if query=='Opus 5.5' else []
    monkeypatch.setenv('RETRIEVER','openalex')
    monkeypatch.setattr(search_gateway,'openalex',empty)
    monkeypatch.setattr(search_gateway,'duckduckgo',web)
    metrics=dict(retriever_calls=0)
    rows=asyncio.run(search_gateway.search('Opus5.5 model benchmark capability',None,metrics))
    assert rows and metrics['retriever_calls']==3
    assert metrics['retrieval_attempts'][-1]['query_variant']=='simplified'
    assert metrics['retrieval_attempts'][-1]['query']=='Opus 5.5'


def test_chinese_adjacent_ranking_phrase_is_normalized():
    from service.search_queries import normalize_query
    words=normalize_query('opus5.5 的综合实力是不是当下top1')
    assert words=='opus 5.5 overall benchmark ranking'


def test_current_model_ranking_prefers_web_over_academic_fallback(monkeypatch):
    async def academic(query): return [dict(href='https://example.org/paper')]
    async def web(query): return [dict(href='https://example.org/ranking')]
    monkeypatch.setenv('RETRIEVER','openalex')
    monkeypatch.setattr(search_gateway,'openalex',academic)
    monkeypatch.setattr(search_gateway,'duckduckgo',web)
    metrics=dict(retriever_calls=0)
    result=asyncio.run(search_gateway.search('opus5.5 的综合实力是不是当下top1 model benchmark capability',None,metrics))
    assert result[0]['href']=='https://example.org/ranking'
    assert metrics['retrieval_attempts'][0]['provider']=='duckduckgo'
