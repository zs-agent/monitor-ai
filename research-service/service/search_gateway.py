"""Bounded provider fallback and explicit failures around upstream components."""
import asyncio
import os
import time
import httpx


async def openalex(query):
    # Reuse upstream record parsing, but use cancellable HTTP and propagate
    # status codes: the upstream sync retriever prints 429 and returns [].
    from gpt_researcher.retrievers.openalex.openalex import OpenAlexSearch
    params = dict(search=query, per_page=8, sort='relevance_score:desc')
    for env, name in [('OPENALEX_EMAIL', 'mailto'), ('OPENALEX_API_KEY', 'api_key')]:
        if os.environ.get(env): params[name] = os.environ[env]
    async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
        response = await client.get(OpenAlexSearch.BASE_URL, params=params)
        response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict) or not isinstance(payload.get('results'), list):
        raise ValueError('OpenAlex returned malformed results')
    return [dict(title=row.get('title') or '', href=OpenAlexSearch._pick_href(row), body=OpenAlexSearch._reconstruct_abstract(row.get('abstract_inverted_index')) or '',
                 published_at=row.get('publication_date') or '') for row in payload['results'] if isinstance(row, dict)]


class RetrievalUnavailable(RuntimeError):
    """Recoverable discovery outage; evidence-backed work may still be retained."""
    code = 'retrieval_unavailable'


class NoEvidenceFound(ValueError):
    """Search completed but supplied no usable evidence, not a runtime failure."""
    code = 'no_evidence'


async def duckduckgo(query):
    from ddgs import DDGS
    from ddgs.exceptions import DDGSException
    def retrieve():
        try:
            rows = DDGS(timeout=5).text(query, region='wt-wt', max_results=4, backend='google,brave,duckduckgo')
        except DDGSException as exc:
            # This exact message is the pinned client's genuine empty result.
            # Transport/timeouts/rate limits must retain their exception type.
            if type(exc) is DDGSException and str(exc) == 'No results found.':
                return []
            raise
        result = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            url = row.get('href') or row.get('url') or row.get('link')
            if url:
                result.append(dict(href=url, title=row.get('title') or '', body=row.get('body') or row.get('snippet') or row.get('description') or ''))
        return result[:4]
    return await asyncio.wait_for(asyncio.to_thread(retrieve), timeout=12)


def error_reason(exc):
    # Persist useful diagnosis without serializing URLs, queries or credentials.
    chain, current = [], exc
    for _ in range(4):
        if current is None or current in chain: break
        chain.append(current)
        current = current.__cause__ or current.__context__
    details = ' '.join(str(item).lower() for item in chain)
    if 'certificate_verify_failed' in details or 'certificate verify failed' in details:
        return 'TLS证书验证失败'
    if any(term in details for term in ('getaddrinfo', 'name or service not known', 'name resolution', 'nodename nor servname')):
        return 'DNS解析失败'
    if any(isinstance(item, httpx.ProxyError) for item in chain):
        return '代理连接失败'
    if isinstance(exc, httpx.ConnectError): return '无法建立网络连接'
    if isinstance(exc, (httpx.TimeoutException, TimeoutError)): return '请求超时'
    if isinstance(exc, httpx.HTTPStatusError):
        code = exc.response.status_code
        return '请求被限流（HTTP429）' if code == 429 else f'服务返回HTTP{code}'
    return '搜索服务未能完成请求'


