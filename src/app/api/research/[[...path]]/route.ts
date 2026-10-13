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
  if (segments[0] === 'health') return '/health'
  if (segments[0] === 'run') return `/research${segments.slice(1).map(s => `/${s}`).join('')}`
  if (segments[0] === 'history') return `/research/history${segments.slice(1).map(s => `/${s}`).join('')}`
  if (segments[0] === 'intel') return `/research/intel${segments.slice(1).map(s => `/${s}`).join('')}`
  return `/${segments.join('/')}`
}

async function handler(request: NextRequest, { params }: { params: { path?: string[] } }) {
  const segments = params.path || []
  const target = `${BASE}${upstreamPath(segments)}${request.nextUrl.search}`
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text()

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
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
