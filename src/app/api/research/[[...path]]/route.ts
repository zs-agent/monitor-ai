// /api/research/* — 反向代理到 research-service（FastAPI，默认 127.0.0.1:8000）
// Next 侧不持有研究状态，只做透传；SSE（协作事件流）原样转发。
// 对外路径收敛为：
//   GET  /api/research/health              → {service}/health
//   GET  /api/research/history[/{task_id}] → {service}/research/history[/{task_id}]
//   POST /api/research/intel/{task_id}     → {service}/research/intel/{task_id}（跑情报岗位作业）
//   GET  /api/research/intel/{task_id}     → {service}/research/intel/{task_id}（读已生成产物）
//   POST /api/research/run                 → {service}/research
//   GET  /api/research/run/{id}            → {service}/research/{id}
//   GET  /api/research/run/{id}/events     → {service}/research/{id}/events
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE = (process.env.RESEARCH_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

function upstreamPath(segments: string[]): string {
  if (['contracts', 'demo', 'experiments'].includes(segments[0])) return `/research/${segments.map(encodeURIComponent).join('/')}`
  if (segments[0] === 'preview') return '/research/preview'
  if (segments[0] === 'health') return '/health'
  if (segments[0] === 'run') return `/research${segments.slice(1).map(s => `/${s}`).join('')}`
  if (segments[0] === 'history') return `/research/history${segments.slice(1).map(s => `/${s}`).join('')}`
  if (segments[0] === 'intel') return `/research/intel${segments.slice(1).map(s => `/${s}`).join('')}`
  return `/${segments.join('/')}`
}

async function handler(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const segments = (await params).path || []
  if (!['health', 'run', 'history', 'preview', 'intel', 'contracts', 'demo', 'experiments'].includes(segments[0] || '')) {
    return NextResponse.json({ error: 'Unknown research endpoint' }, { status: 404 })
  }
  if (request.method === 'POST') {
    const origin = request.headers.get('origin')
    try {
      if (origin && new URL(origin).host !== request.headers.get('host')) {
        return NextResponse.json({ error: 'Cross-origin mutation rejected' }, { status: 403 })
      }
    } catch { return NextResponse.json({ error: 'Invalid origin' }, { status: 403 }) }
  }
  const target = `${BASE}${upstreamPath(segments)}${request.nextUrl.search}`
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()
  if (body && new TextEncoder().encode(body).length > 2_000_000) {
    return NextResponse.json({ error: 'Research payload too large' }, { status: 413 })
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
      signal: request.signal,
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
        // SSE 经 nginx 时禁用缓冲，否则事件会被攒着一起下发
        'x-accel-buffering': 'no',
      },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      {
        error: `research-service 不可达（${BASE}）`,
        detail,
        hint: '启动：research-service/.venv/Scripts/python.exe -m uvicorn service.app:app --host 127.0.0.1 --port 8000',
      },
      { status: 502 },
    )
  }
}

export const GET = handler
export const POST = handler
