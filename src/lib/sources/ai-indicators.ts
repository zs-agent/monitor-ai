import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import type { IndicatorValue } from '@/types/indicator'

const S2_API = 'https://api.semanticscholar.org/graph/v1/paper/search'
const GH_API = 'https://api.github.com/search/repositories'
const HN_API = 'https://hn.algolia.com/api/v1/search'
const TIMEOUT = 15000

/** 全球口径指标：数据源本身无国家维度，返回单条 WLD（全球）序列，避免中美两条完全相同的误导性曲线 */
export const GLOBAL_AI_INDICATORS: ReadonlySet<string> = new Set(['AI.GITHUB', 'AI.NEWS'])
/** 全球口径使用的国家码（ISO 3166-1 无此码，仅用于标识全球序列） */
export const GLOBAL_COUNTRY = 'WLD'

// ---- 结果缓存（内存，TTL + 过期兜底） ----
interface CacheEntry {
  value: number
  ts: number
}
const CACHE_TTL = 12 * 60 * 60 * 1000 // 12h 内直接命中（论文/仓库/新闻量变化缓慢）
const cache = new Map<string, CacheEntry>()

/** GitHub 无 token 仅 60 req/h，检测到限流后进入冷却，避免与 github 信号源 / agent-radar 叠加击穿配额 */
let githubQuotaExhaustedAt = 0
const GITHUB_QUOTA_COOLDOWN = 60 * 60 * 1000

/**
 * 带缓存的抓取：TTL 内命中直接返回；拉取失败（限流/超时/网络）时回退过期缓存，
 * 避免出现曲线断崖式掉到 0（首次无缓存时兜底 0）。
 */
async function cachedFetch(key: string, fetcher: () => Promise<number>): Promise<number> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && now - hit.ts < CACHE_TTL) return hit.value
  try {
    const value = await fetcher()
    cache.set(key, { value, ts: now })
    return value
  } catch {
    if (hit) return hit.value
    return 0
  }
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'monitor-ai/1.0',
  }
  if (process.env.GITHUB_TOKEN) h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  return h
}

/** 从 Semantic Scholar 按年份统计 AI 论文数量（国家维度仅用于关键词倾向，返回 total） */
async function fetchPapersByYear(year: number, country: string): Promise<number> {
  const query = country === 'CHN'
    ? 'large language model artificial intelligence china'
    : country === 'USA'
      ? 'large language model artificial intelligence'
      : 'machine learning deep learning'
  return cachedFetch(`AI.PAPERS:${country}:${year}`, async () => {
    const res = await fetchWithTimeout(
      `${S2_API}?query=${encodeURIComponent(query)}&year=${year}&limit=1`,
      {},
      TIMEOUT,
    )
    if (!res.ok) throw new Error(`Semantic Scholar HTTP ${res.status}`)
    const body = await res.json()
    return body?.total || 0
  })
}

/** 从 GitHub 按年份统计 AI 仓库数量（全球口径，无国家维度） */
async function fetchGitHubByYear(year: number): Promise<number> {
  return cachedFetch(`AI.GITHUB:${year}`, async () => {
    // 限流冷却期内不再打 GitHub API，直接走缓存/兜底
    if (githubQuotaExhaustedAt && Date.now() - githubQuotaExhaustedAt < GITHUB_QUOTA_COOLDOWN) {
      throw new Error('GitHub API rate limit cooldown')
    }
    const res = await fetchWithTimeout(
      `${GH_API}?q=${encodeURIComponent(`AI created:${year}-01-01..${year}-12-31`)}&per_page=1`,
      { headers: ghHeaders() },
      TIMEOUT,
    )
    if (!res.ok) {
      if (res.status === 403 || res.status === 429) githubQuotaExhaustedAt = Date.now()
      throw new Error(`GitHub API HTTP ${res.status}`)
    }
    const body = await res.json()
    return body?.total_count || 0
  })
}

/** 从 Hacker News 按年份统计 AI 相关帖子数量（全球口径，无国家维度） */
async function fetchHNByYear(year: number): Promise<number> {
  return cachedFetch(`AI.NEWS:${year}`, async () => {
    // HN Algolia API supports date range search
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    const res = await fetchWithTimeout(
      `${HN_API}?query=AI+OR+artificial+intelligence+OR+machine+learning&tags=story&numericFilters=created_at_i>=${new Date(start).getTime() / 1000},created_at_i<=${new Date(end).getTime() / 1000}&hitsPerPage=1`,
      {},
      TIMEOUT,
    )
    if (!res.ok) throw new Error(`Hacker News API HTTP ${res.status}`)
    const body = await res.json()
    return body?.nbHits || 0
  })
}

/** 简易并发限制：最多 limit 个任务并行，避免一次性打满外部 API 配额 */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

function countryDisplayName(country: string): string {
  if (country === 'USA') return 'United States'
  if (country === 'CHN') return 'China'
  if (country === GLOBAL_COUNTRY) return 'Global'
  return country
}

async function loadYear(indicator: string, country: string, year: number): Promise<IndicatorValue> {
  let value: number | null = null

  switch (indicator) {
    case 'AI.PAPERS':
      value = await fetchPapersByYear(year, country)
      break
    case 'AI.GITHUB':
      value = await fetchGitHubByYear(year)
      break
    case 'AI.NEWS':
      value = await fetchHNByYear(year)
      break
  }

  return {
    country,
    countryName: countryDisplayName(country),
    year,
    value,
    indicator,
  }
}

/**
 * 获取 AI 原生指标的时间序列数据。
 * - 并行抓取（限流并发），避免按国家×年份逐请求串行；
 * - AI.GITHUB / AI.NEWS 为全球口径：每年只抓一次，返回 WLD 单序列（不再产生两国完全相同的误导数据）；
 * - AI.PAPERS 按国家维度（Semantic Scholar 关键词倾向）。
 */
export async function fetchAIIndicatorData(
  indicator: string,
  countries: string[],
  yearStart: number,
  yearEnd: number,
): Promise<IndicatorValue[]> {
  const years: number[] = []
  for (let y = yearStart; y <= yearEnd; y++) years.push(y)

  const isGlobal = GLOBAL_AI_INDICATORS.has(indicator)
  // 全球口径：每年抓一次即可，不按国家重复请求
  const scopedCountries = isGlobal ? [GLOBAL_COUNTRY] : countries

  const tasks: { country: string; year: number }[] = []
  for (const country of scopedCountries) {
    for (const year of years) tasks.push({ country, year })
  }

  const rows = await mapLimit(tasks, 8, ({ country, year }) => loadYear(indicator, country, year))
  return rows
}

/** 供测试重置缓存与限流冷却状态（生产无副作用） */
export function resetAIIndicatorCache(): void {
  cache.clear()
  githubQuotaExhaustedAt = 0
}
