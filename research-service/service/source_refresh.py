"""Refresh cited originals before online snapshot diff; frozen input never calls here."""
import asyncio
from copy import deepcopy
import time
from .research_state import evidence_record
from .safe_sources import fetch_source


async def refresh_cited_sources(parent, signals, fetcher=None, checks=None):
    fetcher = fetcher or fetch_source
    current = {evidence_record(row)['key']: deepcopy(row) for row in signals}
    keys = sorted({k for q in parent.get('issues', {}).values() for c in q.get('claims', []) for k in c.get('evidence_keys', [])})
    semaphore = asyncio.Semaphore(4)
    checks = checks if checks is not None else []
    async def refresh(key):
        old = parent.get('evidence', {}).get(key)
        if not old or not old.get('url'):
            checks.append(dict(key=key, outcome='unavailable', reason='missing_historical_url', requests=0))
            current.pop(key, None)
            return
        begin = time.monotonic()
        async with semaphore:
            check = dict(key=key, outcome='started', requests=1)
            checks.append(check)
            try:
                page = await fetcher(old['url'], cached=old)
                check['requests'] = page.get('request_count', 1)
                row = dict(old, raw_content=page['raw_content'], content=page['raw_content'], fetched_at=time.time(),
                           retrieval_level='full_text', link_available=True, etag=page.get('etag'), last_modified=page.get('last_modified'))
                current[key] = row
                check.update(outcome='not_modified' if page.get('not_modified') else 'refreshed',
                             elapsed_sec=round(time.monotonic()-begin, 3))
            except asyncio.CancelledError:
                check.update(outcome='cancelled', elapsed_sec=round(time.monotonic()-begin, 3))
                raise
            except Exception as exc:
                # Keep historical evidence in parent, omit from current snapshot.
                current.pop(key, None)
                check.update(outcome='unavailable', reason=getattr(exc, 'code', type(exc).__name__),
                             requests=getattr(exc,'request_count',1), elapsed_sec=round(time.monotonic()-begin, 3))
    await asyncio.gather(*(refresh(key) for key in keys))
    return list(current.values()), sorted(checks, key=lambda row:row['key'])
