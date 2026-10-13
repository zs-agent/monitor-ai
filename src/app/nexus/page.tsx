'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { getLocale, type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import type { DataFreshnessSummary, DataSourceState } from '@/lib/data-freshness'
import type { AiLocation } from '@/data/ai-locations'
import { useLocalStore } from '@/lib/local-store'
import WorkspaceHeader, { type GlobalSearchData } from '@/components/WorkspaceHeader'
import ResearchWorkspace from '@/components/research/ResearchWorkspace'
import IntelligenceBrowser from '@/components/IntelligenceBrowser'
import type { BrowseCounts, BrowsePreset } from '@/lib/browse-view'
import ShortlistStrip from '@/components/ShortlistStrip'
import SectionHeading from '@/components/layout/SectionHeading'
import InsightSidebar from '@/components/InsightSidebar'
import InsightsPanel from '@/components/InsightsPanel'
import AgentRadarPanel from '@/components/AgentRadarPanel'
import ModelReportsPanel from '@/components/ModelReportsPanel'
import ArenaPanel from '@/components/ArenaPanel'
import ShacklesPanel from '@/components/ShacklesPanel'
import EcoDetailDrawer from '@/components/EcoDetailDrawer'
import SignalDetailDrawer from '@/components/SignalDetailDrawer'

const DashboardMap = dynamic(() => import('@/components/DashboardMap'), { ssr: false })

/** 观测中枢 = 多智能体情报工作台：看板（信号流模块 · 生态地图 · 洞察 · 模型类面板）· 情报研究 */
type WorkbenchTab = 'dashboard' | 'research'

const TABS: [WorkbenchTab, { zh: string; en: string }][] = [
  ['dashboard', { zh: '看板', en: 'Dashboard' }],
  ['research', { zh: '情报研究', en: 'Research' }],
]

/** 全看板共享的信号时间窗：一处切换，地图/洞察/侧栏/情报浏览器同时生效（服务端榜单类面板不受影响） */
const SIGNAL_WINDOWS: { key: 'all' | '24h' | '7d' | '30d'; zh: string; en: string; ms: number }[] = [
  { key: 'all', zh: '全部', en: 'All', ms: 0 },
  { key: '24h', zh: '24小时', en: '24h', ms: 86400000 },
  { key: '7d', zh: '7天', en: '7d', ms: 604800000 },
  { key: '30d', zh: '30天', en: '30d', ms: 2592000000 },
]

