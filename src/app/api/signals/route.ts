// This is a Next.js API route handler (not a React component)
import { NextRequest, NextResponse } from 'next/server'
import { fetchHNTopStories } from '@/lib/hn'
import { fetchHFPapers } from '@/lib/huggingface'
import { normalizeHNSignal, normalizeHFPaper } from '@/lib/normalizer'
import { dataFreshness } from '@/lib/data-freshness'
import { mockSignals } from '@/data/mock-signals'
import type { Signal } from '@/types/signal'

const cache = new Map<string, { signals: Signal[]; fetchedAt: number; sourceHealth: Record<string, string> }>()
const CACHE_TTL = 5 * 60 * 1000

dataFreshness.register('hackernews', 'Hacker News')
dataFreshness.register('huggingface', 'HuggingFace Papers')

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = (searchParams.get('locale') || 'en') as 'zh' | 'en'
  const category = searchParams.get('category') || 'all'

  const cacheKey = `${locale}:${category}`
  const now = Date.now()

  const cached = cache.get(cacheKey)
  if (cached && (now - cached.fetchedAt) < CACHE_TTL) {
    return NextResponse.json({
      signals: cached.signals,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
      sourceHealth: cached.sourceHealth,
      freshness: dataFreshness.getSummary(),
    })
  }

  const [hnItems, hfPapers] = await Promise.allSettled([
    fetchHNTopStories(),
    fetchHFPapers(),
  ])

  const sourceHealth: Record<string, string> = {}

  const hnSignals: Signal[] = []
  if (hnItems.status === 'fulfilled') {
    hnItems.value.forEach(item => {
      hnSignals.push(normalizeHNSignal(item, 'en'))
      if (locale === 'zh') {
        hnSignals.push({
          ...normalizeHNSignal(item, 'zh'),
          id: `hn-${item.id}-zh`,
          language: 'zh',
        })
      }
    })
    sourceHealth['hackernews'] = 'ok'
    dataFreshness.recordUpdate('hackernews', hnItems.value.length)
  } else {
    sourceHealth['hackernews'] = 'error'
    dataFreshness.recordError('hackernews', 'Network error')
  }

  const hfSignals: Signal[] = []
  if (hfPapers.status === 'fulfilled') {
    hfPapers.value.forEach(paper => {
      hfSignals.push(normalizeHFPaper(paper, 'en'))
      if (locale === 'zh') {
        hfSignals.push({
          ...normalizeHFPaper(paper, 'zh'),
          id: `${paper.id}-zh`,
          language: 'zh',
        })
      }
    })
    sourceHealth['huggingface'] = 'ok'
    dataFreshness.recordUpdate('huggingface', hfPapers.value.length)
  } else {
    sourceHealth['huggingface'] = 'error'
    dataFreshness.recordError('huggingface', 'API unavailable')
  }

  // If both HN and HF failed, try returning stale cached data rather than nothing
  if (hnItems.status === 'rejected' && hfPapers.status === 'rejected') {
    const stale = cache.get(cacheKey)
    if (stale) {
      return NextResponse.json({
        signals: stale.signals,
        fetchedAt: new Date(stale.fetchedAt).toISOString(),
        sourceHealth: stale.sourceHealth,
        freshness: dataFreshness.getSummary(),
        stale: true,
      })
    }
  }

  const allSignals = [...hnSignals, ...hfSignals, ...mockSignals]

  const seen = new Set<string>()
  const unique: Signal[] = []
  for (const s of allSignals) {
    const key = s.title.toLowerCase().slice(0, 40)
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(s)
    }
  }

  let filtered = unique.filter(s => s.language === locale)
  if (category !== 'all') filtered = filtered.filter(s => s.category === category)

  const sorted = filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  cache.set(cacheKey, {
    signals: sorted,
    fetchedAt: now,
    sourceHealth,
  })

  return NextResponse.json({
    signals: sorted,
    fetchedAt: new Date(now).toISOString(),
    sourceHealth,
    freshness: dataFreshness.getSummary(),
  })
}
