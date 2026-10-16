"""Optional real embeddings adapter; no lexical fallback masquerading as semantics."""
import math
import os
import httpx
from .research_state import evidence_record


async def semantic_scores(focus, rows):
    endpoint = os.environ.get('ASSOCIATION_EMBEDDING_URL', '')
    model = os.environ.get('ASSOCIATION_EMBEDDING_MODEL', '')
    if not endpoint or not model:
        raise ValueError('语义匹配未配置：需要ASSOCIATION_EMBEDDING_URL和ASSOCIATION_EMBEDDING_MODEL')
    from .safe_sources import public_url
    if not await public_url(endpoint):
        raise ValueError('向量服务地址须为允许的公网HTTPS服务')
    records = [evidence_record(row) for row in rows]
    headers = {}
    key = os.environ.get('ASSOCIATION_EMBEDDING_KEY')
    if key:
        headers['Authorization'] = 'Bearer ' + key
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
        response = await client.post(endpoint, headers=headers, json=dict(model=model, input=[focus] + [(r['title']+' '+r['summary'])[:2000] for r in records]))
        response.raise_for_status()
    data = sorted(response.json()['data'], key=lambda row: row['index'])
    vectors = [row['embedding'] for row in data]
    if len(vectors) != len(records)+1 or not vectors[0] or any(len(v) != len(vectors[0]) or any(not isinstance(n, (int, float)) or not math.isfinite(n) for n in v) for v in vectors):
        raise ValueError('向量服务返回无效维度或数值')
    query = vectors[0]
    def cosine(v):
        norm = math.sqrt(sum(n*n for n in query)*sum(n*n for n in v))
        return max(-1, min(1, sum(a*b for a,b in zip(query, v))/norm)) if norm else 0
    return {r['key']: cosine(v) for r,v in zip(records, vectors[1:])}
