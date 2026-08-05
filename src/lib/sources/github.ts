import type { Signal } from '@/types/signal'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { normalizeGitHubRepo, type RawGitHubRepo } from '@/lib/normalizer'
import type { SignalProvider } from './types'

const TIMEOUT = 8000
const PER_PAGE = 10

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'monitor-ai/1.0',
  }
  if (process.env.GITHUB_TOKEN) h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  return h
}

async function searchRepos(query: string, perPage: number): Promise<RawGitHubRepo[]> {
  const res = await fetchWithTimeout(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`,
    { headers: githubHeaders(), next: { revalidate: 900 } },
    TIMEOUT,
  )
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`)
  const body = await res.json()
  return (body.items || []).map((r: any) => ({
    id: r.id,
    name: r.full_name,
    description: r.description,
    url: r.html_url,
    stars: r.stargazers_count ?? 0,
    language: r.language,
    avatar: r.owner?.avatar_url ?? null,
    pushedAt: r.pushed_at,
  }))
}

/** 供 /api/github-trending 路由复用：热门 + 本月新兴交错合并 */
export async function fetchTrendingRepos(limit = 7): Promise<RawGitHubRepo[]> {
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const [allTime, recent] = await Promise.allSettled([
    searchRepos('artificial intelligence OR machine learning OR LLM', PER_PAGE),
    searchRepos(`AI OR LLM created:>${monthAgo}`, PER_PAGE),
  ])

  const seen = new Set<number>()
  const all: RawGitHubRepo[] = []
  const push = (r: RawGitHubRepo) => { if (!seen.has(r.id)) { seen.add(r.id); all.push(r) } }
  const hot = allTime.status === 'fulfilled' ? allTime.value : []
  const trend = recent.status === 'fulfilled' ? recent.value : []
  for (let i = 0; i < Math.max(hot.length, trend.length); i++) {
    if (i < hot.length) push(hot[i])
    if (i < trend.length) push(trend[i])
  }
  if (all.length === 0) throw new Error('GitHub: both queries failed')
  return all.slice(0, limit)
}

export const githubProvider: SignalProvider = {
  id: 'github',
  name: 'GitHub Trending',
  async fetchSignals(locale) {
    const repos = await fetchTrendingRepos(10)
    const signals: Signal[] = []
    for (const repo of repos) {
      try {
        signals.push(normalizeGitHubRepo(repo, locale))
      } catch {
        console.warn(`[github] skip malformed repo ${repo?.id}`)
      }
    }
    return signals
  },
}
