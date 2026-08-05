// Server-side proxy for GitHub Search API — hottest + latest AI repos
// Reuses shared fetch logic from lib/sources.
import { NextResponse } from 'next/server'
import { fetchTrendingRepos } from '@/lib/sources/github'

let dataCache: { data: any[]; fetchedAt: number } | null = null
const CACHE_TTL = 15 * 60 * 1000

export async function GET() {
  const now = Date.now()
  if (dataCache && now - dataCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(dataCache.data)
  }
  try {
    const repos = await fetchTrendingRepos(7)
    const simplified = repos.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      url: r.url,
      stars: r.stars,
      language: r.language,
      avatar: r.avatar,
    }))
    dataCache = { data: simplified, fetchedAt: now }
    return NextResponse.json(simplified)
  } catch {
    if (dataCache) return NextResponse.json(dataCache.data)
    return NextResponse.json({ error: 'Failed to fetch GitHub trending' }, { status: 502 })
  }
}
