import type { Signal } from '@/types/signal'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { normalizeHNSignal } from '@/lib/normalizer'
import type { SignalProvider } from './types'

interface RawHNItem {
  id: number
  title: string
  url: string
  by: string
  score: number
  descendants: number
  time: number
}

const AI_KEYWORDS = ['ai', 'artificial intelligence', 'machine learning', 'deep learning',
  'gpt', 'claude', 'llm', 'chatgpt', 'openai', 'anthropic', 'neural', 'transformer',
  'model', 'language model', 'agent', 'copilot', 'gemini', 'llama', 'mistral']

function isAiRelated(title: string): boolean {
  const lower = title.toLowerCase()
  return AI_KEYWORDS.some(kw => new RegExp('\\b' + kw + '\\b', 'i').test(lower))
}

const HN_API = 'https://hacker-news.firebaseio.com/v0'
const PER_REQUEST_TIMEOUT = 5000

async function fetchItem(id: number): Promise<RawHNItem | null> {
  const res = await fetchWithTimeout(`${HN_API}/item/${id}.json`, {}, PER_REQUEST_TIMEOUT)
  if (!res.ok) return null
  return res.json()
}

export const hackernewsProvider: SignalProvider = {
  id: 'hackernews',
  name: 'Hacker News',
  pollIntervalMs: 90 * 1000,
  async fetchSignals(locale) {
    let items: RawHNItem[] = []
    try {
      // Algolia's public HN index avoids fetching dozens of item details per refresh.
      const response = await fetchWithTimeout('https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&hitsPerPage=100', {}, PER_REQUEST_TIMEOUT)
      if (!response.ok) throw new Error('HN search HTTP ' + response.status)
      const body = await response.json()
      if (!Array.isArray(body.hits)) throw new Error('HN search results missing')
      items = body.hits.map((hit: { objectID: string; title: string; url?: string; author: string; points?: number; num_comments?: number; created_at_i: number }) => ({
        id: Number(hit.objectID), title: hit.title, url: hit.url || 'https://news.ycombinator.com/item?id=' + hit.objectID,
        by: hit.author, score: hit.points ?? 0, descendants: hit.num_comments ?? 0, time: hit.created_at_i,
      })).filter((item: RawHNItem) => Number.isSafeInteger(item.id) && typeof item.title === 'string' && Number.isFinite(item.time))
    } catch {
      const res = await fetchWithTimeout(`${HN_API}/topstories.json`, {}, PER_REQUEST_TIMEOUT)
      if (!res.ok) throw new Error(`HN topstories HTTP ${res.status}`)
      const ids: number[] = await res.json()

      // 分批取前 60 条详情，每批 10 个并发
      for (let i = 0; i < 60; i += 10) {
        const batch = await Promise.allSettled(ids.slice(i, i + 10).map(fetchItem))
        for (const r of batch) {
          if (r.status === 'fulfilled' && r.value && !((r.value as any).deleted)) {
            items.push(r.value)
          }
        }
      }
    }

    if (items.length === 0) throw new Error('HN: no source records acquired')
    const aiItems = items
      .filter(item => isAiRelated(item.title))
      .sort((a, b) => b.score - a.score)
      .slice(0, 100)

    const signals: Signal[] = []
    for (const item of aiItems) {
      try {
        signals.push(normalizeHNSignal(item, locale))
      } catch {
        console.warn(`[hackernews] skip malformed item ${item?.id}`)
      }
    }
    return signals
  },
}
