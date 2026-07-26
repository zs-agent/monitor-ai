// Server-side proxy for Semantic Scholar API — latest AI papers
// Caches for 30 minutes since papers don't change rapidly
import { NextResponse } from 'next/server'

interface Paper {
  id: string
  title: string
  url: string
  date: string
  citations: number
  authors: string[]
  summary: string | null
}

let cache: { data: Paper[]; fetchedAt: number } | null = null
const CACHE_TTL = 30 * 60 * 1000

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.fetchedAt < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    // Search by relevance but get enough results to sort by date client-side
    const thisYear = new Date().getFullYear()
    const res = await fetch(
      'https://api.semanticscholar.org/graph/v1/paper/search' +
      `?query=large+language+model+artificial+intelligence` +
      `&year=${thisYear}&limit=10` +
      `&fields=title,url,publicationDate,citationCount,authors,tldr`,
      { next: { revalidate: 1800 } },
    )
    if (!res.ok) throw new Error(`Semantic Scholar API error: ${res.status}`)

    const body = await res.json()
    const allPapers = (body.data || []).map((p: any) => ({
      id: p.paperId || '',
      title: p.title || '',
      url: p.url || `https://semanticscholar.org/paper/${p.paperId || ''}`,
      date: (p.publicationDate || '').slice(0, 10),
      citations: p.citationCount ?? 0,
      authors: (p.authors || []).slice(0, 3).map((a: any) => a.name),
      summary: p.tldr?.text || null,
    }))

    // Sort by publicationDate descending (newest first), then by citations
    const sorted = allPapers.sort((a: Paper, b: Paper) => {
      if (a.date && b.date) return b.date.localeCompare(a.date)
      if (a.date) return -1
      if (b.date) return 1
      return b.citations - a.citations
    })

    const papers = sorted.slice(0, 7)

    cache = { data: papers, fetchedAt: now }
    return NextResponse.json(papers)
  } catch (e) {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json({ error: 'Failed to fetch papers' }, { status: 502 })
  }
}
