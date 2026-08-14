import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 全部 provider 都失败，用于验证 B2：全失败时必须 throw，aggregateSignals 才能置 staleUsed
vi.mock('@/lib/sources', () => ({
  providers: [
    { id: 'fail-a', name: 'Fail A', pollIntervalMs: 1000, fetchSignals: () => Promise.reject(new Error('boom-a')) },
    { id: 'fail-b', name: 'Fail B', pollIntervalMs: 1000, fetchSignals: () => Promise.reject(new Error('boom-b')) },
  ],
}))

import { refreshLocale, aggregateSignals } from '@/lib/aggregate'

describe('aggregate 全源失败（B2 stale 降级）', () => {
  beforeEach(() => {
    // 固定时间：远晚于仓库自带快照的 fetchedAt，保证走刷新路径而非 fromCache
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-01-01T00:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshLocale 全失败时 throw（无论是否有旧快照）', async () => {
    await expect(refreshLocale('zh')).rejects.toThrow('All providers failed')
  })

  it('aggregateSignals 全失败且有旧快照 → staleUsed=true，返回旧数据而非 mock', async () => {
    const outcome = await aggregateSignals('zh', 'all')
    expect(outcome.staleUsed).toBe(true)
    expect(outcome.fromCache).toBe(false)
    expect(outcome.fallbackMock).toBe(false)
    // 旧快照中的 zh 信号（GH 10 + S2 10）应原样返回
    expect(outcome.signals.length).toBeGreaterThan(0)
    expect(outcome.signals.every(s => s.language === 'zh')).toBe(true)
  })
})
