// Server-side proxy for Semantic Scholar API — latest AI papers
// Reuses shared fetch logic from lib/sources.
import { NextResponse } from 'next/server'
import { fetchLatestPapers } from '@/lib/sources/semanticscholar'

export const dynamic = 'force-dynamic'

let dataCache: { data: any[]; fetchedAt: number } | null = null
const CACHE_TTL = 30 * 60 * 1000

export async function GET() {
  const now = Date.now()
  if (dataCache && now - dataCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(dataCache.data)
  }
  try {
    const papers = await fetchLatestPapers(7)
    const simplified = papers.map(p => ({
      id: p.id,
      title: p.title,
      url: p.url,
      date: p.date,
      citations: p.citations,
      authors: p.authors,
      summary: p.summary,
    }))
    dataCache = { data: simplified, fetchedAt: now }
    return NextResponse.json(simplified)
  } catch {
    if (dataCache) return NextResponse.json(dataCache.data)
    return NextResponse.json({ error: 'Failed to fetch papers' }, { status: 502 })
  }
}
