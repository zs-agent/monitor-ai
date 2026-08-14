import type { Signal } from '@/types/signal'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { normalizeHFPaper } from '@/lib/normalizer'
import type { SignalProvider } from './types'

const TIMEOUT = 8000

export const huggingfaceProvider: SignalProvider = {
  id: 'huggingface',
  name: 'HuggingFace Papers',
  pollIntervalMs: 10 * 60 * 1000,
  async fetchSignals(locale) {
    const res = await fetchWithTimeout('https://huggingface.co/api/daily_papers', {}, TIMEOUT)
    if (!res.ok) throw new Error(`HF daily_papers HTTP ${res.status}`)
    const data: any[] = await res.json()

    const papers = data.slice(0, 15).map((p: any) => ({
      id: `hf-${p.id || p.paper?.id || Math.random().toString(36).slice(2)}`,
      title: p.title || p.paper?.title || '',
      url: `https://huggingface.co/papers/${p.id || p.paper?.id || ''}`,
      upvotes: p.upvotes || p.paper?.upvotes || 0,
      createdAt: p.createdAt || p.paper?.createdAt || new Date().toISOString(),
    }))

    const signals: Signal[] = []
    for (const paper of papers) {
      try {
        signals.push(normalizeHFPaper(paper, 'en'))
        if (locale === 'zh') {
          signals.push({ ...normalizeHFPaper(paper, 'zh'), id: `${paper.id}-zh`, language: 'zh' })
        }
      } catch {
        console.warn(`[huggingface] skip malformed paper ${paper?.id}`)
      }
    }
    return signals
  },
}
