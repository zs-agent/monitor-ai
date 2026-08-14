'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { getLocale, type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import type { DataFreshnessSummary, DataSourceState } from '@/lib/data-freshness'
import type { AiLocation } from '@/data/ai-locations'
import WorkspaceHeader, { type GlobalSearchData } from '@/components/WorkspaceHeader'
import InsightSidebar from '@/components/InsightSidebar'
import InsightsPanel from '@/components/InsightsPanel'
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
  const [globalData, setGlobalData] = useState<GlobalSearchData>({ projects: [], models: [], reports: [], articles: [] })
  const [selectedEntity, setSelectedEntity] = useState<AiLocation | null>(null)
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null)
  const [arenaFocus, setArenaFocus] = useState<{ model: string; dim?: string; ts: number } | null>(null)
  const arenaRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const notifiedRef = useRef<Set<string>>(new Set())

  // #8 高价值信号告警：importance≥4 且未通知过的，推浏览器通知
  // 说明：仅在用户已授权时推送；default 状态不自动请求（Chrome 无用户手势会静默拒绝并反复打扰），
  // 用户可自行通过浏览器站点设置开启通知权限
  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'granted') return
    const high = signals.filter(s => s.importance >= 4 && !notifiedRef.current.has(s.id))
    if (high.length === 0) return
    high.forEach(s => notifiedRef.current.add(s.id))
    high.slice(0, 3).forEach(s => {
      try {
        new Notification('🔔 高价值 AI 信号', { body: s.title.slice(0, 80), tag: s.id })
      } catch { /* 通知创建失败忽略 */ }
    })
  }, [signals])

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

  // 信号自动刷新：页面可见期间每 60s 后台重拉（isRefresh=true 不触发整页 loading 闪烁）
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(true) }, 60 * 1000)
    return () => clearInterval(id)
  }, [load])

  // 综合搜索数据：聚合雷达/竞技场/报告/文章（服务端各有缓存，重复请求开销低）
  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      fetch('/api/agent-radar').then(r => r.json()),
      fetch('/api/arena').then(r => r.json()),
      fetch('/api/model-reports').then(r => r.json()),
      fetch('/api/agent-shackles').then(r => r.json()),
    ]).then(([radar, arena, reports, shackles]) => {
      if (cancelled) return
      const g: GlobalSearchData = { projects: [], models: [], reports: [], articles: [] }
      const rj = radar.status === 'fulfilled' ? radar.value : null
      g.projects = ((rj?.projects) || []).map((p: { id: string; name: string; repo: string }) => ({ id: `p-${p.id}`, name: p.name, url: `https://github.com/${p.repo}` }))
      const aj = arena.status === 'fulfilled' ? arena.value : null
      const seen = new Set<string>()
      for (const b of (aj?.boards || [])) {
        for (const e of (b.entries || [])) {
          if (seen.has(e.model)) continue
          seen.add(e.model)
          g.models.push({ id: `m-${b.dimension}-${e.model}`, name: e.model, org: e.organization || '', dim: b.dimension })
        }
      }
      const rp = reports.status === 'fulfilled' ? reports.value : null
      for (const it of [...(rp?.live || []), ...(rp?.curated || [])].slice(0, 40)) {
        g.reports.push({ id: `r-${it.id}`, name: it.name, url: it.sourceUrl })
      }
      const sj = shackles.status === 'fulfilled' ? shackles.value : null
      for (const it of (sj?.items || []).slice(0, 40)) {
        g.articles.push({ id: `a-${it.id}`, name: it.title, url: it.url })
      }
      setGlobalData(g)
    })
    return () => { cancelled = true }
  }, [])

  const filteredSignals = useMemo(() => {
    if (!searchQuery) return signals
    const q = searchQuery.toLowerCase()
    return signals.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [signals, searchQuery])

  // 综合搜索点击模型 → 滚动到竞技场并定位该模型
  const handleModelSelect = useCallback((model: string, dim?: string) => {
    setArenaFocus({ model, dim, ts: Date.now() })
    arenaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  if (error && signals.length === 0) {
    return (
      <div className="p-6">
        <div className="text-[12px] text-danger bg-card rounded border border-edge p-4 m-4">
          {locale === 'zh' ? '加载失败' : 'Load failed'}: {error}
          <button onClick={() => load()} className="ml-3 text-accent">{locale === 'zh' ? '重试' : 'Retry'}</button>
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
        sourceStates={sourceStates}
        fetchedAt={fetchedAt}
        dataState={loading ? 'loading' : dataState}
        onRefresh={() => load(true)}
        onSearch={setSearchQuery}
        refreshing={refreshing}
        globalData={globalData}
        onSignalClick={setSelectedSignal}
        onModelSelect={handleModelSelect}
      />

      {/* 首屏：全景 AI Agent 生态地图（全宽，加长加高） */}
      <section className="px-5 pt-4">
        <div style={{ height: '560px' }}>
          <DashboardMap
            locale={locale}
            signals={filteredSignals}
            onSelectEntity={setSelectedEntity}
          />
        </div>
      </section>

      {/* 搜索无结果提示 */}
      {searchQuery && filteredSignals.length === 0 && (
        <div className="px-5 pt-4">
          <div className="text-[11px] text-warning bg-card border border-edge rounded-lg px-4 py-2.5">
            {locale === 'zh'
              ? `没有匹配「${searchQuery}」的信号，试试其他关键词`
              : `No signals match "${searchQuery}". Try another keyword.`}
          </div>
        </div>
      )}

      {/* 中部行1：今日 AI 洞察（8 列）+ 核心判断侧栏（4 列）—— 统一 12 列栅格 */}
      <section className="grid grid-cols-12 gap-3 px-5 pt-4">
        <div className="col-span-12 lg:col-span-8 min-h-[440px] lg:h-[440px]">
          <InsightsPanel locale={locale} signals={signals} onSignalClick={setSelectedSignal} />
        </div>
        <div className="col-span-12 lg:col-span-4 min-h-[440px] lg:h-[440px]" style={{ height: '440px' }}>
          <InsightSidebar
            locale={locale}
            signals={filteredSignals}
            onSignalClick={setSelectedSignal}
            searchQuery={searchQuery}
            dataState={dataState === 'mock' ? 'static' : dataState === 'stale' ? 'stale' : dataState === 'cached' ? 'cached' : 'live'}
          />
        </div>
      </section>

      {/* 中部：模型报告 / 竞技场 / Agent紧箍咒（4+4+4，等高限高）—— 模型类内容前置 */}
      <section className="grid grid-cols-12 gap-3 px-5 pt-4">
        <div className="col-span-12 md:col-span-6 xl:col-span-4" style={{ height: '560px' }}><ModelReportsPanel locale={locale} /></div>
        <div ref={arenaRef} className="col-span-12 md:col-span-6 xl:col-span-4" style={{ height: '560px' }}><ArenaPanel locale={locale} focus={arenaFocus} /></div>
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
