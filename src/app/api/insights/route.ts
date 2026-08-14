// This is a Next.js API route handler (not a React component)
import { NextRequest, NextResponse } from 'next/server'
import { getInsights } from '@/lib/insights/pipeline'
import type { InsightsSnapshot } from '@/lib/insights/types'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const localeParam = searchParams.get('locale') || 'en'

  if (localeParam !== 'zh' && localeParam !== 'en') {
    return NextResponse.json({ error: `Invalid locale '${localeParam}'. Must be 'zh' or 'en'.` }, { status: 400 })
  }
  const locale = localeParam as 'zh' | 'en'

  const snapshot: InsightsSnapshot = await getInsights(locale)
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}

/** POST /api/insights?locale=zh → 强制重新生成（手动刷新按钮用） */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const localeParam = searchParams.get('locale') || 'en'

  if (localeParam !== 'zh' && localeParam !== 'en') {
    return NextResponse.json({ error: `Invalid locale '${localeParam}'. Must be 'zh' or 'en'.` }, { status: 400 })
  }
  const locale = localeParam as 'zh' | 'en'

  const snapshot = await getInsights(locale, true)
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
