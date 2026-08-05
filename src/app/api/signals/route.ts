// This is a Next.js API route handler (not a React component)
import { NextRequest, NextResponse } from 'next/server'
import { providers } from '@/lib/sources'
import { dataFreshness } from '@/lib/data-freshness'
import { getMockSignals } from '@/data/mock-signals'
import type { Signal } from '@/types/signal'

const VALID_CATEGORIES = ['models', 'products', 'industry', 'papers', 'tips'] as const

interface CacheEntry {
  signals: Signal[]
  fetchedAt: number
  sourceHealth: Record<string, string>
}
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 5 * 60 * 1000

// Register all providers with freshness tracker
for (const p of providers) {
  dataFreshness.register(p.id, p.name)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get('locale') || 'en'
  const category = searchParams.get('category') || 'all'
  const forceMock = searchParams.get('mock') === '1'

  if (locale !== 'zh' && locale !== 'en') {
    return NextResponse.json({ error: `Invalid locale '${locale}'. Must be 'zh' or 'en'.` }, { status: 400 })
  }
  if (category !== 'all' && !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: `Invalid category '${category}'. Must be one of: all, ${VALID_CATEGORIES.join(', ')}` }, { status: 400 })
  }

  const cacheKey = `${locale}:${category}`
  const now = Date.now()

  // 显式 mock 模式：仅返回 mock 数据（用于调试）
  if (forceMock) {
    const filtered = applyFilters(getMockSignals(), locale, category)
    return NextResponse.json({
      signals: filtered,
      fetchedAt: new Date(now).toISOString(),
      sourceHealth: { mock: 'ok' },
      sourceStates: dataFreshness.getAllSources(),
      freshness: dataFreshness.getSummary(),
      fallback: 'mock',
    })
  }

  // Check cache
  const cached = cache.get(cacheKey)
  if (cached && (now - cached.fetchedAt) < CACHE_TTL) {
    return NextResponse.json({
      signals: cached.signals,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
      sourceHealth: cached.sourceHealth,
      sourceStates: dataFreshness.getAllSources(),
      freshness: dataFreshness.getSummary(),
      cached: true,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  }

  // Fetch from all providers in parallel
  const results = await Promise.allSettled(
    providers.map(p => p.fetchSignals(locale))
  )

  const sourceHealth: Record<string, string> = {}
  const allSignals: Signal[] = []

  for (let i = 0; i < providers.length; i++) {
    const p = providers[i]
    const r = results[i]
    if (r.status === 'fulfilled') {
      allSignals.push(...r.value)
      sourceHealth[p.id] = 'ok'
      dataFreshness.recordUpdate(p.id, r.value.length)
    } else {
      const errMsg = r.reason?.message || 'Unknown error'
      sourceHealth[p.id] = 'error'
      dataFreshness.recordError(p.id, errMsg)
    }
  }

  // 全部真实源失败：尝试 stale 缓存，没有则用 mock 作为最后 fallback
  const anyOk = Object.values(sourceHealth).some(v => v === 'ok')
  if (!anyOk) {
    const stale = cache.get(cacheKey)
    if (stale) {
      return NextResponse.json({
        signals: stale.signals,
        fetchedAt: new Date(stale.fetchedAt).toISOString(),
        sourceHealth: stale.sourceHealth,
        sourceStates: dataFreshness.getAllSources(),
        freshness: dataFreshness.getSummary(),
        stale: true,
      }, {
        headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
      })
    }
    // 连 stale 都没有，使用 mock 作为最后 fallback，并标记
    const filtered = applyFilters(getMockSignals(), locale, category)
    return NextResponse.json({
      signals: filtered,
      fetchedAt: new Date(now).toISOString(),
      sourceHealth,
      sourceStates: dataFreshness.getAllSources(),
      freshness: dataFreshness.getSummary(),
      fallback: 'mock',
    }, {
      headers: { 'Cache-Control': 'no-cache' },
    })
  }

  // 去重 + 过滤
  const seen = new Set<string>()
  const unique: Signal[] = []
  for (const s of allSignals) {
    const key = s.title.toLowerCase().slice(0, 40)
    if (!seen.has(key)) { seen.add(key); unique.push(s) }
  }

  let filtered = unique.filter(s => s.language === locale)
  if (category !== 'all') filtered = filtered.filter(s => s.category === category)

  const sorted = filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

  cache.set(cacheKey, { signals: sorted, fetchedAt: now, sourceHealth })

  return NextResponse.json({
    signals: sorted,
    fetchedAt: new Date(now).toISOString(),
    sourceHealth,
    sourceStates: dataFreshness.getAllSources(),
    freshness: dataFreshness.getSummary(),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}

function applyFilters(signals: Signal[], locale: string, category: string): Signal[] {
  let r = signals.filter(s => s.language === locale)
  if (category !== 'all') r = r.filter(s => s.category === category)
  return r.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}
