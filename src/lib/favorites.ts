// 关注（收藏）机制：localStorage 持久化，用于竞技场模型 / 开源雷达项目
const KEY = 'monitor-ai-favorites-v1'

export function getFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function isFavorite(id: string): boolean {
  return getFavorites().includes(id)
}

export function toggleFavorite(id: string): boolean {
  const list = getFavorites()
  const idx = list.indexOf(id)
  let next: string[]
  if (idx >= 0) {
    next = list.filter(x => x !== id)
  } else {
    next = [...list, id]
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* 存储失败忽略 */ }
  return idx < 0
}
