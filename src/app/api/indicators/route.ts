import { NextRequest, NextResponse } from 'next/server'
import { fetchIndicatorData, searchIndicators } from '@/lib/sources/worldbank'
import { PRESET_INDICATORS } from '@/types/indicator'
import type { IndicatorResponse } from '@/types/indicator'

const CURRENT_YEAR = new Date().getFullYear()

// In-memory cache
const cache = new Map<string, { data: IndicatorResponse; ts: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 min (indicators change slowly)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'data'
  const indicator = searchParams.get('indicator') || ''
  const countries = searchParams.get('countries') || 'USA,CHN'
  const yearStart = parseInt(searchParams.get('yearStart') || '2010', 10)
  const yearEnd = parseInt(searchParams.get('yearEnd') || String(CURRENT_YEAR), 10)

  try {
    // 指标搜索
    if (action === 'search') {
      const q = searchParams.get('q') || ''
      return NextResponse.json({ results: searchIndicators(q) })
    }

    // 获取预设指标列表
    if (action === 'list') {
      return NextResponse.json({ indicators: PRESET_INDICATORS })
    }

    // 获取数据
    const cacheKey = `${indicator}:${countries}:${yearStart}-${yearEnd}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ ...cached.data, cached: true })
    }

    const data = await fetchIndicatorData({
      indicator,
      countries: countries.split(','),
      yearStart,
      yearEnd,
    })

    cache.set(cacheKey, { data, ts: Date.now() })
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    // 尝试返回过期缓存
    for (const entry of Array.from(cache.values())) {
      if (entry.data.meta?.id === indicator) {
        return NextResponse.json({ ...entry.data, stale: true, error: msg })
      }
    }
    return NextResponse.json({ error: msg, values: [], meta: null, missingInfo: [], fetchedAt: new Date().toISOString() })
  }
}
