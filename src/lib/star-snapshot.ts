// 每日 star 快照：记录每个 repo 每天的 stars，用于计算近 7 日增长（+N/week）。
// 由 agent-radar 与 github 信号源复用；快照文件按调用方指定隔离。
import fs from 'node:fs'
import path from 'node:path'

export interface StarDay {
  day: string
  stars: number
}

/** 每日快照：持久化到 <dir>/<file>，服务重启后 7 日增长不丢失 */
export function createStarSnapshot(snapshotFile: string) {
  const dir = path.dirname(snapshotFile)
  const starHistory = new Map<string, StarDay[]>()

  function load(): void {
    try {
      if (fs.existsSync(snapshotFile)) {
        const raw = JSON.parse(fs.readFileSync(snapshotFile, 'utf-8')) as Record<string, StarDay[]>
        for (const [k, v] of Object.entries(raw)) if (Array.isArray(v)) starHistory.set(k, v)
      }
    } catch { /* 快照损坏则忽略，重新积累 */ }
  }
  function save(): void {
    try {
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(snapshotFile, JSON.stringify(Object.fromEntries(starHistory)))
    } catch { /* 无写权限时忽略（7日增长退化为会话内） */ }
  }
  load()

  /** 记录今日 stars，返回近 7 日增量（最早快照日距今不足 7 天时也按现有跨度计算） */
  function record(repo: string, stars: number): number | null {
    const today = new Date().toISOString().slice(0, 10)
    const list = starHistory.get(repo) || []
    const last = list[list.length - 1]
    if (!last || last.day !== today) {
      list.push({ day: today, stars })
      // 只保留最近 7 天
      while (list.length > 7) list.shift()
      starHistory.set(repo, list)
      save()
    }
    const oldest = list[0]
    if (!oldest || oldest.day === today) return null
    return stars - oldest.stars
  }

  function history(repo: string): StarDay[] | undefined {
    return starHistory.get(repo)
  }

  return { record, history }
}
