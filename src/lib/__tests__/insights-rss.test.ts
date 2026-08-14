import { describe, it, expect } from 'vitest'
import type { Signal } from '@/types/signal'
import { applyFilters, mergeSignals } from '@/lib/aggregate'
import { buildCategory } from '@/lib/insights/pipeline'
import { normalizeRssItem } from '@/lib/sources/rss'

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

describe('aggregate.applyFilters', () => {
  const signals = [
    makeSignal({ id: 'a', language: 'en', category: 'models', publishedAt: '2026-01-02T00:00:00.000Z' }),
    makeSignal({ id: 'b', language: 'zh', category: 'papers', publishedAt: '2026-01-03T00:00:00.000Z' }),
    makeSignal({ id: 'c', language: 'en', category: 'papers', publishedAt: '2026-01-01T00:00:00.000Z' }),
  ]

  it('按 locale 过滤并按时间倒序', () => {
    const r = applyFilters(signals, 'en', 'all')
    expect(r.map(s => s.id)).toEqual(['a', 'c'])
  })

  it('按 category 过滤', () => {
    const r = applyFilters(signals, 'en', 'papers')
    expect(r.map(s => s.id)).toEqual(['c'])
  })
})

describe('aggregate.mergeSignals（分级轮询合并）', () => {
  it('只刷新部分 provider 时：刷新源旧信号被移除，非刷新源信号保留', () => {
    const prev = [
      makeSignal({ id: 'hn-old', providerId: 'hackernews', title: 'HN Story' }),
      makeSignal({ id: 'hf-old', providerId: 'huggingface', title: 'HF Paper' }),
    ]
    const fresh = [makeSignal({ id: 'hn-new', providerId: 'hackernews', title: 'HN New Story' })]
    const merged = mergeSignals(prev, fresh, new Set(['hackernews']))
    expect(merged.map(s => s.id)).toEqual(['hn-new', 'hf-old'])
  })

  it('新拉的信号覆盖旧快照中的同名标题（优先新数据）', () => {
    const prev = [makeSignal({ id: 'hn-old', providerId: 'hackernews', title: 'Same Story' })]
    const fresh = [makeSignal({ id: 'hn-new', providerId: 'hackernews', title: 'Same Story' })]
    const merged = mergeSignals(prev, fresh, new Set(['hackernews']))
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('hn-new')
  })

  it('全量刷新（刷新全部 provider）→ 旧信号全部被替换', () => {
    const prev = [
      makeSignal({ id: 'a', providerId: 'hackernews', title: 'A' }),
      makeSignal({ id: 'b', providerId: 'github', title: 'B' }),
    ]
    const fresh = [makeSignal({ id: 'c', providerId: 'hackernews', title: 'C' })]
    const merged = mergeSignals(prev, fresh, new Set(['hackernews', 'github']))
    expect(merged.map(s => s.id)).toEqual(['c'])
  })

  it('同标题的 en/zh 双语变体都保留（B1：zh 变体不再被当重复项丢弃）', () => {
    const prev: Signal[] = []
    const fresh = [
      makeSignal({ id: 'hn-1', providerId: 'hackernews', title: 'Same Story Title', language: 'en' }),
      makeSignal({ id: 'hn-1-zh', providerId: 'hackernews', title: 'Same Story Title', language: 'zh' }),
    ]
    const merged = mergeSignals(prev, fresh, new Set(['hackernews']))
    expect(merged.map(s => s.id)).toEqual(['hn-1', 'hn-1-zh'])
  })

  it('刷新失败的 provider 其旧信号保留（stale 降级，不因失败清空该源）', () => {
    const prev = [
      makeSignal({ id: 'hn-old', providerId: 'hackernews', title: 'HN Story' }),
      makeSignal({ id: 'gh-old', providerId: 'github', title: 'GH Repo' }),
    ]
    const fresh = [makeSignal({ id: 'gh-new', providerId: 'github', title: 'GH New Repo' })]
    // hackernews 刷新失败：旧 HN 信号保留，github 成功：旧 GH 被新 GH 替换
    const merged = mergeSignals(prev, fresh, new Set(['hackernews', 'github']), new Set(['hackernews']))
    expect(merged.map(s => s.id)).toEqual(['gh-new', 'hn-old'])
  })
})

