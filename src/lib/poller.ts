import { providers } from '@/lib/sources'
import { refreshLocale } from '@/lib/aggregate'

const DEFAULT_POLL_MS = 5 * 60 * 1000
interface Registry {
  signature: string
  refresh: typeof refreshLocale
  timers: ReturnType<typeof setInterval>[]
  active: Set<string>
  generation: number
}
const store = globalThis as typeof globalThis & { __monitorSignalPoller?: Registry }

/** One registry per process, including Next.js hot reloads and route bundles. */
export function ensurePollerStarted(): void {
  const groups = new Map<number, string[]>()
  for (const provider of providers) {
    const ms = provider.pollIntervalMs ?? DEFAULT_POLL_MS
    groups.set(ms, [...(groups.get(ms) || []), provider.id])
  }
  const signature = JSON.stringify(Array.from(groups))
  const previous = store.__monitorSignalPoller
  if (previous?.signature === signature) {
    if (previous.refresh !== refreshLocale) {
      previous.generation++
      previous.refresh = refreshLocale
    }
    return
  }
  previous?.timers.forEach(clearInterval)
  const registry: Registry = { signature, refresh: refreshLocale, timers: [], active: new Set(), generation: 0 }
  store.__monitorSignalPoller = registry
  for (const [ms, ids] of Array.from(groups)) {
    runOnce(ids, registry)
    registry.timers.push(setInterval(() => runOnce(ids, registry), ms))
  }
}

function runOnce(providerIds: string[], registry: Registry): void {
  const generation = registry.generation
  const current = () => store.__monitorSignalPoller === registry && registry.generation === generation
  for (const locale of ['en', 'zh'] as const) {
    const key = generation + ':' + locale + ':' + providerIds.join(',')
    if (registry.active.has(key) || !current()) continue
    registry.active.add(key)
    void registry.refresh(locale, providerIds, current)
      .catch(error => { if (current()) console.warn('[poller] ' + key + ': ' + (error instanceof Error ? error.message : 'refresh failed')) })
      .finally(() => registry.active.delete(key))
  }
}
