'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { getLocale, type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import type { DataFreshnessSummary, DataSourceState } from '@/lib/data-freshness'
import type { AiLocation } from '@/data/ai-locations'
import WorkspaceHeader from '@/components/WorkspaceHeader'
import InsightSidebar from '@/components/InsightSidebar'
import AgentRadarPanel from '@/components/AgentRadarPanel'
import ModelReportsPanel from '@/components/ModelReportsPanel'
import ArenaPanel from '@/components/ArenaPanel'
import ShacklesPanel from '@/components/ShacklesPanel'
import EcoDetailDrawer from '@/components/EcoDetailDrawer'
import SignalDetailDrawer from '@/components/SignalDetailDrawer'

const DashboardMap = dynamic(() => import('@/components/DashboardMap'), { ssr: false })

interface SignalsResponse {
  signals?: Signal[]
  sourceHealth?: Record<string, string>
  sourceStates?: DataSourceState[]
  freshness?: DataFreshnessSummary
  fetchedAt?: string
  cached?: boolean
  stale?: boolean
  fallback?: string
}

function deriveDataState(d: SignalsResponse): string {
  if (d.fallback === 'mock') return 'mock'
  if (d.stale === true) return 'stale'
  if (d.cached === true) return 'cached'
  const health = d.sourceHealth || {}
  const values = Object.values(health)
  if (values.length === 0) return 'error'
  if (!values.some(v => v === 'ok')) return 'error'
  return 'live'
}

export default function NexusPage() {
  const [locale, setLocale] = useState<Locale>('en')
  const [signals, setSignals] = useState<Signal[]>([])
  const [sourceStates, setSourceStates] = useState<DataSourceState[]>([])
  const [freshness, setFreshness] = useState<DataFreshnessSummary | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [dataState, setDataState] = useState('loading')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEntity, setSelectedEntity] = useState<AiLocation | null>(null)
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => { setLocale(getLocale()) }, [])

  const load = useCallback((isRefresh = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    fetch(`/api/signals?locale=${getLocale()}&category=all`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<SignalsResponse> })
      .then(d => {
        if (ctrl.signal.aborted) return
        setSignals(d.signals || [])
        setSourceStates(d.sourceStates || [])
        setFreshness(d.freshness || null)
        setFetchedAt(d.fetchedAt || null)
        setDataState(deriveDataState(d))
        setLoading(false)
        setRefreshing(false)
      })
      .catch(e => {
        if (e.name === 'AbortError') return
        setError(e.message)
        setDataState('error')
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  useEffect(() => { load(); return () => abortRef.current?.abort() }, [load])

  const filteredSignals = useMemo(() => {
    if (!searchQuery) return signals
    const q = searchQuery.toLowerCase()
    return signals.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [signals, searchQuery])

  if (error && signals.length === 0) {
    return (
      <div className="p-6">
        <div className="text-[12px] text-[var(--error)] bg-[var(--bg-card)] rounded border border-[var(--border)] p-4 m-4">
          {locale === 'zh' ? '加载失败' : 'Load failed'}: {error}
          <button onClick={() => load()} className="ml-3 text-[var(--accent)]">{locale === 'zh' ? '重试' : 'Retry'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* 顶部：情报总览 */}
      <WorkspaceHeader
        locale={locale}
        signals={signals}
        freshness={freshness}
        fetchedAt={fetchedAt}
        dataState={loading ? 'loading' : dataState}
        onRefresh={() => load(true)}
        onSearch={setSearchQuery}
        refreshing={refreshing}
      />

      {/* 搜索无结果提示 */}
      {searchQuery && filteredSignals.length === 0 && (
        <div className="px-5 pt-4">
          <div className="text-[11px] text-[var(--warning)] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-4 py-2.5">
            {locale === 'zh'
              ? `没有匹配「${searchQuery}」的信号，试试其他关键词`
              : `No signals match "${searchQuery}". Try another keyword.`}
          </div>
        </div>
      )}

      {/* 首屏行1：全景生态地图（8 列）+ 核心判断侧栏（4 列）—— 统一 12 列栅格 */}
      <section className="grid grid-cols-12 gap-3 px-5 pt-4">
        <div className="col-span-12 lg:col-span-8 min-h-[440px] lg:h-[440px]">
          <DashboardMap
            locale={locale}
            signals={filteredSignals}
            onSelectEntity={setSelectedEntity}
          />
        </div>
        <div className="col-span-12 lg:col-span-4 min-h-[440px] lg:h-[440px]" style={{ height: '440px' }}>
          <InsightSidebar
            locale={locale}
            signals={filteredSignals}
            sourceStates={sourceStates}
            onSignalClick={setSelectedSignal}
            searchQuery={searchQuery}
            dataState={dataState === 'mock' ? 'static' : dataState === 'stale' ? 'stale' : dataState === 'cached' ? 'cached' : 'live'}
          />
        </div>
      </section>

      {/* 中部：模型报告 / 竞技场 / Agent紧箍咒（4+4+4，等高限高）—— 模型类内容前置 */}
      <section className="grid grid-cols-12 gap-3 px-5 pt-4">
        <div className="col-span-12 md:col-span-6 xl:col-span-4" style={{ height: '560px' }}><ModelReportsPanel locale={locale} /></div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4" style={{ height: '560px' }}><ArenaPanel locale={locale} /></div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4" style={{ height: '560px' }}><ShacklesPanel locale={locale} /></div>
      </section>

      {/* 下部：Agent 开源雷达（全宽 12 列，限高内部滚动） */}
      <section className="px-5 pt-4">
        <div style={{ height: '560px' }}>
          <AgentRadarPanel locale={locale} />
        </div>
      </section>

      {/* 详情抽屉 */}
      <EcoDetailDrawer
        locale={locale}
        entity={selectedEntity}
        signals={filteredSignals}
        onClose={() => setSelectedEntity(null)}
        onSignalClick={(s) => { setSelectedEntity(null); setSelectedSignal(s) }}
      />
      {selectedSignal && (
        <SignalDetailDrawer signal={selectedSignal} locale={locale} onClose={() => setSelectedSignal(null)} />
      )}
    </div>
  )
}