describe('insights.buildCategory（无 LLM key 时）', () => {
  it('无新增信号 → 复用旧文本，不触发 LLM', async () => {
    const prev = {
      category: 'models' as const,
      text: '旧洞察',
      basedOnSignalIds: ['a', 'b'],
      generatedAt: '2026-01-01T00:00:00.000Z',
      coveredCount: 2,
    }
    const signals = [
      makeSignal({ id: 'a', category: 'models' }),
      makeSignal({ id: 'b', category: 'models' }),
    ]
    const r = await buildCategory('models', signals, prev)
    expect(r).toBe(prev) // 复用同一对象
  })

  it('有新增信号但无 key → 保留旧文本，更新覆盖集合', async () => {
    const prev = {
      category: 'models' as const,
      text: '旧洞察',
      basedOnSignalIds: ['a'],
      generatedAt: '2026-01-01T00:00:00.000Z',
      coveredCount: 1,
    }
    const signals = [
      makeSignal({ id: 'a', category: 'models' }),
      makeSignal({ id: 'b', category: 'models' }),
    ]
    const r = await buildCategory('models', signals, prev)
    expect(r.text).toBe('旧洞察')
    expect(r.basedOnSignalIds).toEqual(['a', 'b'])
    expect(r.coveredCount).toBe(2)
  })

  it('首次生成且无 key → text 为空串，coveredCount 正确', async () => {
    const signals = [makeSignal({ id: 'x', category: 'papers' })]
    const r = await buildCategory('papers', signals, undefined)
    expect(r.text).toBe('')
    expect(r.coveredCount).toBe(1)
    expect(r.basedOnSignalIds).toEqual(['x'])
  })

  it('无 key 时 signalTitles 只含高价值精选（importance≥4，最多 3 条）', async () => {
    const signals = [
      makeSignal({ id: 'a', category: 'models', importance: 5, title: 'Hot Story A' }),
      makeSignal({ id: 'b', category: 'models', importance: 2, title: 'Routine B' }),
      makeSignal({ id: 'c', category: 'models', importance: 4, title: 'Hot Story C' }),
    ]
    const r = await buildCategory('models', signals, undefined)
    expect(r.coveredCount).toBe(3) // 总数不变
    expect(r.signalTitles).toEqual(['Hot Story A', 'Hot Story C']) // 只精选高价值，且去掉常规
  })
})

describe('rss.normalizeRssItem', () => {
  const route = { route: '/arxiv/cs.AI', category: 'papers' as const, credibility: 4 }

  it('归一化标题/摘要/链接，language 用 locale', () => {
    const s = normalizeRssItem(
      { title: 'New LLM paper', link: 'https://arxiv.org/abs/123', description: '<p>Great <b>paper</b> about LLMs.</p>', pubDate: '2026-01-05T08:00:00.000Z' },
      route,
      'en',
    )
    expect(s.title).toBe('New LLM paper')
    expect(s.summary).toBe('Great paper about LLMs.')
    expect(s.sourceUrl).toBe('https://arxiv.org/abs/123')
    expect(s.category).toBe('papers')
    expect(s.credibility).toBe(4)
    expect(s.language).toBe('en')
    expect(s.publishedAt).toBe('2026-01-05T08:00:00.000Z')
  })

  it('路由指定 language 时优先于 locale', () => {
    const zhRoute = { route: '/zhihu/hotlist', category: 'industry' as const, credibility: 2, language: 'zh' as const }
    const s = normalizeRssItem({ title: '知乎热榜', link: 'https://zhihu.com' }, zhRoute, 'en')
    expect(s.language).toBe('zh')
  })
})
