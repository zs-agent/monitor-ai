import type { Signal } from '@/types/signal'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import type { SignalProvider } from './types'

interface ModelRecord {
  id?: string; private?: boolean; sha?: string; lastModified?: string; createdAt?: string
  downloads?: number; likes?: number; pipeline_tag?: string; tags?: string[]; gated?: boolean | string
}

/** Public Hub metadata only. Model cards must be fetched and checked by research. */
export const huggingfaceModelsProvider: SignalProvider = {
  id: 'huggingface-models', name: 'Hugging Face Models', pollIntervalMs: 10 * 60 * 1000,
  async fetchSignals(locale) {
    const urls = [
      'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=50&full=true',
      'https://huggingface.co/api/models?sort=lastModified&direction=-1&limit=50&filter=text-generation&full=true',
    ]
    const batches = await Promise.allSettled(urls.map(async url => {
      const response = await fetchWithTimeout(url, {}, 8000)
      if (!response.ok) throw new Error('HF models HTTP ' + response.status)
      const rows: unknown = await response.json()
      if (!Array.isArray(rows)) throw new Error('HF models response is not an array')
      return rows as ModelRecord[]
    }))
    if (batches.every(row => row.status === 'rejected')) throw new Error('Hugging Face model index unavailable')
    const seen = new Set<string>()
    const signals: Signal[] = []
    for (const batch of batches) {
      if (batch.status !== 'fulfilled') continue
      for (const row of batch.value) {
        if (!row || typeof row.id !== 'string' || row.private === true || !/^[\w.-]+\/[\w.-]+$/.test(row.id) || seen.has(row.id)) continue
        const publishedAt = row.lastModified || row.createdAt
        if (!publishedAt || !Number.isFinite(Date.parse(publishedAt))) continue
        seen.add(row.id)
        const tags = Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === 'string').slice(0, 30) : []
        const downloads = typeof row.downloads === 'number' && Number.isFinite(row.downloads) ? Math.max(0, row.downloads) : 0
        const kind = row.pipeline_tag || 'model'
        signals.push({
          id: 'hf-model-' + row.id, title: row.id + ' · ' + kind,
          summary: (locale === 'zh' ? '公开模型仓库；任务：' : 'Public model repository; task: ') + kind + '; revision: ' + (row.sha || 'unknown') +
            '; downloads: ' + downloads + '; ' + tags.join(', ') + (row.gated ? '; 访问限制 / gated' : ''),
          source: 'Hugging Face Models', sourceUrl: 'https://huggingface.co/' + row.id.split('/').map(encodeURIComponent).join('/'),
          publishedAt, category: 'models', country: 'UN', credibility: 4,
          tags: Array.from(new Set(['model', kind, ...tags])), importance: downloads >= 100000 ? 5 : downloads >= 1000 ? 4 : 2,
          sourcesCount: 1, language: locale, providerId: 'huggingface-models',
        })
      }
    }
    return signals
  },
}
