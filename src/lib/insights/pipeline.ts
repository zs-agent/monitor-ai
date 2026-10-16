import fs from 'fs'
import { createHash } from 'crypto'
import path from 'path'
import type { Signal } from '@/types/signal'
import { aggregateSignals } from '@/lib/aggregate'
import { filterSignalScope, matchesQueries, signalText, selectFocusSignals, type SignalWindow } from '@/lib/browse-data'
import { generateInsight } from './llm'
import type { CategoryInsight, InsightsSnapshot } from './types'

const SNAPSHOT_TTL = 30 * 60 * 1000
const CATEGORIES: Signal['category'][] = ['models', 'products', 'industry', 'papers', 'tips']
const SNAPSHOT_FILE = path.join(process.cwd(), 'data', 'insights.json')
const snapshots = new Map<string, InsightsSnapshot>()
const inflight = new Map<string, Promise<InsightsSnapshot>>()

function loadFromDisk(): Record<string, InsightsSnapshot> {
  try { return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8')) } catch { return {} }
}
function persist(key: string, snapshot: InsightsSnapshot): void {
  try {
    fs.mkdirSync(path.dirname(SNAPSHOT_FILE), { recursive: true })
    const temporary = SNAPSHOT_FILE + '.' + process.pid + '.tmp'
    fs.writeFileSync(temporary, JSON.stringify({ ...loadFromDisk(), [key]: snapshot }))
    fs.renameSync(temporary, SNAPSHOT_FILE)
  } catch (e) { console.warn('[insights] snapshot persistence failed:', (e as Error).message) }
}
export function insightFingerprint(signals: Signal[]): string {
  return createHash('sha256').update(JSON.stringify(signals.map(s =>
    [s.id, s.title, s.summary, s.sourceUrl, s.publishedAt, s.importance]).sort())).digest('hex')
}

export async function buildCategory(
  category: Signal['category'], signals: Signal[], previous?: CategoryInsight,
  force = false, locale: 'zh' | 'en' = 'zh',
): Promise<CategoryInsight> {
  const fingerprint = insightFingerprint(signals)
  if (!force && previous?.inputFingerprint === fingerprint && !previous.stale &&
      Date.now() - Date.parse(previous.generatedAt) < SNAPSHOT_TTL) return previous
  const selected = selectFocusSignals(signals, 20)
  let text: string | null = null
  if (selected.length) {
    try { text = await generateInsight(category, selected.map(s => s.title), locale) } catch { /* Display current originals below. */ }
  }
  // Never bind an old summary to changed input, even when the model is unavailable.
  const overview = selectFocusSignals(signals.filter(s => s.importance >= 4), 3)
  const visible = overview.length ? overview : selectFocusSignals(signals, 3)
  return {
    category, text: text ?? '', basedOnSignalIds: selected.map(s => s.id), inputFingerprint: fingerprint,
    stale: !!signals.length && text === null, generatedAt: new Date().toISOString(),
    coveredCount: signals.length, summarizedCount: text ? selected.length : 0,
    signalTitles: text ? undefined : visible.map(s => s.title),
    signalIds: text ? undefined : visible.map(s => s.id),
  }
}

export async function getInsights(locale: 'zh' | 'en', force = false, scope: SignalWindow = 'all', query = ''): Promise<InsightsSnapshot> {
  const key = locale + ':' + scope + ':' + query.trim().toLowerCase()
  const lockKey = key + ':' + force
  const existing = inflight.get(lockKey)
  if (existing) return existing
  const task = (async (): Promise<InsightsSnapshot> => {
    // Inspect the actual feed before accepting the summary cache.
    const outcome = await aggregateSignals(locale, 'all')
    const signals = filterSignalScope(outcome.signals, scope).filter(s => matchesQueries(signalText(s), query))
    const fingerprint = insightFingerprint(signals)
    const cached = snapshots.get(key) ?? (!query ? loadFromDisk()[key] : undefined)
    if (!force && cached?.inputFingerprint === fingerprint && Date.now() - cached.generatedAt < (cached.insights.some(i => i.stale) ? 60000 : SNAPSHOT_TTL))
      return { ...cached, query: query.trim(), sourceState: outcome.fallbackMock ? 'sample' : outcome.staleUsed ? 'stale' : 'current' }
    const previous = new Map(cached?.insights.map(i => [i.category, i]) ?? [])
    const insights = await Promise.all(CATEGORIES.map(category => buildCategory(
      category, signals.filter(s => s.category === category), previous.get(category), force, locale)))
    const snapshot: InsightsSnapshot = {
      insights, generatedAt: Date.now(), hasLlm: insights.some(i => !!i.text), inputFingerprint: fingerprint, scope, query: query.trim(),
      sourceState: outcome.fallbackMock ? 'sample' : outcome.staleUsed ? 'stale' : 'current',
    }
    snapshots.delete(key)
    snapshots.set(key, snapshot)
    if (snapshots.size > 16) snapshots.delete(snapshots.keys().next().value!)
    if (!query) persist(key, snapshot)
    return snapshot
  })()
  inflight.set(lockKey, task)
  try { return await task } finally { inflight.delete(lockKey) }
}
export function resetInsights(locale?: 'zh' | 'en'): void {
  for (const key of Array.from(snapshots.keys())) if (!locale || key.startsWith(locale + ':')) snapshots.delete(key)
}
