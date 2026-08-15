import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/server', () => {
  return {
    NextRequest: class {
      url: string
      headers: Headers
      constructor(url: string, init: { headers?: Record<string, string> } = {}) {
        this.url = url
        this.headers = new Headers(init.headers)
      }
    },
    NextResponse: {
      json: (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) => ({
        body,
        status: init.status ?? 200,
        headers: init.headers ?? {},
      }),
    },
  }
})

vi.mock('@/lib/insights/pipeline', () => ({
  getInsights: vi.fn(async () => ({ insights: [], generatedAt: Date.now(), hasLlm: false })),
}))

import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/insights/route'
import { resetInsightsRateLimiters } from '@/lib/insights/rate-limiters'

function makeReq(ip?: string, locale = 'en'): NextRequest {
  return new NextRequest(
    `http://localhost/api/insights?locale=${locale}`,
    { headers: ip ? { 'x-forwarded-for': ip } : {} },
  ) as unknown as NextRequest
}

describe('insights route 限流', () => {
  beforeEach(() => {
    resetInsightsRateLimiters()
    vi.clearAllMocks()
  })

  it('POST 允许容量内刷新，超限返回 429', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await POST(makeReq('10.0.0.1'))
      expect(r.status).toBe(200)
    }
    const r = await POST(makeReq('10.0.0.1'))
    expect(r.status).toBe(429)
    expect(r.headers['Retry-After']).toBeDefined()
  })

  it('不同 IP 独立计数', async () => {
    // IP A 打满
    for (let i = 0; i < 3; i++) await POST(makeReq('10.0.0.1'))
    expect((await POST(makeReq('10.0.0.1'))).status).toBe(429)
    // IP B 仍可刷新
    expect((await POST(makeReq('10.0.0.2'))).status).toBe(200)
  })

  it('GET 正常返回，低流量不受限', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await GET(makeReq('10.0.0.9'))
      expect(r.status).toBe(200)
    }
  })

  it('locale 非法返回 400（不消耗限流配额）', async () => {
    const r = await POST(makeReq('10.0.0.1', 'fr'))
    expect(r.status).toBe(400)
  })
})
