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
    attempts = metrics.setdefault('retrieval_attempts', [])
    current, final_outcomes = [], {}
    for name, retrieve, words, variant in providers:
        metrics['retriever_calls'] += 1
        attempt = dict(provider=name, outcome='started', query=words, query_variant=variant)
        attempts.append(attempt)
        current.append(attempt)
        try:
            rows = await asyncio.wait_for(retrieve(words), timeout=15)
            if not isinstance(rows, list): raise ValueError('retrieval returned non-list results')
            rows = [row for row in rows if isinstance(row, dict) and any(row.get(k) for k in ('url', 'href', 'sourceUrl'))]
            attempt.update(results=len(rows), outcome='completed' if rows else 'empty')
            if rows: return rows
        except asyncio.CancelledError:
            attempt['outcome'] = 'cancelled'
            raise
        except Exception as exc:
            attempt.update(outcome='failed', error_class=type(exc).__name__)
            if isinstance(exc, httpx.HTTPStatusError): attempt['http_status'] = exc.response.status_code
            metrics.setdefault('retrieval_errors', []).append(dict(attempt))
        final_outcomes[name] = attempt['outcome']
    if final_outcomes and all(outcome == 'empty' for outcome in final_outcomes.values()):
        return []
    raise RuntimeError('检索服务请求失败；已尝试：' + ', '.join(f"{x['provider']}={x.get('http_status', x.get('error_class', x['outcome']))}" for x in current))
