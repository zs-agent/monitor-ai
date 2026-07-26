'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import SignalCard from '@/components/SignalCard'
import ComparisonPanel from '@/components/ComparisonPanel'
import TrendChartPanel from '@/components/TrendChartPanel'
import AIMarketInsightPanel from '@/components/AIMarketInsightPanel'
import NewsTimeline from '@/components/NewsTimeline'
import DashboardMap from '@/components/DashboardMap'
import LeaderboardPanel from '@/components/LeaderboardPanel'
import { getLocale, getTranslations, type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import type { DataFreshnessSummary } from '@/lib/data-freshness'
import { persistBootstrap } from '@/lib/bootstrap'
import { clusterSignals, type ClusteredSignal } from '@/lib/clustering'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import CompanyRadar from '@/components/CompanyRadar'
import TimeRangeFilter from '@/components/TimeRangeFilter'
import BreakingNewsBanner from '@/components/BreakingNewsBanner'
import MonitorPanel from '@/components/MonitorPanel'
import FloatingChat from '@/components/FloatingChat'
import SignalDetailModal from '@/components/SignalDetailModal'
import VirtualSignalList from '@/components/VirtualSignalList'
import { usePolling } from '@/lib/use-polling'

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'models', label: 'Models' },
  { key: 'products', label: 'Products' },
  { key: 'industry', label: 'Industry' },
  { key: 'papers', label: 'Papers' },
  { key: 'tips', label: 'Tips' },
] as const
type Category = (typeof CATEGORIES)[number]['key']

