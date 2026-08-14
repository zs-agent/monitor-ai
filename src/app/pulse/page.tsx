'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { getLocale, type Locale } from '@/lib/i18n'
import PageHeader from '@/components/layout/PageHeader'
import SignalCard from '@/components/SignalCard'
import SignalDetailDrawer from '@/components/SignalDetailDrawer'
import CompanyRadar from '@/components/CompanyRadar'
import type { Signal } from '@/types/signal'

const CATEGORIES = [
  { key: 'all', label: 'All' }, { key: 'models', label: 'Models' },
  { key: 'products', label: 'Products' }, { key: 'industry', label: 'Industry' },
  { key: 'papers', label: 'Papers' }, { key: 'tips', label: 'Tips' },
]

export default function PulsePage() {
  const [locale, setLocale] = useState<Locale>('en')
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [timeRange, setTimeRange] = useState('24h')
  const [languageFilter, setLanguageFilter] = useState<'all' | 'zh' | 'en'>('all')
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
  const [activeTags, setActiveTags] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => { setLocale(getLocale()) }, [])

  useEffect(() => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true); setError(null)
    fetch(`/api/signals?locale=${locale}&category=all`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (!ctrl.signal.aborted) { setSignals(d.signals || []); setLoading(false) } })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ctrl.abort()
  }, [locale])

  const filteredSignals = useMemo(() => {
    let result = signals
    if (category !== 'all') result = result.filter(s => s.category === category)
    if (languageFilter !== 'all') result = result.filter(s => s.language === languageFilter)
    if (activeTags.length > 0) result = result.filter(s => s.tags?.some(t => activeTags.includes(t)))
    if (timeRange !== 'all') {
      const now = Date.now()
      const ranges: Record<string, number> = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 }
      const cutoff = now - (ranges[timeRange] || 0)
      result = result.filter(s => new Date(s.publishedAt).getTime() > cutoff)
    }
    return result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  }, [signals, category, languageFilter, timeRange, activeTags])

  return (
    <div className="min-h-full">
      <PageHeader title={locale === 'zh' ? '情报脉冲' : 'PULSE'}
        valueProp={locale === 'zh' ? '实时 AI 信号流 — 新闻、论文、开源项目与模型动态' : 'Real-time AI signal stream — news, papers, repos, and model updates'} />

      <div className="flex flex-wrap items-center gap-2 px-4 mb-2">
        <div className="flex items-center gap-0.5">
          {CATEGORIES.map(cat => (
            <button key={cat.key} onClick={() => setCategory(cat.key)}
              className={`px-2.5 py-1 text-[10px] rounded-md transition-all ${category === cat.key ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'}`}>
              {cat.label}
            </button>
          ))}
        </div>
        <div className="w-px h-4 bg-edge" />
        <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value as any)}
          className="text-[10px] bg-elevated border border-edge-light rounded px-2 py-1 text-ink outline-none">
          <option value="all">{locale === 'zh' ? '全部语言' : 'All Languages'}</option>
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
        <select value={timeRange} onChange={e => setTimeRange(e.target.value)}
          className="text-[10px] bg-elevated border border-edge-light rounded px-2 py-1 text-ink outline-none">
          <option value="24h">{locale === 'zh' ? '24小时' : '24 Hours'}</option>
          <option value="7d">{locale === 'zh' ? '7天' : '7 Days'}</option>
          <option value="30d">{locale === 'zh' ? '30天' : '30 Days'}</option>
          <option value="all">{locale === 'zh' ? '全部' : 'All Time'}</option>
        </select>
        <span className="text-[9px] text-muted ml-auto">{filteredSignals.length} {locale === 'zh' ? '条信号' : 'signals'}</span>
      </div>

      {/* Tag filters */}
      {(() => {
        const tagCounts = new Map<string, number>()
        signals.forEach(s => s.tags?.forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)))
        const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20)
        if (sortedTags.length === 0) return null
        return (
          <div className="flex flex-wrap items-center gap-1.5 px-4 mb-3">
            {activeTags.length > 0 && (
              <button onClick={() => setActiveTags([])}
                className="text-[9px] text-muted hover:text-ink-2 mr-1">
                {locale === 'zh' ? '清除' : 'Clear'} ×
              </button>
            )}
            {sortedTags.map(([tag, count]) => (
              <button key={tag} onClick={() => setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                  activeTags.includes(tag)
                    ? 'bg-accent-bg border-accent text-accent'
                    : 'border-edge text-muted hover:border-edge-light hover:text-ink-2'
                }`}>
                #{tag} <span className="text-[9px] opacity-60">{count}</span>
              </button>
            ))}
          </div>
        )
      })()}

      <div className="px-4 pb-4">
        {/* 厂商提及统计（原产业雷达模块并入） */}
        <div className="mb-3">
          <CompanyRadar locale={locale} signals={signals} />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-card rounded animate-pulse" />)}</div>
        ) : error ? (
          <div className="text-[11px] text-danger bg-card rounded p-4 border border-edge">
            {locale === 'zh' ? '加载失败' : 'Load failed'}: {error}
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted">
            <span className="text-3xl mb-2 opacity-30">◇</span>
            <p className="text-[11px]">{locale === 'zh' ? '当前筛选条件下暂无信号' : 'No signals match current filters'}</p>
            <p className="text-[9px] mt-1">{locale === 'zh' ? '尝试切换分类或时间范围' : 'Try changing category or time range'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredSignals.map(s => (
              <div key={s.id} onClick={() => setSelectedSignal(s)} className="cursor-pointer">
                <SignalCard signal={s} locale={locale} />
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedSignal && (
        <SignalDetailDrawer signal={selectedSignal} locale={locale} onClose={() => setSelectedSignal(null)} />
      )}
    </div>
  )
}
