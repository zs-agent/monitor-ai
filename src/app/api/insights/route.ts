import { NextRequest, NextResponse } from 'next/server'
import { getInsights } from '@/lib/insights/pipeline'
import { SIGNAL_WINDOW_MS, type SignalWindow } from '@/lib/browse-data'

export const dynamic = 'force-dynamic'
async function respond(request: NextRequest, force: boolean) {
  const params = new URL(request.url).searchParams
  const locale = params.get('locale') || 'en'
  const scope = params.get('window') || 'all'
  const query = (params.get('q') || '').trim()
  if ((locale !== 'zh' && locale !== 'en') || !Object.hasOwn(SIGNAL_WINDOW_MS, scope) || query.length > 200)
    return NextResponse.json({ error: 'Invalid locale, window or query' }, { status: 400 })
  try {
    return NextResponse.json(await getInsights(locale, force, scope as SignalWindow, query), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: '洞察暂时不可用，请重试' }, { status: 503 })
  }
}
export async function GET(request: NextRequest) { return respond(request, false) }
export async function POST(request: NextRequest) { return respond(request, true) }
