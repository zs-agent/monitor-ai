import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import type { IndicatorValue } from '@/types/indicator'

const S2_API = 'https://api.semanticscholar.org/graph/v1/paper/search'
const GH_API = 'https://api.github.com/search/repositories'
const TIMEOUT = 15000

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
  const values: IndicatorValue[] = []

  for (const country of countries) {
    for (let year = yearStart; year <= yearEnd; year++) {
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

      values.push({
        country,
        countryName: country === 'USA' ? 'United States' : country === 'CHN' ? 'China' : country,
        year,
        value,
        indicator,
      })
    }
  }

  return values
}
