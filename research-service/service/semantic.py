"""Optional real embeddings adapter; no lexical fallback masquerading as semantics."""
import math
import os
import time
import httpx
from .research_state import evidence_record, AXIS_DESCRIPTIONS, normalize_aliases, digest
from .contracts import AssociationConfig


async def semantic_scores(focus, rows, association_config=None):
    endpoint = os.environ.get('ASSOCIATION_EMBEDDING_URL', '')
    model = os.environ.get('ASSOCIATION_EMBEDDING_MODEL', '')
    if not endpoint or not model:
        raise ValueError('语义匹配未配置：需要ASSOCIATION_EMBEDDING_URL和ASSOCIATION_EMBEDDING_MODEL')
    if not endpoint.lower().startswith('https://'):
        raise ValueError('向量服务地址必须使用HTTPS')
    from .safe_sources import public_url
    if not await public_url(endpoint):
        raise ValueError('向量服务地址须为允许的公网HTTPS服务')
    records = [evidence_record(row) for row in rows]
    cfg = AssociationConfig.model_validate(association_config or {}).model_dump()
    headers = {}
    key = os.environ.get('ASSOCIATION_EMBEDDING_KEY')
    if key:
        headers['Authorization'] = 'Bearer ' + key
    started=time.monotonic()
    axes = list(AXIS_DESCRIPTIONS)
    canonical_focus = normalize_aliases(focus,'',cfg)[0]
    queries = [canonical_focus] + [AXIS_DESCRIPTIONS[axis] for axis in axes]
    inputs = queries + [normalize_aliases(focus,(r['title']+' '+r['summary'])[:2000],cfg)[1] for r in records]
    async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
        response = await client.post(endpoint, headers=headers, json=dict(model=model, input=inputs))
        response.raise_for_status()
    data = sorted(response.json()['data'], key=lambda row: row['index'])
    if [row.get('index') for row in data] != list(range(len(inputs))):
        raise ValueError('向量服务返回重复或缺失的索引')
    vectors = [row['embedding'] for row in data]
    if len(vectors) != len(inputs) or not vectors[0] or any(len(v) != len(vectors[0]) or any(type(n) not in (int, float) or not math.isfinite(n) for n in v) for v in vectors):
        raise ValueError('向量服务返回无效维度或数值')
    def cosine(query, v):
        norm = math.sqrt(sum(n*n for n in query)*sum(n*n for n in v))
        return max(-1, min(1, sum(a*b for a,b in zip(query, v))/norm)) if norm else 0
    documents = vectors[len(queries):]
    scores = {r['key']: cosine(vectors[0],v) for r,v in zip(records, documents)}
    scores['__dimensions__'] = {r['key']:{axis:cosine(vectors[i+1],v) for i,axis in enumerate(axes)} for r,v in zip(records,documents)}
    scores['__usage__'] = dict(model=response.json().get('model',model), requested_model=model,
                               input_hash=digest(inputs), dimension_description_hash=digest(AXIS_DESCRIPTIONS),
                               calls=1, input_tokens=response.json().get('usage',{}).get('prompt_tokens'),
                               elapsed_sec=round(time.monotonic()-started,3))
    return scores
