'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { useRemoteData } from '@/lib/use-remote-data'
import PanelBase from './PanelBase'
import CredibilityTag from './CredibilityTag'
import { type ModelReportItem, type ModelReportType } from '@/data/model-reports'

interface Props {
  locale: Locale
}

interface ReportsResponse {
  state?: string
  fetchedAt?: string
  live?: ModelReportItem[]
  curated?: ModelReportItem[]
  partialSources?: string[]
  note?: string
}

const TYPE_FILTERS: (ModelReportType | 'all')[] = ['all', 'Technical Report', 'Model Card', '论文', '开源权重', '推理优化', 'Agent 能力']

const TYPE_CLS: Record<ModelReportType, string> = {
  'Technical Report': 'border-accent-40 text-accent bg-accent-bg',
  'Model Card': 'border-[#a78bfa]/40 text-[#a78bfa] bg-[#a78bfa]/10',
  '论文': 'border-[#34d399]/40 text-[#34d399] bg-[#34d399]/10',
  '开源权重': 'border-success-40 text-success bg-success-10',
  '推理优化': 'border-[#fb923c]/40 text-[#fb923c] bg-[#fb923c]/10',
  'Agent 能力': 'border-[#f59e0b]/40 text-[#f59e0b] bg-[#f59e0b]/10',
}

type Tab = 'all' | 'live' | 'curated'

export default function ModelReportsPanel({ locale }: Props) {
  const { data, loading, error, reload } = useRemoteData<ReportsResponse>('/api/model-reports', [], { refreshInterval: 5 * 60 * 1000 })
  const live = useMemo(() => data?.live ?? [], [data])
  const curated = useMemo(() => data?.curated ?? [], [data])
  const state = data?.state || 'static'
  const fetchedAt = data?.fetchedAt || null
  const [tab, setTab] = useState<Tab>('all')
  const [typeFilter, setTypeFilter] = useState<(ModelReportType | 'all')>('all')
  const [vendorFilter, setVendorFilter] = useState('all')

  const vendors = useMemo(() => {
    const set = new Set<string>()
    live.forEach(i => set.add(i.vendor))
    curated.forEach(i => set.add(i.vendor))
    return Array.from(set).filter(v => v !== '—').sort()
  }, [live, curated])

  const filtered = useMemo(() => {
    const source = tab === 'curated' ? curated : tab === 'live' ? live : [...live, ...curated]
    return source.filter(r =>
      (typeFilter === 'all' || r.type === typeFilter) &&
      (vendorFilter === 'all' || r.vendor === vendorFilter)
    ).sort((a, b) => b.date.localeCompare(a.date))
  }, [live, curated, tab, typeFilter, vendorFilter])

  const badge = state === 'live' ? 'live' : state === 'cached' ? 'cached' : state === 'partial' ? 'cached' : 'static'

  return (
    <PanelBase
      id="model-reports"
      title={locale === 'zh' ? '模型技术报告与论文' : 'Model Reports & Papers'}
      dataBadge={badge}
      dataBadgeDetail={fetchedAt ? fetchedAt.slice(0, 10) : undefined}
      count={live.length + curated.length}
      error={error}
      onRetry={reload}
      className="flex flex-col h-full"
    >
      {!error && (
        <div className="flex flex-col min-h-0 flex-1">
          {/* 筛选 */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1.5 border-b border-edge overflow-x-auto">
            {([['all', locale === 'zh' ? '全部' : 'All'], ['live', 'HF'], ['curated', 'REF']] as [Tab, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-2 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors ${tab === k ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'}`}
              >
                {label}
              </button>
            ))}
            <span className="w-px h-4 bg-edge mx-1" />
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as ModelReportType | 'all')}
              className="text-[11px] bg-elevated border border-edge-light rounded px-2 py-1 text-ink outline-none"
            >
              {TYPE_FILTERS.map(t => <option key={t} value={t}>{t === 'all' ? (locale === 'zh' ? '全部类型' : 'All types') : t}</option>)}
            </select>
            <select
              value={vendorFilter}
              onChange={e => setVendorFilter(e.target.value)}
              className="text-[11px] bg-elevated border border-edge-light rounded px-2 py-1 text-ink outline-none"
            >
              <option value="all">{locale === 'zh' ? '全部厂商' : 'All vendors'}</option>
              {vendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* 数据说明条 */}
          <div className="px-4 py-1.5 border-b border-edge-60 bg-card-2-50 flex items-center gap-2 flex-wrap text-[10px] text-muted">
            <CredibilityTag level={state === 'static' ? 'low' : 'high'} locale={locale} />
            {state === 'static' ? `⚠ ${locale === 'zh' ? '动态源暂不可达，仅显示静态快照' : 'Dynamic source unreachable — static snapshot only'}`
              : `HF = HuggingFace 动态（${locale === 'zh' ? '最新论文/权重' : 'latest papers & weights'}）· REF = ${locale === 'zh' ? '人工核实快照（2025）' : 'curated snapshot (2025)'}${fetchedAt ? ` · ${locale === 'zh' ? '更新' : 'updated'}: ${fetchedAt.slice(0, 10)}` : ''}`}
          </div>

          {/* 列表 */}
          <div className="p-3 overflow-y-auto min-h-0 flex-1 space-y-2">
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-hover rounded-lg animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="text-2xl mb-2 opacity-30">◇</span>
                <p className="text-[12px] text-muted">{locale === 'zh' ? '当前筛选下暂无条目' : 'No entries match filters'}</p>
              </div>
            ) : filtered.map(r => (
              <article key={r.id} className="bg-card-2 border border-edge rounded-lg p-3 hover:border-edge-light transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-semibold text-ink">{r.vendor}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${TYPE_CLS[r.type] || 'border-edge text-muted'}`}>{r.type}</span>
                      <span className="text-[9px] text-muted font-mono">{r.date}</span>
                      <span className={`text-[9px] px-1 py-px rounded ${r.id.startsWith('hf-') || r.id.startsWith('hm-') ? 'bg-accent-bg text-accent' : 'bg-hover text-muted'}`}>
                        {r.id.startsWith('hf-') || r.id.startsWith('hm-') ? 'HF' : 'REF'}
                      </span>
                      <span className={`text-[9px] px-1 py-px rounded ${r.official === false ? 'bg-hover text-muted' : 'bg-emerald-400/10 text-emerald-400'}`}>
                        {r.official === false ? (locale === 'zh' ? '社区' : 'Community') : (locale === 'zh' ? '官方' : 'Official')}
                      </span>
                    </div>
                    <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className="block text-[13px] font-medium text-accent hover:text-accent-dim mt-1 transition-colors">
                      {r.name} ↗
                    </a>
                  </div>
                </div>
                {(r.keyChange || r.usageImpact) && (
                  <div className="mt-2 space-y-1">
                    {r.keyChange && <p className="text-[11px] text-ink-2 line-clamp-2">
                      <span className="text-muted">{locale === 'zh' ? '关键变化' : 'Key change'}:</span> {r.keyChange}
                    </p>}
                    {r.usageImpact ? <p className="text-[11px] text-ink-2">
                      <span className="text-muted">{locale === 'zh' ? '使用影响' : 'Impact'}:</span> {r.usageImpact}
                    </p> : r.id.startsWith('hf-') || r.id.startsWith('hm-') ? (
                      <p className="text-[10px] text-dim">{locale === 'zh' ? '使用影响：待结合评测补充' : 'Impact: pending evaluation'}</p>
                    ) : null}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
    </PanelBase>
  )
}
