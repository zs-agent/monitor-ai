import type { Signal } from '@/types/signal'
import type { ModelReportItem } from '@/data/model-reports'
/** Reuse the ingestion pipeline, its retries, source status and publication times. */
export function signalsToReports(signals: Signal[]): ModelReportItem[] {
  return signals.flatMap<ModelReportItem>(s => {
    if (s.providerId === 'huggingface-models') {
      const repo = s.id.replace(/^hf-model-/, '')
      return [{ id: 'hm-' + repo, vendor: repo.split('/')[0], name: repo.split('/').pop() || repo,
        type: '开源权重' as const, date: s.publishedAt.slice(0, 10), updatedAt: s.publishedAt, sourceUrl: s.sourceUrl,
        keyChange: s.summary, usageImpact: '', official: false }]
    }
    if (s.category === 'papers' && (s.providerId === 'huggingface' || s.providerId === 'semanticscholar'))
      return [{ id: s.id, vendor: '—', name: s.title, type: '论文' as const, date: s.publishedAt.slice(0, 10), updatedAt: s.publishedAt,
        sourceUrl: s.sourceUrl, keyChange: s.summary, usageImpact: '' }]
    return []
  })
}