export default function Home() {
  const [locale, setLocaleState] = useState<Locale>('en')
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('24h')
  const [selectedSignal, setSelectedSignal] = useState<Signal | ClusteredSignal | null>(null)

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

  const { data: apiData, loading: apiLoading } = usePolling<{
    signals: Signal[]
    fetchedAt: string
    sourceHealth: Record<string, string>
    freshness?: DataFreshnessSummary
  }>(() =>
    fetch(`${API_BASE}/api/signals?locale=${locale}&category=${activeCategory}`).then(r => {
      if (!r.ok) throw new Error('API error')
      return r.json()
    }),
    60000
  )

  useEffect(() => {
    setLocaleState(getLocale())
    const timer = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(timer)
  }, [])

  const handleLocaleChange = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
  }, [])

  const signals = useMemo(() => apiData?.signals || [], [apiData?.signals])
  const filteredSignals = useMemo(() => {
    let result = signals
    if (activeCategory !== 'all') {
      result = result.filter(s => s.category === activeCategory)
    }
    if (timeRange !== 'all') {
      const now = Date.now()
      const ranges: Record<string, number> = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 }
      const cutoff = now - (ranges[timeRange] || 0)
      result = result.filter(s => new Date(s.publishedAt).getTime() > cutoff)
    }
    return result
  }, [signals, activeCategory, timeRange])
  const clusteredSignals = useMemo(() => {
    if (filteredSignals.length < 3) return filteredSignals
    return clusterSignals(filteredSignals)
  }, [filteredSignals])

  useEffect(() => {
    if (apiData?.signals && apiData?.signals.length > 0) {
      persistBootstrap(apiData.signals, apiData.freshness)
    }
  }, [apiData?.signals, apiData?.freshness])

  const translations = getTranslations(locale)
  const tFunc = (key: string): string => {
    const keys = key.split('.')
    let result: any = translations
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) result = result[k]
      else return key
    }
    return typeof result === 'string' ? result : key
  }

  const sourceHealth = useMemo(() => apiData?.sourceHealth || {}, [apiData?.sourceHealth])
  const signalCounts = useMemo(() => ({
    total: signals.length,
    high: signals.filter(s => s.importance >= 4).length,
    sources: signals.reduce((sum, s) => sum + s.sourcesCount, 0),
    sourceHealth,
  }), [signals, sourceHealth])

  const isLoading = loading || apiLoading

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* === Top Navigation Bar - Palantir style === */}
      <nav className="h-11 flex items-center justify-between px-4 border-b border-[#1e1e2e] bg-[#0c0c14] flex-shrink-0 select-none">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight">
              <span className="text-[#06b6d4]">monitor</span><span className="text-[#e5e5e5]">.ai</span>
            </span>
            <span className="text-[9px] text-[#5c5c72] hidden sm:inline">{tFunc('app.tagline')}</span>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-0.5 ml-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-3 py-1 text-[11px] rounded-md transition-all duration-150 ${
                  activeCategory === cat.key
                    ? 'bg-[#06b6d4]/10 text-[#06b6d4] font-medium'
                    : 'text-[#5c5c72] hover:text-[#8b8ba0] hover:bg-[#12121a]'
                }`}
              >
                {locale === 'zh' ? tFunc(`filter.${cat.key}`) : cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right side: Stats + Locale */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-[11px]">
            <span className="flex items-center gap-1.5 text-[#5c5c72]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse-slow" />
              <span className="hidden sm:inline">LIVE</span>
            </span>
            <span className="text-[#8b8ba0] hidden sm:inline">
              {signalCounts.total} <span className="text-[#5c5c72]">{locale === 'zh' ? '信号' : 'signals'}</span>
            </span>
            <span className="text-[#f59e0b] hidden sm:inline">
              {signalCounts.high} <span className="text-[#5c5c72]">high</span>
            </span>
            <span className="text-[#5c5c72] hidden lg:inline">
              {signalCounts.sources} <span className="text-[#5c5c72]">{locale === 'zh' ? '源' : 'sources'}</span>
            </span>
          </div>
          <LocaleSwitcher onChange={handleLocaleChange} />
        </div>
      </nav>

      {/* Breaking News */}
      <BreakingNewsBanner signals={signals} locale={locale} />

      {/* === Main Content === */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4 main-content">
        {/* Row 1: Map (6) + AI Market Insight (4) — fixed height so the map is large enough */}
        <div className="grid grid-cols-1 lg:grid-cols-[6fr_4fr] gap-3 mb-3 lg:h-[560px]">
          <DashboardMap locale={locale} signals={signals} />
          <AIMarketInsightPanel locale={locale} signals={signals} />
        </div>

        {/* Row 2: Leaderboard (wide) | NewsTimeline (narrow, bottom-aligned with leaderboard) */}
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr] gap-3 mb-3 lg:items-stretch">
          <LeaderboardPanel locale={locale} />
          <div className="flex flex-col min-h-0">
            <NewsTimeline locale={locale} signals={signals} onSignalClick={setSelectedSignal} />
          </div>
        </div>

        {/* Row 3: ComparisonPanel + TrendChart side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          <ComparisonPanel locale={locale} signals={signals} />
          <TrendChartPanel locale={locale} />
        </div>

        {/* Row 4: Vendor Radar + Keyword Monitor */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <CompanyRadar locale={locale} signals={signals} />
          <MonitorPanel signals={signals} locale={locale} />
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#5c5c72]">
            {tFunc(`filter.${activeCategory}`)} · {locale === 'zh' ? '信号流' : 'Signal Stream'}
          </h2>
          <div className="flex items-center gap-3">
            <TimeRangeFilter locale={locale} active={timeRange} onChange={setTimeRange} />
            <span className="text-[9px] text-[#5c5c72] font-mono" suppressHydrationWarning>
              {new Date().toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US', { hour12: false })}
            </span>
          </div>
        </div>

        {/* Signal Grid with Virtual Scrolling */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[#12121a] border border-[#1e1e2e] rounded-lg p-4 animate-pulse-slow" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 rounded bg-[#1e1e2e]" />
                  <div className="h-3 bg-[#1e1e2e] rounded w-16" />
                  <div className="h-3 bg-[#1e1e2e] rounded w-12 ml-auto" />
                </div>
                <div className="h-4 bg-[#1e1e2e] rounded w-full mb-2" />
                <div className="h-3 bg-[#1e1e2e] rounded w-3/4 mb-3" />
                <div className="h-3 bg-[#1e1e2e] rounded w-1/2" />
                <div className="flex gap-1 mt-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="h-0.5 flex-1 rounded-full bg-[#1e1e2e]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredSignals.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="text-2xl text-[#1e1e2e] mb-3">◇</div>
              <p className="text-sm text-[#5c5c72]">{tFunc('noSignals')}</p>
            </div>
          </div>
        ) : (
          <VirtualSignalList
            items={clusteredSignals}
            renderItem={(signal: Signal | ClusteredSignal) => (
              <SignalCard signal={signal} locale={locale} onClick={() => setSelectedSignal(signal)} />
            )}
          />
        )}
      </main>

      {/* === Status Bar === */}
      <footer className="h-7 flex items-center justify-between px-4 border-t border-[#1e1e2e] bg-[#0c0c14] text-[10px] text-[#5c5c72] flex-shrink-0">
        <span className="font-mono">monitor.ai v0.1.0</span>
        <span className="flex items-center gap-4">
          <span>{filteredSignals.length} {locale === 'zh' ? '条信号' : 'signals'}</span>
          <span className="w-1 h-1 rounded-full bg-[#1e1e2e]" />
          <span>{
            Object.entries(sourceHealth).map(([k, v]) => `${k}:${v}`).join(' | ')
          }</span>
          <span className="w-1 h-1 rounded-full bg-[#1e1e2e]" />
          <span suppressHydrationWarning>{new Date().toISOString().slice(0, 16).replace('T', ' ')}Z</span>
        </span>
      </footer>
      {/* Floating Chat */}
      <FloatingChat signals={signals} locale={locale} />
      {/* Signal Detail Modal */}
      <SignalDetailModal signal={selectedSignal} locale={locale} onClose={() => setSelectedSignal(null)} />
    </div>
  )
}
