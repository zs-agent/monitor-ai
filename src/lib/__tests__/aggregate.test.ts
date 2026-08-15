import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import type { Signal } from '@/types/signal'

// 所有 provider 一律失败，用于降级链测试
vi.mock('@/lib/sources', () => ({
  providers: [
    { id: 'a', name: 'A', fetchSignals: vi.fn().mockRejectedValue(new Error('simulated outage')) },
  ],
}))

import { aggregateSignals, mergeSignals, applyFilters } from '@/lib/aggregate'

const SNAPSHOT_FILE = path.join(process.cwd(), 'data', 'signals-snapshot.json')
const ORIGINAL = fs.existsSync(SNAPSHOT_FILE) ? fs.readFileSync(SNAPSHOT_FILE, 'utf-8') : null

function makeSignal(overrides: Partial<Signal> & { id: string }): Signal {
  return {
    title: `Title ${overrides.id}`,
    summary: '',
    source: 'test',
    sourceUrl: 'https://example.com',
    publishedAt: '2026-01-01T00:00:00.000Z',
    category: 'models',
    country: 'UN',
    credibility: 2,
    tags: [],
    importance: 1,
    sourcesCount: 1,
    language: 'en',
    ...overrides,
  }
}

afterEach(() => {
  // 恢复被测试临时覆盖/删除的磁盘快照
  if (ORIGINAL === null) {
    try { fs.unlinkSync(SNAPSHOT_FILE) } catch { /* 原本不存在 */ }
  } else {
    fs.writeFileSync(SNAPSHOT_FILE, ORIGINAL)
  }
})

describe('mergeSignals：去重 key 含 language（P0-1）', () => {
  it('同标题的 en/zh 双信号都被保留', () => {
    const fresh = [
      makeSignal({ id: 'hn-1', language: 'en', title: 'Same Story', providerId: 'hackernews' }),
      makeSignal({ id: 'hn-1-zh', language: 'zh', title: 'Same Story', providerId: 'hackernews' }),
    ]
    const merged = mergeSignals([], fresh, new Set(['hackernews']))
    expect(merged.map(s => s.id).sort()).toEqual(['hn-1', 'hn-1-zh'])
  })

  it('同语言同标题仍然去重（保留新拉取的）', () => {
    const prev = [makeSignal({ id: 'hn-old', language: 'en', title: 'Same Story', providerId: 'hackernews' })]
    const fresh = [makeSignal({ id: 'hn-new', language: 'en', title: 'Same Story', providerId: 'hackernews' })]
    const merged = mergeSignals(prev, fresh, new Set(['hackernews']))
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('hn-new')
  })
})

describe('applyFilters：zh locale 保留 zh 信号（P0-1）', () => {
  it('en+zh 同标题并存时，zh locale 只返回 zh 变体', () => {
    const signals = [
      makeSignal({ id: 'hn-en', language: 'en', title: 'Story', providerId: 'hackernews' }),
      makeSignal({ id: 'hn-zh', language: 'zh', title: 'Story', providerId: 'hackernews' }),
      makeSignal({ id: 'hf-zh', language: 'zh', title: 'HF Paper', providerId: 'huggingface' }),
    ]
    const r = applyFilters(signals, 'zh', 'all')
    expect(r.map(s => s.id).sort()).toEqual(['hf-zh', 'hn-zh'])
  })
})

describe('aggregateSignals 降级链（P0-4）', () => {
  it('全源失败且存在旧快照 → staleUsed=true，sourceHealth 标记 error', async () => {
    fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true })
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify({
      en: {
        signals: [makeSignal({ id: 'old', language: 'en', title: 'Old story' })],
        fetchedAt: Date.now() - 60 * 60 * 1000, // 1h 前，超过 CACHE_TTL
        sourceHealth: { a: 'ok' },
      },
    }))

    const outcome = await aggregateSignals('en', 'all')
    expect(outcome.staleUsed).toBe(true)
    expect(outcome.fallbackMock).toBe(false)
    expect(outcome.fromCache).toBe(false)
    expect(outcome.signals.map(s => s.id)).toEqual(['old'])
    expect(outcome.sourceHealth).toEqual({ a: 'error' })
  })

  it('全源失败且无任何快照 → fallbackMock=true，staleUsed=false', async () => {
    try { fs.unlinkSync(SNAPSHOT_FILE) } catch { /* 原本不存在 */ }

    const outcome = await aggregateSignals('en', 'all')
    expect(outcome.fallbackMock).toBe(true)
    expect(outcome.staleUsed).toBe(false)
    expect(outcome.fromCache).toBe(false)
  })
})
