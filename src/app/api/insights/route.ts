// This is a Next.js API route handler (not a React component)
import { NextRequest, NextResponse } from 'next/server'
import { getInsights } from '@/lib/insights/pipeline'
import { clientKey } from '@/lib/rate-limit'
import { postPerIp, postGlobal, getPerIp } from '@/lib/insights/rate-limiters'
import type { InsightsSnapshot } from '@/lib/insights/types'

type LocaleResult = { locale: 'zh' | 'en' } | { error: string }

function parseLocale(request: NextRequest): LocaleResult {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('locale') || 'en'
  if (raw !== 'zh' && raw !== 'en') return { error: `Invalid locale '${raw}'. Must be 'zh' or 'en'.` }
  return { locale: raw }
}

function tooMany(limiter: { retryAfterSec?: number }) {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Cache-Control': 'no-store',
        ...(limiter.retryAfterSec ? { 'Retry-After': String(limiter.retryAfterSec) } : {}),
      },
    },
  )
}

export async function GET(request: NextRequest) {
  const parsed = parseLocale(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const locale = parsed.locale

  const limit = getPerIp.take(clientKey(request))
  if (!limit.allowed) return tooMany(limit)

  const snapshot: InsightsSnapshot = await getInsights(locale)
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}

/** POST /api/insights?locale=zh → 强制重新生成（手动刷新按钮用） */
export async function POST(request: NextRequest) {
  const parsed = parseLocale(request)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const locale = parsed.locale

  const key = clientKey(request)
  const ip = postPerIp.take(key)
  if (!ip.allowed) return tooMany(ip)

  const global = postGlobal.take('__global__')
  if (!global.allowed) return tooMany(global)

  const snapshot = await getInsights(locale, true)
  return NextResponse.json(snapshot, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
