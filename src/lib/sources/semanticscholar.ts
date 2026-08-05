import type { Signal } from '@/types/signal'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { normalizeS2Paper, type RawS2Paper } from '@/lib/normalizer'
import type { SignalProvider } from './types'

const TIMEOUT = 8000

/** 供 /api/ai-papers 路由复用 */
export async function fetchLatestPapers(limit = 7): Promise<RawS2Paper[]> {
  const thisYear = new Date().getFullYear()
  const res = await fetchWithTimeout(
    'https://api.semanticscholar.org/graph/v1/paper/search' +
    `?query=large+language+model+artificial+intelligence` +
    `&year=${thisYear}&limit=10` +
    `&fields=title,url,publicationDate,citationCount,authors,tldr`,
    { next: { revalidate: 1800 } },
    TIMEOUT,
  )
  if (!res.ok) throw new Error(`Semantic Scholar HTTP ${res.status}`)
  const body = await res.json()
  const papers: RawS2Paper[] = (body.data || []).map((p: any) => ({
    id: p.paperId,
    title: p.title,
    url: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
    date: p.publicationDate || '',
    citations: p.citationCount ?? 0,
    authors: (p.authors || []).slice(0, 3).map((a: any) => a.name),
    summary: p.tldr?.text ?? null,
  }))
  const sorted = papers.sort((a, b) => {
    if (a.date && b.date) return b.date.localeCompare(a.date)
    if (a.date) return -1
    if (b.date) return 1
    return b.citations - a.citations
  })
  return sorted.slice(0, limit)
}

export const semanticscholarProvider: SignalProvider = {
  id: 'semanticscholar',
  name: 'Semantic Scholar',
  async fetchSignals(locale) {
    const papers = await fetchLatestPapers(10)
    const signals: Signal[] = []
    for (const paper of papers) {
      try {
        signals.push(normalizeS2Paper(paper, locale))
      } catch {
        console.warn(`[semanticscholar] skip malformed paper ${paper?.id}`)
      }
    }
    return signals
  },
}
