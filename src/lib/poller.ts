import { providers } from '@/lib/sources'
import { refreshLocale } from '@/lib/aggregate'

const DEFAULT_POLL_MS = 5 * 60 * 1000

let started = false

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
  // 两个 locale 各刷新一轮；失败静默（聚合层已有 stale/mock 兜底）
  void refreshLocale('en', providerIds).catch(() => {})
  void refreshLocale('zh', providerIds).catch(() => {})
}
