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
  return AI_KEYWORDS.some(kw => lower.includes(kw))
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
  async fetchSignals(locale) {
    const res = await fetchWithTimeout(`${HN_API}/topstories.json`, {}, PER_REQUEST_TIMEOUT)
    if (!res.ok) throw new Error(`HN topstories HTTP ${res.status}`)
    const ids: number[] = await res.json()

    // 分批取前 60 条详情，每批 10 个并发
    const items: RawHNItem[] = []
    for (let i = 0; i < 60; i += 10) {
      const batch = await Promise.allSettled(ids.slice(i, i + 10).map(fetchItem))
      for (const r of batch) {
        if (r.status === 'fulfilled' && r.value && !((r.value as any).deleted)) {
          items.push(r.value)
        }
      }
    }

    const aiItems = items
      .filter(item => isAiRelated(item.title))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)

    const signals: Signal[] = []
    for (const item of aiItems) {
      try {
        signals.push(normalizeHNSignal(item, 'en'))
        if (locale === 'zh') {
          signals.push({ ...normalizeHNSignal(item, 'zh'), id: `hn-${item.id}-zh`, language: 'zh' })
        }
      } catch {
        console.warn(`[hackernews] skip malformed item ${item?.id}`)
      }
    }
    return signals
  },
}
