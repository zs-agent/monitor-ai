import { NextRequest, NextResponse } from 'next/server'
import { fetchHNTopStories } from '@/lib/hn'
import { fetchHFPapers } from '@/lib/huggingface'
import { normalizeHNSignal, normalizeHFPaper } from '@/lib/normalizer'
import { dataFreshness } from '@/lib/data-freshness'
import { mockSignals } from '@/data/mock-signals'
import type { Signal } from '@/types/signal'

let cache: { signals: Signal[]; fetchedAt: number; sourceHealth: Record<string, string> } | null = null
const CACHE_TTL = 5 * 60 * 1000

dataFreshness.register('hackernews', 'Hacker News')
dataFreshness.register('huggingface', 'HuggingFace Papers')

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = (searchParams.get('locale') || 'en') as 'zh' | 'en'
  const category = searchParams.get('category') || 'all'

  const now = Date.now()
  if (cache && (now - cache.fetchedAt) < CACHE_TTL) {
    let signals = cache.signals.filter(s => s.language === locale)
    if (category !== 'all') signals = signals.filter(s => s.category === category)
    return NextResponse.json({
      signals: signals.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
      fetchedAt: new Date(cache.fetchedAt).toISOString(),
      sourceHealth: cache.sourceHealth,
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

  cache = {
    signals: unique,
    fetchedAt: now,
    sourceHealth,
  }

  let filtered = unique.filter(s => s.language === locale)
  if (category !== 'all') filtered = filtered.filter(s => s.category === category)

  return NextResponse.json({
    signals: filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    fetchedAt: new Date(now).toISOString(),
    sourceHealth,
    freshness: dataFreshness.getSummary(),
  })
}
