import type { Signal } from '@/types/signal'
import type { ModelReportItem } from '@/data/model-reports'

export type SignalWindow = 'all' | '24h' | '7d' | '30d'
export const SIGNAL_WINDOW_MS = { all: 0, '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 }

/** A future or absent publication time cannot qualify as a recent update. */
export function filterSignalScope(signals: Signal[], scope: SignalWindow, now = Date.now()): Signal[] {
  const span = SIGNAL_WINDOW_MS[scope]
  if (!span) return signals
  return signals.filter(s => {
    const t = Date.parse(s.publishedAt)
    return Number.isFinite(t) && t <= now && t >= now - span
  })
}

/** Independent filters combine with AND; words need not be adjacent. */
export function matchesQueries(text: string, ...queries: string[]): boolean {
  const lower = text.toLowerCase()
  return queries.every(q => q.trim().toLowerCase().split(/\s+/).filter(Boolean).every(word => lower.includes(word)))
}
export function signalText(s: Signal): string {
  return [s.title, s.summary, ...s.tags].join(' ')
}
export function selectFocusSignals(signals: Signal[], limit = 6): Signal[] {
  return [...signals].sort((a, b) => b.importance - a.importance ||
    (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)).slice(0, limit)
}
export type CatalogItem = ModelReportItem & { reference: boolean }
export function modelCatalog(live: ModelReportItem[], curated: ModelReportItem[], includeReferences = false): CatalogItem[] {
  const seen = new Set<string>()
  const result: CatalogItem[] = []
  for (const [items, reference] of [[live, false], [includeReferences ? curated : [], true]] as const) {
    for (const item of items) {
      if (!item.name || item.type === '论文' || item.type === 'Technical Report') continue
      const key = item.sourceUrl.replace(/\/$/, '').toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      result.push({ ...item, reference })
    }
  }
  return result
}

export function relativeSignalTime(iso: string, locale: 'zh' | 'en' = 'zh', now = Date.now()): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return locale === 'zh' ? '时间未知' : 'Unknown date'
  if (t > now + 60000) return locale === 'zh' ? '时间待核对' : 'Future date'
  const m = Math.max(0, Math.floor((now - t) / 60000))
  if (m < 60) return m + 'm'
  if (m < 1440) return Math.floor(m / 60) + 'h'
  return Math.floor(m / 1440) + 'd'
}
