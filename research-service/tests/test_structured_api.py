import json
import time
from fastapi.testclient import TestClient
from service import app as api
from service import runner
from service.signals import build_task_from_query


def test_preview_run_partial_and_reload(monkeypatch, tmp_path):
    monkeypatch.setattr(runner, 'RUNS_DIR', tmp_path)
    monkeypatch.setattr(api, '_build_task', lambda req: (build_task_from_query(req.focus, model='test'), []))
    api.RUNS.clear()
    with TestClient(api.app) as client:
        request = dict(focus='Atlas', engine='structured', task_type='fact', action_budget=0)
        preview = client.post('/research/preview',json=request)
        assert preview.status_code == 200, preview.text
        assert preview.json()['research_policy']['allocation']['reserved_units'] == 0
        assert not list(tmp_path.glob('*.json'))
        response = client.post('/research',json=request)
        assert response.status_code == 200
        detail = client.get('/research/' + response.json()['run_id']).json()
        for _ in range(100):
            if detail['status'] != 'running':
                break
            time.sleep(0.01)
            detail = client.get('/research/' + response.json()['run_id']).json()
        assert detail['status'] == 'partial', detail
        assert detail['structured_state']['schema_version'] == 'issue-state-v1'
        stored = client.get('/research/history/' + str(detail['task_id'])).json()
        assert stored['structured_state'] == detail['structured_state']
        request['parent_task_id'] = str(detail['task_id'])
        assert client.post('/research/preview',json=request).status_code == 200
        request['focus'] = 'unrelated'
        assert client.post('/research/preview',json=request).status_code == 400
        request['parent_task_id'] = '../path'
        assert client.post('/research/preview',json=request).status_code == 422


def test_adapter_uses_components_not_chief_editor(monkeypatch):
    monkeypatch.setenv('RETRIEVER', 'custom')  # fake component, no network provider
    import asyncio
    import gpt_researcher
    from service.structured_workflow import ResearchAdapter
    from service import safe_sources
    async def fetched(url): return dict(url=url, raw_content='full page text', title='Atlas')
    monkeypatch.setattr(safe_sources, 'fetch_source', fetched)
    class Scraper:
        async def browse_urls(self, urls):
            return [{'url': urls[0], 'raw_content': 'full page text', 'title': 'Atlas'}]
    class Component:
        def __init__(self, **kwargs): self.scraper_manager = Scraper()
        async def quick_search(self, query, **kwargs):
            return [{'href':'https://example.org/atlas','title':'Atlas','body':'short snippet'}]
    monkeypatch.setattr(gpt_researcher,'GPTResearcher',Component)
    result = asyncio.run(ResearchAdapter().search('Atlas'))
    assert result[0]['retrieval_level'] == 'full_text'
    assert result[0]['content'] == 'full page text'
