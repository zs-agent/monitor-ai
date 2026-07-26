import type { Signal } from '@/types/signal'

export interface ClusteredSignal {
  id: string
  title: string
  summary: string
  sourceUrl: string
  source: string
  sourceCount: number
  sources: string[]
  publishedAt: string
  category: Signal['category']
  importance: number
  language: 'zh' | 'en'
  isCluster: boolean
  clusterItems: Omit<Signal, 'id'>[]
}

function titleSimilarity(a: string, b: string): number {
  const wordsA = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)
  const wordsB = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2)
  if (wordsA.length === 0 || wordsB.length === 0) return 0

  const setB = new Set(wordsB)
  let common = 0
  for (let i = 0; i < wordsA.length; i++) {
    if (setB.has(wordsA[i])) common++
  }

  const unionSet = new Set(wordsA)
  for (let i = 0; i < wordsB.length; i++) {
    unionSet.add(wordsB[i])
  }
  return common / unionSet.size
}

export function clusterSignals(signals: Signal[]): (Signal | ClusteredSignal)[] {
  if (signals.length < 3) return signals

  const visited = new Set<number>()
  const result: (Signal | ClusteredSignal)[] = []

  for (let i = 0; i < signals.length; i++) {
    if (visited.has(i)) continue
    const cluster: number[] = [i]
    visited.add(i)

    for (let j = i + 1; j < signals.length; j++) {
      if (visited.has(j)) continue
      if (titleSimilarity(signals[i].title, signals[j].title) >= 0.35) {
        cluster.push(j)
        visited.add(j)
      }
    }

    if (cluster.length === 1) {
      result.push(signals[i])
    } else {
      const items = cluster.map(idx => signals[idx])
      const best = items.reduce((a, b) => a.importance >= b.importance ? a : b)
      result.push({
        id: `cluster-${best.id}`,
        title: best.title,
        summary: `${items.length} sources reporting`,
        sourceUrl: best.sourceUrl,
        source: best.source,
        sourceCount: items.length,
        sources: items.map(s => s.source),
        publishedAt: best.publishedAt,
        category: best.category,
        importance: Math.min(best.importance + 1, 5),
        language: best.language,
        isCluster: true,
        clusterItems: items.map(({ id: _, ...rest }) => rest),
      })
    }
  }

  return result
}
