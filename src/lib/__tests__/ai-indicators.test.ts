import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAIIndicatorData, resetAIIndicatorCache, GLOBAL_COUNTRY } from '@/lib/sources/ai-indicators'

function mockResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

const isS2 = (url: string) => url.startsWith('https://api.semanticscholar.org')
const isGh = (url: string) => url.startsWith('https://api.github.com')
const isHN = (url: string) => url.startsWith('https://hn.algolia.com')

describe('fetchAIIndicatorData', () => {
  beforeEach(() => {
    resetAIIndicatorCache()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('并行抓取 AI.PAPERS：USA/CHN 各自返回全年份', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (isS2(String(url))) return mockResponse({ total: 100 })
      return mockResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    const rows = await fetchAIIndicatorData('AI.PAPERS', ['USA', 'CHN'], 2020, 2021)
    expect(rows).toHaveLength(4) // 2 国 × 2 年
    const usa = rows.filter(r => r.country === 'USA')
    expect(usa).toHaveLength(2)
    expect(usa.map(r => r.year).sort()).toEqual([2020, 2021])
    expect(usa.every(r => r.value === 100)).toBe(true)
    expect(rows.every(r => r.indicator === 'AI.PAPERS')).toBe(true)
  })

  it('AI.PAPERS 按国家区分查询（country 参数有效）', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const s = String(url)
      if (s.includes('china')) return mockResponse({ total: 50 })
      return mockResponse({ total: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const rows = await fetchAIIndicatorData('AI.PAPERS', ['USA', 'CHN'], 2020, 2020)
    const usa = rows.find(r => r.country === 'USA')!
    const chn = rows.find(r => r.country === 'CHN')!
    expect(usa.value).toBe(200)
    expect(chn.value).toBe(50)
  })

  it('全球口径 AI.GITHUB：仅返回 WLD 单序列，且每年只请求一次（不再按国家重复）', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (isGh(String(url))) return mockResponse({ total_count: 500 })
      return mockResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    const rows = await fetchAIIndicatorData('AI.GITHUB', ['USA', 'CHN'], 2020, 2021)
    expect(rows).toHaveLength(2) // 每年一条，不按国家重复
    expect(rows.map(r => r.country)).toEqual([GLOBAL_COUNTRY, GLOBAL_COUNTRY])
    expect(rows.map(r => r.year)).toEqual([2020, 2021])
    expect(rows.every(r => r.value === 500)).toBe(true)

    const ghCalls = fetchMock.mock.calls.filter(c => isGh(String(c[0])))
    expect(ghCalls).toHaveLength(2) // 2 年只打 2 次 GitHub（原实现为 4 次）
  })

  it('全球口径 AI.NEWS：返回 WLD 单序列', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (isHN(String(url))) return mockResponse({ nbHits: 999 })
      return mockResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    const rows = await fetchAIIndicatorData('AI.NEWS', ['USA', 'CHN'], 2020, 2020)
    expect(rows).toHaveLength(1)
    expect(rows[0].country).toBe(GLOBAL_COUNTRY)
    expect(rows[0].value).toBe(999)
  })

  it('缓存生效：相同参数第二次请求不重复打外部 API', async () => {
    const fetchMock = vi.fn(async (url: string) => mockResponse({ total: 42 }))
    vi.stubGlobal('fetch', fetchMock)

    await fetchAIIndicatorData('AI.PAPERS', ['USA'], 2020, 2020)
    const callsAfterFirst = fetchMock.mock.calls.length
    await fetchAIIndicatorData('AI.PAPERS', ['USA'], 2020, 2020)
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst) // 未新增请求
  })

  it('GitHub 限流（429）后进入冷却：后续请求不再调用 API，兜底为缓存/0', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (isGh(String(url))) return mockResponse({ message: 'rate limited' }, 429)
      return mockResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    const rows1 = await fetchAIIndicatorData('AI.GITHUB', ['USA', 'CHN'], 2020, 2020)
    expect(rows1[0].value).toBe(0) // 首次无缓存 → 兜底 0

    const ghCallsAfterFirst = fetchMock.mock.calls.filter(c => isGh(String(c[0]))).length

    const rows2 = await fetchAIIndicatorData('AI.GITHUB', ['USA', 'CHN'], 2020, 2020)
    expect(rows2[0].value).toBe(0)
    const ghCallsAfterSecond = fetchMock.mock.calls.filter(c => isGh(String(c[0]))).length
    // 冷却期内不再打 GitHub API
    expect(ghCallsAfterSecond).toBe(ghCallsAfterFirst)
  })

  it('失败时回退过期缓存（stale 兜底），不出现断崖 0', async () => {
    vi.useFakeTimers()
    try {
      // 第一次成功 → 缓存 500
      const okMock = vi.fn(async (url: string) => {
        if (isGh(String(url))) return mockResponse({ total_count: 500 })
        return mockResponse({})
      })
      vi.stubGlobal('fetch', okMock)
      const first = await fetchAIIndicatorData('AI.GITHUB', ['USA', 'CHN'], 2020, 2020)
      expect(first[0].value).toBe(500)

      // 缓存过期（超过 12h TTL）
      vi.advanceTimersByTime(13 * 60 * 60 * 1000)

      // 第二次失败（超时/网络）→ 回退过期缓存 500，而不是 0
      const failMock = vi.fn(async (url: string) => {
        if (isGh(String(url))) return mockResponse({ message: 'boom' }, 500)
        return mockResponse({})
      })
      vi.stubGlobal('fetch', failMock)
      const second = await fetchAIIndicatorData('AI.GITHUB', ['USA', 'CHN'], 2020, 2020)
      expect(second[0].value).toBe(500)
    } finally {
      vi.useRealTimers()
    }
  })
})
