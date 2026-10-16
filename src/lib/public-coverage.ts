import fs from 'node:fs/promises'
import path from 'node:path'
import type { CoverageResponse, IndexKind, PublicIndexTotal } from '@/types/coverage'

const definitions: Record<IndexKind, { source: string; url: string; scope: string; endpoint: string }> = {
  papers: { source: 'OpenAlex', url: 'https://openalex.org/works?search=artificial%20intelligence', scope: '全文检索 artificial intelligence 匹配的文献，不限年份', endpoint: 'https://api.openalex.org/works?search=artificial%20intelligence&per-page=1' },
  models: { source: 'Hugging Face', url: 'https://huggingface.co/models', scope: 'Hugging Face公开模型仓库，包含微调和量化版本', endpoint: 'https://huggingface.co/models' },
  projects: { source: 'GitHub', url: 'https://github.com/search?q=topic%3Aartificial-intelligence+is%3Apublic&type=repositories', scope: 'GitHub artificial-intelligence主题公开仓库', endpoint: 'https://api.github.com/search/repositories?q=topic%3Aartificial-intelligence%20is%3Apublic&per_page=1' },
}
const kinds: IndexKind[] = ['papers', 'models', 'projects']
const ttl = 6 * 60 * 60 * 1000
const retryDelay = 15 * 60 * 1000
const cacheFile = path.join(process.cwd(), 'data', '.public-coverage.json')
let cached: CoverageResponse | undefined
let inflight: Promise<CoverageResponse> | undefined

export function readIndexCount(kind: IndexKind, raw: unknown): { count: number; approximate: boolean } {
  let count: unknown
  let approximate = false
  if (kind === 'models') {
    const match = typeof raw === 'string' ? raw.replaceAll('&quot;', '"').match(/"numTotalItems"\s*:\s*(\d+)(?=\s*[,}])/) : null
    count = match ? Number(match[1]) : undefined
  } else {
    const data = raw as { meta?: { count?: unknown }; total_count?: unknown; incomplete_results?: unknown } | null
    count = kind === 'papers' ? data?.meta?.count : data?.total_count
    approximate = kind === 'projects' && data?.incomplete_results === true
  }
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new Error('Source index count missing or invalid')
  return { count, approximate }
}

export function mergeIndexResult(kind: IndexKind, result: { count: number; approximate: boolean } | null, previous: PublicIndexTotal | undefined, observedAt: string): PublicIndexTotal {
  const { source, url, scope } = definitions[kind]
  if (result) return { kind, source, url, scope, ...result, observedAt, status: 'fresh' }
  return { kind, source, url, scope, count: previous?.count ?? null, approximate: previous?.approximate ?? false, observedAt: previous?.observedAt ?? null, status: previous?.count != null ? 'stale' : 'unavailable' }
}

async function loadCache(): Promise<CoverageResponse | undefined> {
  try {
    const data: CoverageResponse = JSON.parse(await fs.readFile(cacheFile, 'utf8'))
    if (!Number.isFinite(Date.parse(data.checkedAt)) || !Array.isArray(data.totals)) return
    // Reconstruct metadata from known sources; never trust persisted links.
    const totals = kinds.map(kind => {
      const item = data.totals.find(row => row.kind === kind)
      if (!item || item.count === null || !Number.isSafeInteger(item.count) || item.count < 0 || !item.observedAt || !Number.isFinite(Date.parse(item.observedAt))) return mergeIndexResult(kind, null, undefined, data.checkedAt)
      return { ...mergeIndexResult(kind, { count: item.count, approximate: item.approximate === true }, undefined, item.observedAt), status: item.status === 'fresh' ? 'fresh' as const : 'stale' as const }
    })
    return { totals, checkedAt: data.checkedAt }
  } catch { return }
}

export async function getPublicCoverage(): Promise<CoverageResponse> {
  if (inflight) return inflight
  const task = (async () => {
    cached ??= await loadCache()
    const now = Date.now()
    if (cached && now - Date.parse(cached.checkedAt) < retryDelay) return cached
    const totals = await Promise.all(kinds.map(async kind => {
      const previous = cached?.totals.find(item => item.kind === kind)
      if (previous?.status === 'fresh' && previous.observedAt && now - Date.parse(previous.observedAt) < ttl) return previous
      try {
        const response = await fetch(definitions[kind].endpoint, { cache: 'no-store', signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'monitor-ai/1.0', ...(kind === 'projects' && process.env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {}) } })
        if (!response.ok) throw new Error('HTTP ' + response.status)
        const raw: unknown = kind === 'models' ? await response.text() : await response.json()
        return mergeIndexResult(kind, readIndexCount(kind, raw), previous, new Date().toISOString())
      } catch (error) {
        console.warn('[coverage] ' + kind + ' refresh failed: ' + (error instanceof Error ? error.message : 'unknown'))
        return mergeIndexResult(kind, null, previous, new Date().toISOString())
      }
    }))
    cached = { totals, checkedAt: new Date().toISOString() }
    try {
      await fs.mkdir(path.dirname(cacheFile), { recursive: true })
      const temporary = cacheFile + '.' + process.pid + '.tmp'
      await fs.writeFile(temporary, JSON.stringify(cached))
      await fs.rename(temporary, cacheFile)
    } catch { console.warn('[coverage] unable to persist index totals') }
    return cached
  })()
  inflight = task
  try { return await task } finally { inflight = undefined }
}
