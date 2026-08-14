import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import type { IndicatorValue } from '@/types/indicator'

const S2_API = 'https://api.semanticscholar.org/graph/v1/paper/search'
const GH_API = 'https://api.github.com/search/repositories'
const TIMEOUT = 15000

/** 结果缓存：指标×国家×年份 → 数值。AI 原生指标变化缓慢，TTL 30min 避免重复请求。 */
const CACHE_TTL = 30 * 60 * 1000
const resultCache = new Map<string, { value: number; ts: number }>()

/** 并发上限：避免 34 个请求同时打向第三方 API 触发限流 */
const MAX_CONCURRENCY = 6

async function cachedValue(key: string, fetch: () => Promise<number>): Promise<number> {
  const hit = resultCache.get(key)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.value
  const value = await fetch()
  resultCache.set(key, { value, ts: Date.now() })
  return value
}

/** 有界并发执行：按 items 顺序返回结果，任一项失败不影响其余（fetch 函数自带 catch） */
async function mapWithConcurrency<T>(items: T[], worker: (item: T) => Promise<number>): Promise<number[]> {
  const results = new Array<number>(items.length)
  let next = 0
  const runner = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++
      results[i] = await worker(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENCY, items.length) }, () => runner()))
  return results
}

function countryNameOf(country: string): string {
  return country === 'USA' ? 'United States' : country === 'CHN' ? 'China' : country
}

/** 从 Semantic Scholar 按年份统计 AI 论文数量 */
async function fetchPapersByYear(year: number, country: string): Promise<number> {
  try {
    const query = country === 'CHN'
      ? 'large language model artificial intelligence china'
      : country === 'USA'
        ? 'large language model artificial intelligence'
        : 'machine learning deep learning'
    const res = await fetchWithTimeout(
      `${S2_API}?query=${encodeURIComponent(query)}&year=${year}&limit=1`,
      {},
      TIMEOUT,
    )
    if (!res.ok) return 0
    const body = await res.json()
    return body?.total || 0
  } catch {
    return 0
  }
}

/** 从 GitHub 按年份统计 AI 仓库数量 */
async function fetchGitHubByYear(year: number): Promise<number> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'monitor-ai/1.0',
    }
    if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
    const res = await fetchWithTimeout(
      `${GH_API}?q=${encodeURIComponent(`AI created:${year}-01-01..${year}-12-31`)}&per_page=1`,
      { headers },
      TIMEOUT,
    )
    if (!res.ok) return 0
    const body = await res.json()
    return body?.total_count || 0
  } catch {
    return 0
  }
}

/** 从 Hacker News 按年份统计 AI 相关帖子数量 */
async function fetchHNByYear(year: number): Promise<number> {
  try {
    // HN Algolia API supports date range search
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    const res = await fetchWithTimeout(
      `https://hn.algolia.com/api/v1/search?query=AI+OR+artificial+intelligence+OR+machine+learning&tags=story&numericFilters=created_at_i>=${new Date(start).getTime()/1000},created_at_i<=${new Date(end).getTime()/1000}&hitsPerPage=1`,
      {},
      TIMEOUT,
    )
    if (!res.ok) return 0
    const body = await res.json()
    return body?.nbHits || 0
  } catch {
    return 0
  }
}

/** 获取 AI 原生指标的时间序列数据 */
export async function fetchAIIndicatorData(
  indicator: string,
  countries: string[],
  yearStart: number,
  yearEnd: number,
): Promise<IndicatorValue[]> {
  const years: number[] = []
  for (let year = yearStart; year <= yearEnd; year++) years.push(year)

  // AI.GITHUB / AI.NEWS 不区分国家：每年只请求一次，各国复用同一数值，
  // 避免同一数值为每个国家重复请求（原实现 34 次串行请求）
  if (indicator === 'AI.GITHUB' || indicator === 'AI.NEWS') {
    const byYear = await mapWithConcurrency(years, year =>
      cachedValue(`${indicator}:*:${year}`, () =>
        indicator === 'AI.GITHUB' ? fetchGitHubByYear(year) : fetchHNByYear(year)),
    )
    const values: IndicatorValue[] = []
    for (const country of countries) {
      for (let i = 0; i < years.length; i++) {
        values.push({
          country,
          countryName: countryNameOf(country),
          year: years[i],
          value: byYear[i],
          indicator,
        })
      }
    }
    return values
  }

  // AI.PAPERS：国家 × 年份并行拉取（有界并发），结果按原顺序组装
  const tasks: { country: string; year: number }[] = []
  for (const country of countries) {
    for (const year of years) tasks.push({ country, year })
  }
  const results = await mapWithConcurrency(tasks, t =>
    cachedValue(`${indicator}:${t.country}:${t.year}`, () => fetchPapersByYear(t.year, t.country)))

  const values: IndicatorValue[] = []
  for (let i = 0; i < tasks.length; i++) {
    values.push({
      country: tasks[i].country,
      countryName: countryNameOf(tasks[i].country),
      year: tasks[i].year,
      value: results[i],
      indicator,
    })
  }
  return values
}
