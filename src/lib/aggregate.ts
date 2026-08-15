import fs from 'fs'
import path from 'path'
import type { Signal } from '@/types/signal'
import { providers } from '@/lib/sources'
import { dataFreshness } from '@/lib/data-freshness'
import { getMockSignals } from '@/data/mock-signals'

export interface LocaleSnapshot {
  /** 该 locale 全量信号（未按 category 过滤） */
  signals: Signal[]
  fetchedAt: number
  sourceHealth: Record<string, string>
  /** 全源刷新失败、返回的是过期快照 */
  stale?: boolean
}

export interface AggregateOutcome {
  /** 已按 category 过滤的信号 */
  signals: Signal[]
  fetchedAt: number
  sourceHealth: Record<string, string>
  /** 快照新鲜，零网络直接返回 */
  fromCache: boolean
  /** 刷新失败，返回过期快照 */
  staleUsed: boolean
  /** 连过期快照都没有，使用 mock */
  fallbackMock: boolean
}

/** 快照新鲜阈值：5min 内不触发刷新 */
export const CACHE_TTL = 5 * 60 * 1000

const SNAPSHOT_DIR = path.join(process.cwd(), 'data')
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'signals-snapshot.json')

/** locale 级内存快照（后台轮询与请求共享），磁盘为重启恢复用 */
const snapshots = new Map<'zh' | 'en', LocaleSnapshot>()
/** 单飞锁：同一刷新范围并发时共享同一次拉取 */
const inflight = new Map<string, Promise<LocaleSnapshot>>()

// 模块加载时注册全部 provider（/api/signals 与 /api/insights 共用一份注册）
for (const p of providers) {
  dataFreshness.register(p.id, p.name)
}

function loadFromDisk(): Partial<Record<'zh' | 'en', LocaleSnapshot>> {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) return {}
    return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveToDisk(all: Partial<Record<'zh' | 'en', LocaleSnapshot>>): void {
  try {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(all))
  } catch (e) {
    console.warn(`[aggregate] failed to persist snapshot: ${(e as Error)?.message}`)
  }
}

/**
 * 合并快照：新拉取的信号 + 旧快照中「未被本次刷新的 provider」的信号，
 * 按 title 去重（新拉的优先）。分级轮询时只刷新部分源，其余源数据保留。
 */
export function mergeSignals(prev: Signal[], fresh: Signal[], refreshedProviderIds: Set<string>): Signal[] {
  const kept = prev.filter(s => !s.providerId || !refreshedProviderIds.has(s.providerId))
  const combined = [...fresh, ...kept]
  const seen = new Set<string>()
  const out: Signal[] = []
  for (const s of combined) {
    // 去重 key 含 language：同一标题的 en/zh 变体视为两条信号，
    // 否则 zh 侧信号会被先出现的 en 版本顶掉，applyFilters 后 HN/HF 内容在 zh 侧全丢
    const k = `${s.language}:${s.title.toLowerCase().slice(0, 40)}`
    if (!seen.has(k)) { seen.add(k); out.push(s) }
  }
  return out
}

/**
 * 刷新指定 locale 的信号快照。
 * @param providerIds 只刷新这些 provider（缺省为全部）。用于后台分级轮询。
 * 全失败时：有旧快照返回旧快照（stale），否则 throw（由调用方降级 mock）。
 */
export async function refreshLocale(locale: 'zh' | 'en', providerIds?: string[]): Promise<LocaleSnapshot> {
  const targets = providers.filter(p => !providerIds || providerIds.includes(p.id))
  const targetIds = new Set(targets.map(p => p.id))
  const prev = snapshots.get(locale) ?? loadFromDisk()[locale]

  const lockKey = `${locale}:${providerIds ? providerIds.join(',') : '*'}`
  const existing = inflight.get(lockKey)
  if (existing) return existing

  const task = (async (): Promise<LocaleSnapshot> => {
    const results = await Promise.allSettled(targets.map(p => p.fetchSignals(locale)))

    const freshSignals: Signal[] = []
    const sourceHealth: Record<string, string> = { ...prev?.sourceHealth }
    let okCount = 0
    for (let i = 0; i < targets.length; i++) {
      const p = targets[i]
      const r = results[i]
      if (r.status === 'fulfilled') {
        freshSignals.push(...r.value)
        sourceHealth[p.id] = 'ok'
        dataFreshness.recordUpdate(p.id, r.value.length)
        okCount++
      } else {
        sourceHealth[p.id] = 'error'
        dataFreshness.recordError(p.id, (r.reason as Error)?.message || 'Unknown error')
      }
    }

    if (okCount === 0) {
      // 全部失败：保留旧快照并标记 stale，同时透出本次的 sourceHealth（各源均 error）
      if (prev) return { ...prev, sourceHealth, stale: true }
      throw new Error('All providers failed')
    }

    const merged = mergeSignals(prev?.signals ?? [], freshSignals, targetIds)
    const snapshot: LocaleSnapshot = { signals: merged, fetchedAt: Date.now(), sourceHealth }
    snapshots.set(locale, snapshot)
    saveToDisk({ ...loadFromDisk(), [locale]: snapshot })
    return snapshot
  })()

  inflight.set(lockKey, task)
  try {
    return await task
  } finally {
    inflight.delete(lockKey)
  }
}

/** 聚合入口：快照新鲜直接返回（零网络），否则触发一次即时全量刷新。 */
export async function aggregateSignals(locale: 'zh' | 'en', category: string): Promise<AggregateOutcome> {
  const now = Date.now()
  let snapshot = snapshots.get(locale) ?? loadFromDisk()[locale]

  if (snapshot && now - snapshot.fetchedAt < CACHE_TTL) {
    return {
      signals: applyFilters(snapshot.signals, locale, category),
      fetchedAt: snapshot.fetchedAt,
      sourceHealth: snapshot.sourceHealth,
      fromCache: true,
      staleUsed: false,
      fallbackMock: false,
    }
  }

  try {
    snapshot = await refreshLocale(locale)
    return {
      signals: applyFilters(snapshot.signals, locale, category),
      fetchedAt: snapshot.fetchedAt,
      sourceHealth: snapshot.sourceHealth,
      fromCache: false,
      staleUsed: snapshot.stale === true,
      fallbackMock: false,
    }
  } catch {
    if (snapshot) {
      return {
        signals: applyFilters(snapshot.signals, locale, category),
        fetchedAt: snapshot.fetchedAt,
        sourceHealth: snapshot.sourceHealth,
        fromCache: false,
        staleUsed: true,
        fallbackMock: false,
      }
    }
    // 连过期快照都没有，使用 mock 作为最后 fallback，并标记
    return {
      signals: applyFilters(getMockSignals(), locale, category),
      fetchedAt: now,
      sourceHealth: {},
      fromCache: false,
      staleUsed: false,
      fallbackMock: true,
    }
  }
}

export function applyFilters(signals: Signal[], locale: string, category: string): Signal[] {
  let r = signals.filter(s => s.language === locale)
  if (category !== 'all') r = r.filter(s => s.category === category)
  return r.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}
