"""Bounded provider fallback and explicit failures around upstream components."""
import asyncio
import os
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


async def duckduckgo(query):
    from gpt_researcher.retrievers.duckduckgo.duckduckgo import Duckduckgo
    retriever = Duckduckgo(query)
    return await asyncio.wait_for(asyncio.to_thread(retriever.search, max_results=4), timeout=12)


async def search(query, researcher, metrics):
    primary = os.environ.get('RETRIEVER', 'tavily').split(',')[0].strip()
    providers = [(primary, lambda: openalex(query) if primary == 'openalex' else researcher.quick_search(query, aggregated_summary=False))]
    if primary != 'duckduckgo' and os.environ.get('RESEARCH_SEARCH_FALLBACK', 'duckduckgo') == 'duckduckgo':
        providers.append(('duckduckgo', lambda: duckduckgo(query)))
    attempts = metrics.setdefault('retrieval_attempts', [])
    for name, retrieve in providers:
        metrics['retriever_calls'] += 1
        attempt = dict(provider=name, outcome='started')
        attempts.append(attempt)
        try:
            rows = await asyncio.wait_for(retrieve(), timeout=15)
            if not isinstance(rows, list): raise ValueError('retrieval returned non-list results')
            rows = [row for row in rows if isinstance(row, dict) and any(row.get(k) for k in ('url', 'href', 'sourceUrl'))]
            attempt['results'] = len(rows)
            attempt['outcome'] = 'completed' if rows else 'empty'
            if rows: return rows
        except asyncio.CancelledError:
            attempt['outcome'] = 'cancelled'
            raise
        except Exception as exc:
            attempt.update(outcome='failed', error_class=type(exc).__name__)
            if isinstance(exc, httpx.HTTPStatusError): attempt['http_status'] = exc.response.status_code
        metrics.setdefault('retrieval_errors', []).append(dict(attempt))
    raise RuntimeError('检索服务未返回可用资料；已尝试：' + ', '.join(f"{x['provider']}={x.get('http_status', x['outcome'])}" for x in attempts[-len(providers):]))