/** 「今日 AI 洞察」模块的两种视图：先看研判，需要时切到检索；两者常驻挂载，切走再切回不丢状态 */
const INSIGHT_VIEWS: ['brief' | 'browse', { zh: string; en: string }][] = [
  ['brief', { zh: '当日研判', en: 'Brief' }],
  ['browse', { zh: '情报检索', en: 'Retrieval' }],
]

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
  const [tab, setTab] = useState<WorkbenchTab>('dashboard')
  /** 今日 AI 洞察模块内的视图：当日研判 / 情报检索 */
  const [insightsView, setInsightsView] = useState<'brief' | 'browse'>('brief')
  /** 检索视图可挖的规模（由情报浏览器上报，研判视图据此展示「证据链」） */
  const [browseCounts, setBrowseCounts] = useState<BrowseCounts | null>(null)
  /** 研判下钻：给定分类后切到检索视图并打上该分类筛选 */
  const [browsePreset, setBrowsePreset] = useState<BrowsePreset | null>(null)
  /** 洞察重新生成：标头的 ⟳ 自增这个数字，面板收到变化后重新生成 */
  const [insightsRefresh, setInsightsRefresh] = useState(0)
  const [insightsRefreshing, setInsightsRefreshing] = useState(false)
  const [signalWindow, setSignalWindow] = useState<'all' | '24h' | '7d' | '30d'>('all')
  // 关注清单：跨维度标记，存本机（localStorage）
  const [shortlist, setShortlist] = useLocalStore<string[]>('monitor-ai-shortlist', [])
  const toggleShortlist = useCallback((key: string) => {
    setShortlist(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  }, [setShortlist])

  // 洞察 → 检索：结论给判断，检索给证据链
  const openRetrieval = useCallback(() => setInsightsView('browse'), [])
  const drillToSignals = useCallback((category: string) => {
    setBrowsePreset({ dimension: 'signals', category })
    setInsightsView('browse')
  }, [])
  // 浏览器上报规模：内容没变就不触发重渲染
  const handleBrowseCounts = useCallback((counts: BrowseCounts) => {
    setBrowseCounts(prev =>
      prev && prev.signals === counts.signals && prev.vendors === counts.vendors && prev.models === counts.models ? prev : counts,
    )
  }, [])
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

  // 支持 URL 直达页签（落地页特性卡与书签用）：/nexus?tab=dashboard|research
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab')
    // 旧的 ?tab=stream 指向已并入看板的信号流，回退到看板
    if (wanted === 'stream' || wanted === 'dashboard') setTab('dashboard')
    else if (wanted === 'research') setTab('research')
  }, [])

  // 从综合搜索点了模型：切到看板后把竞技场滚进视野（元素要挂载完才滚）
  useEffect(() => {
    if (tab !== 'dashboard' || !arenaFocus) return
    const id = window.setTimeout(() => arenaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120)
    return () => window.clearTimeout(id)
  }, [tab, arenaFocus])

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

  // 时间窗只作用在信号类视图上（服务端榜单/来源面板有各自的窗口，这里不动它们）
  const windowedSignals = useMemo(() => {
    const ms = SIGNAL_WINDOWS.find(w => w.key === signalWindow)?.ms ?? 0
    if (!ms) return signals
    const cutoff = Date.now() - ms
    return signals.filter(s => new Date(s.publishedAt).getTime() >= cutoff)
  }, [signals, signalWindow])

  const filteredSignals = useMemo(() => {
    if (!searchQuery) return windowedSignals
    const q = searchQuery.toLowerCase()
    return windowedSignals.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.summary.toLowerCase().includes(q) ||
      s.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [windowedSignals, searchQuery])

  // 综合搜索点击模型 → 切到看板并定位该模型（滚动交给上面的 effect）
  const handleModelSelect = useCallback((model: string, dim?: string) => {
    setTab('dashboard')
    setArenaFocus({ model, dim, ts: Date.now() })
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

      {/* 页签：采集监测与情报研究的统一入口 */}
      <nav className="flex items-center gap-1 px-5 pt-4">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-[12px] rounded-md transition-colors ${tab === key ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'}`}
          >
            {locale === 'zh' ? label.zh : label.en}
          </button>
        ))}
        {/* 全看板共享的时间窗：一处切换，信号类视图同时生效 */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted">{locale === 'zh' ? '信号时间窗' : 'Signal window'}</span>
          <div className="flex items-center gap-0.5">
            {SIGNAL_WINDOWS.map(w => (
              <button
                key={w.key}
                onClick={() => setSignalWindow(w.key)}
                className={`px-2 py-1 text-[10px] rounded transition-colors ${
                  signalWindow === w.key ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'
                }`}
              >
                {locale === 'zh' ? w.zh : w.en}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-mono text-dim tabular-nums">
            {windowedSignals.length}{locale === 'zh' ? ' 条' : ''}
          </span>
        </div>
      </nav>

      {tab === 'research' && <ResearchWorkspace />}

      {tab === 'dashboard' && (
        <>
      {/* 关注清单：一行细条，放在地图上方（跨维度的盯盘名单，标记只存本机） */}
      <ShortlistStrip locale={locale} keys={shortlist} onRemove={toggleShortlist} />

      <SectionHeading
        locale={locale}
        zh="态势研判" en="Situation"
        hint="全球据点分布" hintEn="global hub map"
        count={1}
      />

      {/* 首屏：全景 AI Agent 生态地图（高度随视口自适应，不再写死 560px） */}
      <section className="px-5 pt-4">
        <div className="h-[clamp(380px,56vh,680px)]">
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

      <SectionHeading
        locale={locale}
        zh="今日 AI 洞察" en="Today's insights"
        hint="当日研判 + 情报检索（信号 · 厂商 · 模型）" hintEn="daily read + retrieval (signals, vendors, models)"
        actions={
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              {INSIGHT_VIEWS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setInsightsView(key)}
                  className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${insightsView === key ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'}`}
                >
                  {locale === 'zh' ? label.zh : label.en}
                </button>
              ))}
            </div>
            {/* 重新生成只属于研判视图（检索视图不吃这份快照） */}
            {insightsView === 'brief' && (
              <button
                className="panel-btn"
                onClick={() => setInsightsRefresh(n => n + 1)}
                disabled={insightsRefreshing}
                title={locale === 'zh' ? '重新生成洞察' : 'Regenerate insights'}
              >
                {insightsRefreshing ? '…' : '⟳'}
              </button>
            )}
          </div>
        }
      />

      {/* 今日 AI 洞察 = 一个模块两种视图：研判（洞察 + 核心判断）/ 检索（情报浏览器）。
          两个视图都常驻挂载，切走再切回不丢各自的筛选、选中与关注状态。 */}
      <section className="px-5 pt-4">
        <div className={insightsView === 'brief' ? 'grid grid-cols-12 gap-3' : 'hidden'}>
          <div className="col-span-12 lg:col-span-8 min-h-[440px] lg:h-[440px]">
            <InsightsPanel
              bare
              locale={locale}
              signals={windowedSignals}
              onSignalClick={setSelectedSignal}
              onDrillDown={drillToSignals}
              evidence={browseCounts}
              onOpenRetrieval={openRetrieval}
              refreshNonce={insightsRefresh}
              onRefreshingChange={setInsightsRefreshing}
            />
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
        </div>

        {/* 检索视图：信号 / 厂商 / 模型 三个维度，左列表右档案 */}
        <div className={insightsView === 'browse' ? 'h-[clamp(520px,72vh,860px)]' : 'hidden'}>
          <IntelligenceBrowser
            hideTitle
            locale={locale}
            signals={windowedSignals}
            loading={loading}
            error={error}
            searchQuery={searchQuery}
            onSelectSignal={setSelectedSignal}
            shortlist={shortlist}
            onToggleShortlist={toggleShortlist}
            preset={browsePreset}
            onCounts={handleBrowseCounts}
          />
        </div>
      </section>

      <SectionHeading
        locale={locale}
        zh="模型与 Agent 技术" en="Models & Agent tech"
        hint="模型报告、竞技场评分、Agent 工程实践" hintEn="reports, arena scores, agent engineering"
        count={3}
      />

      {/* 中部：模型报告 / 竞技场 / Agent紧箍咒（4+4+4，等高限高）—— 模型类内容前置 */}
      <section className="grid grid-cols-12 gap-3 px-5 pt-4">
        <div className="col-span-12 md:col-span-6 xl:col-span-4" style={{ height: '560px' }}><ModelReportsPanel locale={locale} /></div>
        <div ref={arenaRef} className="col-span-12 md:col-span-6 xl:col-span-4" style={{ height: '560px' }}><ArenaPanel locale={locale} focus={arenaFocus} /></div>
        <div className="col-span-12 md:col-span-6 xl:col-span-4" style={{ height: '560px' }}><ShacklesPanel locale={locale} /></div>
      </section>

      <SectionHeading
        locale={locale}
        zh="开源生态" en="Open source"
        hint="Agent 相关开源项目的活跃度与状态" hintEn="activity and health of agent OSS projects"
        count={1}
      />

      {/* 下部：Agent 开源雷达（全宽 12 列，限高内部滚动） */}
      <section className="px-5 pt-4">
        <div style={{ height: '560px' }}>
          <AgentRadarPanel locale={locale} />
        </div>
      </section>

        </>
      )}

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
