'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { getLocale, type Locale } from '@/lib/i18n'
import PageHeader from '@/components/layout/PageHeader'
import SourceHealthPanel from '@/components/SourceHealthPanel'
import type { Signal } from '@/types/signal'
import type { DataSourceState } from '@/lib/data-freshness'

const PROVIDER_META = [
  { id: 'hackernews', name: 'Hacker News', desc: 'Top AI-related stories', type: 'Community' },
  { id: 'huggingface', name: 'HuggingFace Papers', desc: 'Daily AI papers', type: 'Academic' },
  { id: 'github', name: 'GitHub Trending', desc: 'Trending AI repos', type: 'Open Source' },
  { id: 'semanticscholar', name: 'Semantic Scholar', desc: 'AI research papers', type: 'Academic' },
]

export default function OpsPage() {
  const [locale, setLocale] = useState<Locale>('en')
  const [signals, setSignals] = useState<Signal[]>([])
  const [sourceStates, setSourceStates] = useState<DataSourceState[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => { setLocale(getLocale()) }, [])

  useEffect(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    fetch(`/api/signals?locale=${getLocale()}&category=all`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (!ctrl.signal.aborted) { setSignals(d.signals || []); setSourceStates(d.sourceStates || []); setFetchedAt(d.fetchedAt || null); setLoading(false) } })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ctrl.abort()
  }, [])

  const healthSources = useMemo(() =>
    sourceStates.map(s => ({
      id: s.id,
      name: s.name,
      status: s.status,
      lastUpdate: s.lastUpdate,
      itemCount: s.itemCount,
    })), [sourceStates])

  return (
    <div className="min-h-full">
      <PageHeader
        title={locale === 'zh' ? '源网监控' : 'OPS'}
        valueProp={locale === 'zh' ? '数据源健康度与系统状态（管理员视图）' : 'Data source health and system status (admin view)'}
      />

      <div className="px-4 pb-4 space-y-3">
        <SourceHealthPanel locale={locale} sources={healthSources} />

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border)] text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            {locale === 'zh' ? '数据源详情' : 'Source Details'}
          </div>
          {loading ? (
            <div className="p-4 text-[10px] text-[var(--text-muted)] animate-pulse">{locale === 'zh' ? '加载中...' : 'Loading...'}</div>
          ) : (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">{locale === 'zh' ? '数据源' : 'Source'}</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">{locale === 'zh' ? '类型' : 'Type'}</th>
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">{locale === 'zh' ? '说明' : 'Description'}</th>
                  <th className="text-right py-2 px-3 text-[var(--text-muted)] font-medium">{locale === 'zh' ? '状态' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {PROVIDER_META.map(p => {
                  const state = sourceStates.find(s => s.id === p.id)
                  return (
                  <tr key={p.id} className="border-b border-[var(--border)]/50 hover:bg-[var(--hover-overlay)] transition-colors">
                    <td className="py-2 px-3 text-[var(--text-primary)] font-medium">{p.name}</td>
                    <td className="py-2 px-3 text-[var(--text-secondary)]">{p.type}</td>
                    <td className="py-2 px-3 text-[var(--text-muted)]">{p.desc}</td>
                    <td className="py-2 px-3 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] ${
                        state?.status === 'fresh'
                          ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                          : state?.status === 'stale' || state?.status === 'very_stale'
                            ? 'bg-[var(--warning)]/10 text-[var(--warning)]'
                            : 'bg-[var(--error-bg)] text-[var(--error)]'
                      }`}>
                        {(state?.status || 'no_data').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded p-3 text-[10px] text-[var(--text-muted)]">
          <div className="flex items-center gap-4 flex-wrap">
            <span>API: /api/signals, /api/indicators, /api/agent-radar</span>
            <span>{locale === 'zh' ? '缓存 TTL' : 'Cache TTL'}: 5min</span>
            <span>{locale === 'zh' ? '信号总数' : 'Total Signals'}: {signals.length}</span>
            {fetchedAt && <span>{locale === 'zh' ? '数据抓取时间' : 'Fetched at'}: {new Date(fetchedAt).toLocaleString()}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
