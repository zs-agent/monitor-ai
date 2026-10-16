// This is a Next.js API route handler (not a React component)
import { NextRequest, NextResponse } from 'next/server'
import { aggregateSignals, applyFilters } from '@/lib/aggregate'
import { ensurePollerStarted } from '@/lib/poller'
import { dataFreshness } from '@/lib/data-freshness'
import { getMockSignals } from '@/data/mock-signals'

const VALID_CATEGORIES = ['models', 'products', 'industry', 'papers', 'tips'] as const

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const localeParam = searchParams.get('locale') || 'en'
  const category = searchParams.get('category') || 'all'
  const forceMock = searchParams.get('mock') === '1'

  if (localeParam !== 'zh' && localeParam !== 'en') {
    return NextResponse.json({ error: `Invalid locale '${localeParam}'. Must be 'zh' or 'en'.` }, { status: 400 })
  }
  if (category !== 'all' && !(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: `Invalid category '${category}'. Must be one of: all, ${VALID_CATEGORIES.join(', ')}` }, { status: 400 })
  }
  const locale = localeParam as 'zh' | 'en'

  // 显式 mock 模式：仅返回 mock 数据（用于调试）
  if (forceMock) {
    const filtered = applyFilters(getMockSignals(), locale, category)
    return NextResponse.json({
      signals: filtered,
      fetchedAt: new Date(Date.now()).toISOString(),
      sourceHealth: { mock: 'ok' },
      sourceStates: dataFreshness.getAllSources(),
      freshness: dataFreshness.getSummary(),
      fallback: 'mock',
    })
  }

  // 惰性启动后台分级轮询（首请求后常驻刷新快照，后续请求基本命中缓存、零网络）
  ensurePollerStarted()

  const outcome = await aggregateSignals(locale, category, searchParams.get('refresh') === '1')

  const body = {
    signals: outcome.signals,
    fetchedAt: new Date(outcome.fetchedAt).toISOString(),
    sourceHealth: outcome.sourceHealth,
    sourceStates: dataFreshness.getAllSources(),
    freshness: dataFreshness.getSummary(),
  }

  if (outcome.fallbackMock) {
    return NextResponse.json({ ...body, fallback: 'mock' }, {
      headers: { 'Cache-Control': 'no-cache' },
    })
  }
  if (outcome.staleUsed) {
    return NextResponse.json({ ...body, stale: true }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    })
  }
  if (outcome.fromCache) {
    return NextResponse.json({ ...body, cached: true }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  }
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
