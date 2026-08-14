import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAIIndicatorData } from '@/lib/sources/ai-indicators'

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response
}

describe('ai-indicators.fetchAIIndicatorData（B3 并行 + 缓存 + 按国去重）', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url)
      if (u.includes('semanticscholar.org')) {
        const year = Number(u.match(/year=(\d+)/)?.[1] ?? 0)
        const chn = u.includes('china') ? 5000 : 0
        return jsonResponse({ total: 100 + year + chn })
      }
      if (u.includes('api.github.com')) {
        const year = Number(u.match(/created%3A(\d{4})-/)?.[1] ?? 0)
        return jsonResponse({ total_count: 200 + year })
      }
      if (u.includes('hn.algolia.com')) {
        const ts = Number(u.match(/created_at_i>=(\d+)/)?.[1] ?? 0)
        return jsonResponse({ nbHits: 300 + new Date(ts * 1000).getUTCFullYear() })
      }
      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  it('AI.GITHUB 不区分国家：每年只请求一次，各国复用同一数值', async () => {
    const values = await fetchAIIndicatorData('AI.GITHUB', ['USA', 'CHN'], 2020, 2021)
    expect(values).toHaveLength(4) // 2 国 × 2 年
    expect(fetchMock).toHaveBeenCalledTimes(2) // 只按年请求，不按国重复
    const usa2020 = values.find(v => v.country === 'USA' && v.year === 2020)!
    const chn2020 = values.find(v => v.country === 'CHN' && v.year === 2020)!
    expect(usa2020.value).toBe(2220)
    expect(chn2020.value).toBe(usa2020.value) // 同一数值
    // 顺序：国家外层、年份内层
    expect(values.map(v => `${v.country}:${v.year}`)).toEqual([
      'USA:2020', 'USA:2021', 'CHN:2020', 'CHN:2021',
    ])
  })

  it('结果缓存：相同参数二次调用不再发请求', async () => {
    await fetchAIIndicatorData('AI.GITHUB', ['USA', 'CHN'], 2020, 2021)
    const callsAfterFirst = fetchMock.mock.calls.length
    const values = await fetchAIIndicatorData('AI.GITHUB', ['USA', 'CHN'], 2020, 2021)
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst) // 全部命中缓存
    expect(values).toHaveLength(4)
  })

  it('AI.NEWS 同样按年去重', async () => {
    const values = await fetchAIIndicatorData('AI.NEWS', ['USA', 'CHN'], 2024, 2024)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(values).toHaveLength(2)
    expect(values[0].value).toBe(values[1].value)
  })

  it('AI.PAPERS 按国家×年份请求（并行），值按国家区分', async () => {
    const values = await fetchAIIndicatorData('AI.PAPERS', ['USA', 'CHN'], 2022, 2023)
    expect(values).toHaveLength(4)
    expect(fetchMock).toHaveBeenCalledTimes(4) // 2 国 × 2 年
    const usa = values.filter(v => v.country === 'USA').map(v => v.value)
    const chn = values.filter(v => v.country === 'CHN').map(v => v.value)
    expect(usa[0]).toBe(2122)
    expect(usa[1]).toBe(2123)
    expect(chn[0]).toBe(7122) // CHN 查询词不同（含 china）
    expect(chn[1]).toBe(7123)
  })
})
