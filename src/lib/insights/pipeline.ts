import fs from 'fs'
import path from 'path'
import type { Signal } from '@/types/signal'
import { aggregateSignals } from '@/lib/aggregate'
import { generateInsight } from './llm'
import type { CategoryInsight, InsightsSnapshot } from './types'

const SNAPSHOT_TTL = 30 * 60 * 1000
const CATEGORIES: Signal['category'][] = ['models', 'products', 'industry', 'papers', 'tips']
const SNAPSHOT_DIR = path.join(process.cwd(), 'data')
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, 'insights.json')

/** 内存快照（按 locale）与单飞锁：并发请求共享同一次生成，不重复调 LLM */
const snapshots = new Map<'zh' | 'en', InsightsSnapshot>()
const inflight = new Map<'zh' | 'en', Promise<InsightsSnapshot>>()

function loadFromDisk(): Partial<Record<'zh' | 'en', InsightsSnapshot>> {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) return {}
    return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveToDisk(all: Partial<Record<'zh' | 'en', InsightsSnapshot>>): void {
  try {
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(all))
  } catch (e) {
    console.warn(`[insights] failed to persist snapshot: ${(e as Error)?.message}`)
  }
}

function isFresh(s: InsightsSnapshot | undefined, force: boolean): s is InsightsSnapshot {
  return !!s && !force && Date.now() - s.generatedAt < SNAPSHOT_TTL
}

/** 返回该 category 的洞察：无新增则复用旧文本，有新增才调 LLM。 */
export async function buildCategory(
  category: Signal['category'],
  signals: Signal[],
  previous: CategoryInsight | undefined,
): Promise<CategoryInsight> {
  const ids = signals.map(s => s.id)
  const idSet = new Set(ids)
  const unchanged = previous && previous.basedOnSignalIds.length === ids.length && previous.basedOnSignalIds.every(id => idSet.has(id))
  const hasNew = !previous || signals.some(s => !previous.basedOnSignalIds.includes(s.id))

  // 无新增 → 复用旧文本（保留 generatedAt 表示"内容未变"）
  if (unchanged && previous) return previous

  const text = hasNew
    ? await generateInsight(category, signals.slice(0, 20).map(s => s.title))
    : (previous?.text ?? '')
  const finalText = text ?? previous?.text ?? ''

  return {
    category,
    text: finalText,
    basedOnSignalIds: ids,
    generatedAt: new Date().toISOString(),
    coveredCount: ids.length,
    // 无 LLM 结果时只带高价值精选标题（importance≥4），全量由时间轴承担，避免与时间轴重复
    signalTitles: finalText
      ? undefined
      : signals.filter(s => s.importance >= 4).slice(0, 3).map(s => s.title),
  }
}

export async function getInsights(locale: 'zh' | 'en', force = false): Promise<InsightsSnapshot> {
  const cached = snapshots.get(locale) ?? loadFromDisk()[locale]
  if (isFresh(cached, force)) return cached

  const existing = inflight.get(locale)
  if (existing) return existing

  const task = (async (): Promise<InsightsSnapshot> => {
    const outcome = await aggregateSignals(locale, 'all')
    const byCategory = new Map<Signal['category'], Signal[]>()
    for (const s of outcome.signals) {
      const list = byCategory.get(s.category) ?? []
      list.push(s)
      byCategory.set(s.category, list)
    }

    const prev = (snapshots.get(locale) ?? loadFromDisk()[locale])?.insights ?? []
    const prevByCat = new Map(prev.map(i => [i.category, i]))

    const insights: CategoryInsight[] = []
    for (const category of CATEGORIES) {
      insights.push(await buildCategory(category, byCategory.get(category) ?? [], prevByCat.get(category)))
    }

    const hasLlm = insights.some(i => i.text.length > 0)
    const snapshot: InsightsSnapshot = { insights, generatedAt: Date.now(), hasLlm }
    snapshots.set(locale, snapshot)

    const all = { ...loadFromDisk(), [locale]: snapshot }
    saveToDisk(all)
    return snapshot
  })()

  inflight.set(locale, task)
  try {
    return await task
  } finally {
    inflight.delete(locale)
  }
}

/** 供测试与外部触发：清空内存快照（下次请求重新生成） */
export function resetInsights(locale?: 'zh' | 'en'): void {
  if (locale) snapshots.delete(locale)
  else snapshots.clear()
}
