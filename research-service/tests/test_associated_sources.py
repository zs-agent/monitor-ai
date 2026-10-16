import asyncio
import httpx
import pytest
from service import search_gateway, safe_sources
from service.signals import select_signals
from service.structured_workflow import ResearchAdapter, run_structured
from service.research_state import build_state, evidence_record
from service.runner import EventBus

def test_topic_filtering_precedes_global_popularity_and_recency_breaks_ties():
    records = [dict(id='noise', title='Unrelated popular story', importance=5, credibility=5, providerId='hn'),
               dict(id='old', title='Atlas model release', importance=4, credibility=4, providerId='hf', publishedAt='2026-01-01'),
               dict(id='new', title='Atlas model release', importance=4, credibility=4, providerId='hf', publishedAt='2026-10-16')]
    assert select_signals(records, focus='Atlas', top=1, exclude_providers=())[0]['id'] == 'new'

def test_associated_sources_supply_verified_text_during_search_outage(monkeypatch):
    async def unavailable(*args): raise RuntimeError('search network unavailable')
    async def source(url): return dict(url=url, title='Atlas deployment', raw_content='Verified original source text')
    monkeypatch.setattr(search_gateway, 'search', unavailable)
    monkeypatch.setattr(safe_sources, 'fetch_source', source)
    seed=evidence_record(dict(title='Atlas deployment', sourceUrl='https://example.org/atlas', summary='Metadata is not verified text'))
    adapter=ResearchAdapter()
    records=asyncio.run(adapter.search_with_sources('Atlas deployment', [seed]))
    assert records[0]['retrieval_level'] == 'full_text'
    assert records[0]['content'] == 'Verified original source text'
    assert adapter.metrics['pages_requested'] == 1

def test_metadata_alone_never_masks_search_and_source_failure(monkeypatch):
    async def unavailable(*args): raise RuntimeError('search network unavailable')
    async def source(url): raise ConnectionError('source offline')
    monkeypatch.setattr(search_gateway, 'search', unavailable)
    monkeypatch.setattr(safe_sources, 'fetch_source', source)
    seed=evidence_record(dict(title='Atlas', sourceUrl='https://example.org/atlas', summary='unverified metadata'))
    with pytest.raises(RuntimeError,match='search network'):
        asyncio.run(ResearchAdapter().search_with_sources('Atlas', [seed]))

def test_graph_supplies_only_associated_sources_to_researcher():
    seed=dict(title='Atlas model benchmark', summary='Atlas model capability', sourceUrl='https://example.org/atlas')
    noise=dict(title='Unrelated weather', sourceUrl='https://example.org/weather', summary='sunshine')
    seen=[]
    class Adapter:
        async def search(self, query): raise AssertionError('associated sources must be passed')
        async def search_with_sources(self, query, sources):
            seen.extend(sources)
            return [dict(evidence_record(seed), retrieval_level='full_text')]
        async def generate(self, role, payload):
            return dict(claims=[dict(text='Atlas finding',conditions='v1',evidence_keys=['https://example.org/atlas'])]) if role=='research' else dict(checks=[dict(index=0,verdict='supported')])
    state=build_state('Atlas','fact_check',[seed,noise],questions=[dict(id='q',axis='capability',question='Atlas能力',task_type='fact_check')])
    result=asyncio.run(run_structured(dict(structured_state=state,action_budget=2,structured_task_id='501',query='Atlas'),EventBus(),Adapter()))
    assert result['execution_status']=='completed'
    assert seen and all(row['key']=='https://example.org/atlas' for row in seen)

def test_transient_connect_failure_has_one_accounted_retry(monkeypatch):
    calls=0
    async def academic(query):
        nonlocal calls
        calls+=1
        if calls==1: raise httpx.ConnectError('transient')
        return [dict(href='https://example.org/atlas')]
    monkeypatch.setenv('RETRIEVER','openalex')
    monkeypatch.setenv('RESEARCH_SEARCH_FALLBACK','none')
    monkeypatch.setattr(search_gateway,'openalex',academic)
    metrics=dict(retriever_calls=0)
    assert asyncio.run(search_gateway.search('Atlas',None,metrics))
    assert calls==metrics['retriever_calls']==2
    assert metrics['retrieval_attempts'][0]['error_reason']=='无法建立网络连接'
    assert metrics['retrieval_attempts'][1]['retry']==True

def test_verified_originals_already_acquired_in_this_run_survive_later_outage(monkeypatch):
    calls=[]
    attempts=0
    async def search(*args):
        nonlocal attempts
        attempts+=1
        if attempts>1: raise RuntimeError('later outage')
        return []
    async def source(url):
        calls.append(url)
        return dict(url=url,title='Atlas source',raw_content='Acquired original')
    monkeypatch.setattr(search_gateway,'search',search)
    monkeypatch.setattr(safe_sources,'fetch_source',source)
    seed=evidence_record(dict(title='Atlas',sourceUrl='https://example.org/atlas'))
    adapter=ResearchAdapter()
    async def run():
        original=await adapter.search_with_sources('Atlas',[seed])
        reviewed=await adapter.search_with_sources('Atlas',original)
        assert reviewed[0]['content']=='Acquired original'
        assert reviewed[0]['fetched_at']==original[0]['fetched_at']
    asyncio.run(run())
    assert len(calls)==adapter.metrics['pages_requested']==1
