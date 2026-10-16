import asyncio
import time
import socket
import pytest
from fastapi.testclient import TestClient
from service import safe_sources, app as api, runner


def test_proxy_fake_ip_is_verified_against_real_public_dns(monkeypatch):
    monkeypatch.setattr(safe_sources.socket, 'getaddrinfo', lambda *a: [(2,1,6,'',('198.18.1.194',443))])
    async def real_dns(host): return ['104.21.94.120']
    monkeypatch.setattr(safe_sources, '_https_addresses', real_dns, raising=False)
    assert asyncio.run(safe_sources.public_url('https://llm-stats.com/proof'))


@pytest.mark.parametrize('address', ['127.0.0.1','10.0.0.1','169.254.169.254','198.18.0.1','224.0.0.1','::1'])
def test_literal_non_public_ips_never_use_dns_fallback(monkeypatch, address):
    async def should_not_resolve(host): raise AssertionError('literal private IP must not use external DNS')
    monkeypatch.setattr(safe_sources, '_https_addresses', should_not_resolve, raising=False)
    url = 'https://['+address+']/' if ':' in address else 'https://'+address+'/'
    assert not asyncio.run(safe_sources.public_url(url))


def test_run_failure_exposes_cause_without_claiming_all_actions_failed(monkeypatch, tmp_path):
    monkeypatch.setattr(runner, 'RUNS_DIR', tmp_path)
    async def fail(task, bus):
        graph = task['structured_state']
        graph['actions'] = [dict(kind='research', outcome='completed', unit_cost=1),
                            dict(kind='research', outcome='failed', unit_cost=1, error='RuntimeError: 来源DNS解析失败，请检查代理')]
        return dict(task_id=task['structured_task_id'], structured_state=graph, report=None, execution_status='failed')
    monkeypatch.setattr(api, 'run_structured', fail)
    api.RUNS.clear()
    with TestClient(api.app) as client:
        rid = client.post('/research', json=dict(focus='Atlas', snapshot=[], action_budget=2)).json()['run_id']
        for _ in range(100):
            detail = client.get('/research/'+rid).json()
            if detail['status'] != 'running': break
            time.sleep(.01)
        assert detail['status'] == 'failed'
        assert 'DNS' in detail['error']
        assert '所有已执行研究动作均失败' not in detail['error']
        assert 'DNS' in detail['events'][-1]['output']


def test_fake_ip_cannot_be_allowed_by_private_or_missing_real_dns(monkeypatch):
    monkeypatch.setattr(safe_sources.socket, 'getaddrinfo', lambda *a: [(2,1,6,'',('198.18.1.3',443))])
    for values in ([], ['10.0.0.1'], ['8.8.8.8', '127.0.0.1']):
        async def answers(host): return values
        monkeypatch.setattr(safe_sources, '_https_addresses', answers)
        assert not asyncio.run(safe_sources.public_url('https://example.org/source'))
    async def fail(host): raise TimeoutError()
    monkeypatch.setattr(safe_sources, '_https_addresses', fail)
    assert not asyncio.run(safe_sources.public_url('https://example.org/source'))


def test_private_redirect_is_blocked_before_second_connection(monkeypatch):
    monkeypatch.setattr(safe_sources.socket, 'getaddrinfo', lambda *a: [(2,1,6,'',('93.184.215.14',443))])
    called = []
    async def redirect(url, addresses):
        called.append((url, addresses))
        return 302, {'Location': 'http://169.254.169.254/latest/meta-data'}, b''
    monkeypatch.setattr(safe_sources, '_download_once', redirect)
    with pytest.raises(safe_sources.SourceAccessError, match='公网'):
        asyncio.run(safe_sources.fetch_source('https://example.org/source'))
    assert len(called) == 1


def test_fake_ip_source_pins_public_address_and_reuses_real_text_parser(monkeypatch):
    monkeypatch.setattr(safe_sources.socket, 'getaddrinfo', lambda *a: [(2,1,6,'',('198.18.1.3',443))])
    async def answers(host): return ['93.184.215.14']
    monkeypatch.setattr(safe_sources, '_https_addresses', answers)
    async def download(url, addresses):
        assert addresses == ['93.184.215.14']
        return 200, {'Content-Type': 'text/html; charset=utf-8'}, ('<html><title>Evidence</title><body><p>'+('Actual verified source text. '*20)+'</p></body></html>').encode()
    monkeypatch.setattr(safe_sources, '_download_once', download)
    source = asyncio.run(safe_sources.fetch_source('https://example.org/source'))
    assert source['title'] == 'Evidence' and 'Actual verified source text.' in source['raw_content']
    assert source['url'] == 'https://example.org/source'


def test_connector_resolver_never_re_resolves_unapproved_host():
    resolver = safe_sources._PinnedResolver('example.org', ['93.184.215.14'])
    values = asyncio.run(resolver.resolve('example.org', 443))
    assert values[0]['host'] == '93.184.215.14'
    with pytest.raises(OSError):
        asyncio.run(resolver.resolve('internal.local', 443))


def test_old_generic_failure_is_explained_without_rewriting_history(monkeypatch, tmp_path):
    import json
    monkeypatch.setattr(runner, 'RUNS_DIR', tmp_path)
    path = tmp_path/'123.json'
    record = dict(task_id='123', status='failed', error='所有已执行研究动作均失败；请查看异常及消耗记录', structured_state=dict(actions=[dict(kind='research', unit_cost=1, outcome='failed', error='RuntimeError: 来源DNS解析失败')]))
    path.write_text(json.dumps(record), encoding='utf-8')
    assert 'DNS' in runner.load_run('123')['error']
    assert 'DNS' in runner.load_history()[0]['error']
    assert json.loads(path.read_text(encoding='utf-8'))['error'] == record['error']
