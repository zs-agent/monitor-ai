"""Anonymous, bounded discovery against domestic public registries.
Uses the documented ModelScope OpenAPI and Gitee v5 search surface.
Registry metadata is a clue; original documents must still be fetched.
"""
import re
from urllib.parse import quote
import httpx
from .search_queries import normalize_query, simplified_query

def object_query(query):
    value = simplified_query(query)
    words = re.findall(r'[A-Za-z][A-Za-z0-9_.-]*', value)
    generic = {'ai', 'model', 'models', 'overall', 'benchmark', 'ranking', 'leaderboard', 'capability', 'release', 'version', 'security', 'risk', 'deployment', 'cost', 'framework', 'repository', 'compare', 'comparison'}
    terms = [word for word in words if word.lower() not in generic]
    return ' '.join(terms[:2])[:80] if terms else value[:80]

async def modelscope(query):
    term = object_query(query)
    if not term: return []
    async with httpx.AsyncClient(timeout=6, follow_redirects=False) as client:
        response = await client.get('https://modelscope.cn/openapi/v1/models', params={'search': term, 'page_size': 4})
        response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict) or data.get('success') is not True:
        raise ValueError('ModelScope search unsuccessful')
    rows = data.get('data', {}).get('models')
    if not isinstance(rows, list): raise ValueError('ModelScope result missing')
    result = []
    for row in rows[:4]:
        if not isinstance(row, dict) or row.get('private'): continue
        name = row.get('id') or ''
        if not isinstance(name, str) or not re.fullmatch(r'[\w.-]+/[\w.-]+', name): continue
        result.append(dict(title=name + ' · ModelScope模型卡', href='https://modelscope.cn/api/v1/models/' + quote(name, safe='/') + '/repo?Revision=master&FilePath=README.md',
                           body=str(row.get('description') or '') + ' tasks: ' + ', '.join(str(v) for v in row.get('tasks', [])),
                           published_at=row.get('last_modified') or row.get('created_at') or '', source='ModelScope'))
    return result

async def gitee(query):
    term = object_query(query)
    if not term: return []
    async with httpx.AsyncClient(timeout=6, follow_redirects=False) as client:
        response = await client.get('https://gitee.com/api/v5/search/repositories', params={'q': term, 'per_page': 4})
        response.raise_for_status()
    data = response.json()
    if not isinstance(data, list): raise ValueError('Gitee result missing')
    return [dict(title=row.get('full_name') or row.get('name') or '', href=row['html_url'], body=row.get('description') or '',
                 published_at=row.get('updated_at') or '', source='Gitee') for row in data[:4]
            if isinstance(row, dict) and not row.get('private') and isinstance(row.get('html_url'), str) and row['html_url'].startswith('https://gitee.com/')]
