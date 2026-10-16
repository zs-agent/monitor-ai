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

    const papers = data.filter(p => p.id || p.paper?.id).slice(0, 100).map((p: any) => ({
      id: `hf-${p.id || p.paper?.id}`,
      title: p.title || p.paper?.title || '',
      url: `https://huggingface.co/papers/${p.id || p.paper?.id || ''}`,
      upvotes: p.upvotes || p.paper?.upvotes || 0,
      createdAt: p.createdAt || p.paper?.createdAt || new Date().toISOString(),
    }))

    const signals: Signal[] = []
    for (const paper of papers) {
      try {
        signals.push(normalizeHFPaper(paper, locale))
      } catch {
        console.warn(`[huggingface] skip malformed paper ${paper?.id}`)
      }
    }
    return signals
  },
}
