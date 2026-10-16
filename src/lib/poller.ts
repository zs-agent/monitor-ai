import { providers } from '@/lib/sources'
import { refreshLocale } from '@/lib/aggregate'

const DEFAULT_POLL_MS = 5 * 60 * 1000

let started = false
const active = new Set<string>()

/** 按 pollIntervalMs 分组调度后台轮询（IRONSIGHT 式分级：高频源高频刷，受限 API 低频刷）。
 *  惰性单例：首次调用启动，standalone 单进程下常驻。serverless 平台无效（README 有说明）。 */
export function ensurePollerStarted(): void {
  if (started) return
  started = true

  const groups = new Map<number, string[]>()
  for (const p of providers) {
    const ms = p.pollIntervalMs ?? DEFAULT_POLL_MS
    const list = groups.get(ms) ?? []
    list.push(p.id)
    groups.set(ms, list)
  }

  const groupList: { ms: number; ids: string[] }[] = []
  groups.forEach((ids, ms) => groupList.push({ ms, ids }))

  for (const { ms, ids } of groupList) {
    // 启动即先跑一轮，避免冷等一个完整 interval
    runOnce(ids)
    setInterval(() => runOnce(ids), ms)
  }
}

function runOnce(providerIds: string[]): void {
  for (const locale of ['en', 'zh'] as const) {
    const key = `${locale}:${[...providerIds].sort().join(',')}`
    if (active.has(key)) continue
    active.add(key)
    void refreshLocale(locale, providerIds)
      .catch(error => console.warn(`[poller] ${key}: ${error instanceof Error ? error.message : 'refresh failed'}`))
      .finally(() => active.delete(key))
  }
}