async def search(query, researcher, metrics):
    from .search_queries import normalize_query, simplified_query
    query = normalize_query(query)
    primary = os.environ.get('RETRIEVER', 'tavily').split(',')[0].strip()
    async def initial(q):
        if primary == 'openalex': return await openalex(q)
        if primary == 'duckduckgo': return await duckduckgo(q)
        return await researcher.quick_search(q, aggregated_summary=False)
    providers = [(primary, initial, query, 'normalized')]
    web_enabled = primary == 'duckduckgo' or os.environ.get('RESEARCH_SEARCH_FALLBACK', 'duckduckgo') == 'duckduckgo'
    if primary != 'duckduckgo' and web_enabled:
        providers.append(('duckduckgo', duckduckgo, query, 'normalized'))
    short = simplified_query(query)
    if web_enabled and short and short != query:
        providers.append(('duckduckgo', duckduckgo, short, 'simplified'))
    if web_enabled and primary == 'openalex' and any(term in query.lower() for term in ('overall benchmark ranking', 'leaderboard', '排行榜', '排名')):
        # Current ranking questions are web evidence tasks, not paper discovery.
        providers = [row for row in providers if row[0] == 'duckduckgo'] + [row for row in providers if row[0] != 'duckduckgo']
    from . import domestic_sources
    enabled = os.environ.get('RESEARCH_DOMESTIC_FALLBACK', 'modelscope,gitee').split(',')
    for name in ('modelscope', 'gitee'):
        if name in enabled:
            providers.append((name, getattr(domestic_sources, name), short or query, 'domestic'))
    attempts = metrics.setdefault('retrieval_attempts', [])
    current, final_outcomes = [], {}
    health = metrics.setdefault('provider_health', {})
    retry_used = False
    for name, retrieve, words, variant in providers:
        provider_state = health.setdefault(name, dict(failures=0, resume_at=0))
        if provider_state['resume_at'] > time.monotonic():
            attempt = dict(provider=name, outcome='skipped_circuit_open', query=words, query_variant=variant, error_reason='该来源连续失败，短暂暂停后重试')
            attempts.append(attempt)
            current.append(attempt)
            final_outcomes[name] = 'failed'
            continue
        retry = False
        while True:
            metrics['retriever_calls'] += 1
            attempt = dict(provider=name, outcome='started', query=words, query_variant=variant, retry=retry)
            attempts.append(attempt)
            current.append(attempt)
            try:
                rows = await asyncio.wait_for(retrieve(words), timeout=15)
                if not isinstance(rows, list): raise ValueError('retrieval returned non-list results')
                rows = [row for row in rows if isinstance(row, dict) and any(row.get(k) for k in ('url', 'href', 'sourceUrl'))]
                provider_state.update(failures=0, resume_at=0)
                attempt.update(results=len(rows), outcome='completed' if rows else 'empty')
                if rows:
                    if variant == 'domestic':
                        metrics.setdefault('retrieval_warnings', []).append(dict(code='domestic_source_recovery', reason='常用检索未取得可用结果，已切换国内公开来源；请结合来源时间、版本和适用条件判断。'))
                    return rows
            except asyncio.CancelledError:
                attempt['outcome'] = 'cancelled'
                raise
            except Exception as exc:
                provider_state['failures'] += 1
                if provider_state['failures'] >= 2: provider_state['resume_at'] = time.monotonic() + 30
                attempt.update(outcome='failed', error_class=type(exc).__name__, error_reason=error_reason(exc))
                if isinstance(exc, httpx.HTTPStatusError): attempt['http_status'] = exc.response.status_code
                if exc.__cause__: attempt['cause_class'] = type(exc.__cause__).__name__
                metrics.setdefault('retrieval_errors', []).append(dict(attempt))
                if isinstance(exc, httpx.ConnectError) and not retry_used and attempt['error_reason'] == '无法建立网络连接':
                    retry_used, retry = True, True
                    await asyncio.sleep(0.2)
                    continue
            final_outcomes[name] = attempt['outcome']
            break
    if final_outcomes and all(outcome == 'empty' for outcome in final_outcomes.values()):
        return []
    labels = {'duckduckgo': '网页检索', 'openalex': '学术检索', 'modelscope': '魔搭模型库', 'gitee': 'Gitee项目库'}
    messages = list(dict.fromkeys(labels.get(x['provider'], x['provider']) + '：' + x.get('error_reason', '未找到结果') + '（' + x.get('error_class', x['outcome']) + '）' for x in current))
    raise RetrievalUnavailable('检索暂不可用；' + '；'.join(messages))
