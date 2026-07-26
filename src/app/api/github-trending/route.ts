// Server-side proxy for GitHub Search API — hottest + latest AI repos
// Merges "most-starred all-time" with "trending this month" for balanced results
// Caches for 15 minutes; GitHub public API allows 60 req/hr without auth
import { NextResponse } from 'next/server'

interface Repo {
  id: number
  name: string
  description: string | null
  url: string
  stars: number
  language: string | null
  avatar: string | null
}

let cache: { data: Repo[]; fetchedAt: number } | null = null
const CACHE_TTL = 15 * 60 * 1000

async function fetchRepoSet(query: string, perPage: number): Promise<Repo[]> {
  const res = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${perPage}`,
    {
      headers: (() => {
        const h: Record<string, string> = { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'monitor-ai/1.0' }
        if (process.env.GITHUB_TOKEN) h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
        return h
      })(),
      next: { revalidate: 900 },
    },
  )
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
  const body = await res.json()
  return (body.items || []).map((r: any) => ({
    id: r.id,
    name: r.full_name,
    description: r.description,
    url: r.html_url,
    stars: r.stargazers_count ?? 0,
    language: r.language,
    avatar: r.owner?.avatar_url ?? null,
  }))
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    // Fire two queries in parallel:
    // 1. Most-starred AI repos all-time ("最火")
    // 2. AI repos active this month ("最新")
    const monthStart = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const [allTime, recent] = await Promise.allSettled([
      fetchRepoSet(`ai llm machine-learning stars:>1000`, 10),
      fetchRepoSet(`ai llm machine-learning pushed:>${monthStart} stars:>50`, 8),
    ])

    const all: Repo[] = []
    const seen = new Set<number>()

    const push = (r: Repo) => { if (!seen.has(r.id)) { seen.add(r.id); all.push(r) } }

    // Interleave: hottest first, then trending for freshness
    const hot = allTime.status === 'fulfilled' ? allTime.value : []
    const trend = recent.status === 'fulfilled' ? recent.value : []

    for (let i = 0; i < Math.max(hot.length, trend.length); i++) {
      if (i < hot.length) push(hot[i])
      if (i < trend.length) push(trend[i])
    }

    const repos = all.slice(0, 7)

    cache = { data: repos, fetchedAt: now }
    return NextResponse.json(repos)
  } catch (e) {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ error: 'Failed to fetch GitHub trending' }, { status: 502 })
  }
}
