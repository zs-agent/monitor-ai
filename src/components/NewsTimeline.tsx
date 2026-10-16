'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import PanelBase from './PanelBase'
import { relativeSignalTime } from '@/lib/browse-data'

interface Props { locale: Locale; signals?: Signal[]; onSignalClick?: (s: Signal) => void; dataState?: 'live' | 'cached' | 'stale' | 'static'; showTabs?: boolean }

const CAT_COLORS: Record<string, string> = {
  models: '#06b6d4', products: '#34d399', industry: '#f59e0b', papers: '#a78bfa', tips: '#5c5c72',
}
const CAT_LABELS: Record<string, { en: string; zh: string }> = {
  models: { en: 'Model', zh: '模型' }, products: { en: 'Product', zh: '产品' },
  industry: { en: 'Industry', zh: '产业' }, papers: { en: 'Paper', zh: '论文' }, tips: { en: 'Tip', zh: '技巧' },
}

// 时间轴分类 tabs（固定，不再随视角变化）
const TABS: { id: string; label_en: string; label_zh: string; filter: (s: Signal) => boolean }[] = [
  { id: 'all', label_en: 'All', label_zh: '全部', filter: () => true },
  { id: 'news', label_en: 'News', label_zh: '新闻', filter: s => s.category !== 'papers' },
  { id: 'papers', label_en: 'Papers', label_zh: '论文', filter: s => s.category === 'papers' },
  { id: 'models', label_en: 'Models', label_zh: '模型', filter: s => s.category === 'models' },
  { id: 'github', label_en: 'GitHub', label_zh: '开源', filter: s => s.source === 'GitHub' },
]


function formatDate(iso: string): string {
  const d = new Date(iso); if (!Number.isFinite(d.getTime())) return '时间未知'; return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

/** 规则化"为什么值得关注"：基于重要性/多源/分类生成，避免纯标题滚动 */
function whyWatch(signal: Signal, locale: Locale): string {
  const parts: string[] = []
  if (signal.importance >= 5) parts.push(locale === 'zh' ? '🔥 极高热度' : '🔥 Very hot')
  else if (signal.importance >= 4) parts.push(locale === 'zh' ? '🔥 高热度' : '🔥 Hot')
  if (signal.sourcesCount > 2) parts.push(locale === 'zh' ? `多源交叉（${signal.sourcesCount} 源）` : `Cross-source ×${signal.sourcesCount}`)
  else if (signal.sourcesCount > 1) parts.push(locale === 'zh' ? '多源交叉' : 'Cross-source')
  if (signal.category === 'models') parts.push(locale === 'zh' ? '模型动态' : 'Model update')
  if (signal.category === 'papers') parts.push(locale === 'zh' ? '论文' : 'Paper')
  if (signal.credibility >= 4) parts.push(locale === 'zh' ? '高可信源' : 'Trusted source')
  return parts.length > 0 ? parts.join(' · ') : (locale === 'zh' ? '常规动态' : 'Regular')
}

function TimelineItem({ signal, catColor, catLabel, isActive, locale, onClick }: {
  signal: Signal; catColor: string; catLabel: { en: string; zh: string }; isActive: boolean; locale: Locale; onClick: () => void
}) {
  return (
    <button type="button" data-timeline-item title={signal.title}
      className={`flex w-full text-left items-start gap-3 py-3 rounded-lg transition-colors cursor-pointer hover:bg-hover group ${isActive ? 'bg-[#06b6d4]/5' : ''}`} onClick={onClick}>
      <span className="relative shrink-0 pt-1.5" style={{ zIndex: 1 }}>
        <span className={`block w-2.5 h-2.5 rounded-full border-2 ${isActive ? 'border-[#06b6d4] bg-[#06b6d4]' : 'border-edge bg-base'}`}
          style={{ borderColor: isActive ? undefined : catColor + '80' }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1 text-[10px]">
          <time dateTime={signal.publishedAt || undefined} className="font-mono text-muted">{formatDate(signal.publishedAt)}</time>
          <span className="text-dim">{relativeSignalTime(signal.publishedAt, locale)}</span>
          <span className="px-1.5 rounded-full border" style={{ color: catColor, borderColor: catColor + '40' }}>{locale === 'zh' ? catLabel.zh : catLabel.en}</span>
        </span>
        <span data-timeline-title className="block text-[13px] leading-relaxed text-ink-2 group-hover:text-accent line-clamp-3 break-words">{signal.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-muted">
          <span>{signal.source}</span>
          {signal.source === 'GitHub' && typeof signal.starsDelta7d === 'number' &&
            <span className="font-mono text-success">+{signal.starsDelta7d.toLocaleString()}/wk</span>}
          <span className="text-dim">{whyWatch(signal, locale)}</span>
        </span>
      </span>
    </button>
  )
}

export default function NewsTimeline({ locale, signals: externalSignals, onSignalClick, dataState = 'live', showTabs = true }: Props) {
  const hasExternal = !!externalSignals
  const tabs = TABS

  // ———— ALL HOOKS FIRST (unconditional) ————
  const [internalSignals, setInternalSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(!hasExternal)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [paused, setPaused] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'all')
  const viewportRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const visibleRef = useRef(true)
  const offsetRef = useRef(0)
  const lastTimeRef = useRef(0)
  const heightsRef = useRef<number[]>([])
  const pausedRef = useRef(false)
  const activeIdxRef = useRef(0)
  const sortedLenRef = useRef(0)
  const fetchedRef = useRef(false)

  // Self-contained data fetch
  useEffect(() => {
    if (hasExternal || fetchedRef.current) return
    fetchedRef.current = true
    const ctrl = new AbortController()
    setLoading(true); setFetchError(null)
    fetch(`/api/signals?locale=${locale}&category=all`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (!ctrl.signal.aborted) { setInternalSignals(d.signals || []); setLoading(false) } })
      .catch(e => { if (e.name !== 'AbortError') { setFetchError(e.message); setLoading(false) } })
    return () => ctrl.abort()
  }, [hasExternal, locale])

  const signals = hasExternal ? externalSignals : internalSignals

  const sorted = useMemo(() => {
    const tabConfig = tabs.find(t => t.id === activeTab) || tabs[0]
    return [...signals]
      .filter(s => s.title?.length > 0 && tabConfig.filter(s))
      .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
      .slice(0, 20)
  }, [signals, activeTab, tabs])

  const newCount = useMemo(() => {
    const h = Date.now() - 3600000; return sorted.filter(s => new Date(s.publishedAt).getTime() > h).length
  }, [sorted])

  useEffect(() => { pausedRef.current = paused || hovered }, [paused, hovered])
  useEffect(() => { activeIdxRef.current = activeIdx }, [activeIdx])
  useEffect(() => { sortedLenRef.current = sorted.length }, [sorted.length])

  const emptyReason = useMemo(() => {
    if (!hasExternal && fetchError)
      return { icon: '⚠', title: locale === 'zh' ? '数据源暂时不可用' : 'Source Unavailable',
        desc: locale === 'zh'
          ? `无法连接到数据源：${fetchError}。系统将在 15 秒后自动重试，你也可以点击下方按钮手动刷新。`
          : `Cannot reach data sources: ${fetchError}. Auto-retry in 15s, or click the button below to retry now.` }
    if (!hasExternal && !fetchError && !loading)
      return { icon: '◇', title: locale === 'zh' ? '等待首批数据到达' : 'Awaiting First Data',
        desc: locale === 'zh'
          ? '系统已启动，正在获取信号数据。首次加载通常需要 3-10 秒，请稍候。'
          : 'System started — fetching initial signal data. This usually takes 3-10 seconds.' }
    if (hasExternal && signals.length === 0)
      return { icon: '◇', title: locale === 'zh' ? '当前数据源暂无 AI 信号' : 'No AI Signals from Sources',
        desc: locale === 'zh'
          ? '当前时间范围或搜索条件下没有匹配的资料，可调整筛选后重试。'
          : 'No records match the current time range or search. Try adjusting filters.' }
    if (sorted.length === 0 && signals.length > 0)
      return { icon: '◇', title: locale === 'zh' ? '当前标签下无信号' : 'No Signals in This Tab',
        desc: locale === 'zh'
          ? `当前标签页（${tabs.find(t => t.id === activeTab)?.label_zh || activeTab}）下无数据。共有 ${signals.length} 条信号在其他分类中。点击上方其他标签页切换。`
          : `No data matches the "${tabs.find(t => t.id === activeTab)?.label_en || activeTab}" tab. ${signals.length} signals exist in other categories; try switching tabs above.` }
    return null
  }, [hasExternal, fetchError, loading, signals.length, sorted.length, locale, tabs, activeTab])

  const handleRefresh = useCallback(() => {
    if (hasExternal) return; fetchedRef.current = false; setFetchError(null); setLoading(true); setInternalSignals([])
    const ctrl = new AbortController()
    fetch(`/api/signals?locale=${locale}&category=all`, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (!ctrl.signal.aborted) { setInternalSignals(d.signals || []); setLoading(false) } })
      .catch(e => { if (e.name !== 'AbortError') { setFetchError(e.message); setLoading(false) } })
  }, [hasExternal, locale])

  const handleClick = useCallback((s: Signal) => { setPaused(true); onSignalClick?.(s) }, [onSignalClick])

  const SPEED = 24
  const measure = useCallback(() => {
    const el = stripRef.current; if (!el) return
    heightsRef.current = Array.from(el.querySelectorAll('[data-tl]')).map(item => (item as HTMLElement).offsetHeight)
  }, [])

  // 动画循环：条件不满足（不可见/暂停/单条）时停止调度，避免空转占 CPU；
  // 恢复时由 startAnimation 重置 lastTimeRef=0，杜绝暂停后 dt 累积导致跳变
  const startAnimation = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    lastTimeRef.current = 0
    const loop = (ts: number) => {
      if (!visibleRef.current || pausedRef.current || sortedLenRef.current <= 1) return
      if (!lastTimeRef.current) lastTimeRef.current = ts
      const dt = (ts - lastTimeRef.current) / 1000
      lastTimeRef.current = ts
      offsetRef.current += SPEED * dt
      const strip = stripRef.current
      if (strip) {
        const allH = heightsRef.current
        if (allH.length > 0) {
          const half = Math.floor(allH.length / 2); const first = allH.slice(0, half); const totalH = first.reduce((a, b) => a + b, 0)
          if (totalH > 0) {
            if (offsetRef.current >= totalH) offsetRef.current -= totalH
            strip.style.transform = `translateY(-${offsetRef.current}px)`
            let acc = 0, idx = 0
            for (let i = 0; i < first.length; i++) { const mid = acc + first[i] * 0.5; if (offsetRef.current > mid && i + 1 < first.length) idx = i + 1; acc += first[i] }
            if (idx !== activeIdxRef.current) setActiveIdx(idx)
          }
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [])

  // 启动/重启：挂载、sorted 变化（tab 切换归零偏移）、paused 恢复
  useEffect(() => {
    offsetRef.current = 0
    activeIdxRef.current = 0
    setActiveIdx(0)
    startAnimation()
  }, [sorted, startAnimation])
  useEffect(() => {
    if (paused && stripRef.current) {
      offsetRef.current = 0
      stripRef.current.style.transform = 'translateY(0px)'
    }
    startAnimation()
  }, [paused, startAnimation])
  useEffect(() => { startAnimation() }, [hovered, startAnimation])
  useEffect(() => { if (viewportRef.current) viewportRef.current.scrollTop = 0 }, [paused])
  useEffect(() => {
    const rafId = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(rafId)
  }, [sorted, paused, measure])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // 不可见时暂停动画，避免持续占用 CPU/内存
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting
      lastTimeRef.current = 0
      if (entry.isIntersecting) startAnimation()
    })
    io.observe(el)
    const onVis = () => {
      visibleRef.current = document.visibilityState === 'visible'
      lastTimeRef.current = 0
      if (document.visibilityState === 'visible') startAnimation()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [sorted.length, startAnimation])

  // ———— RENDER ————
  const showEarlyState = !hasExternal && (!!loading || !!fetchError)
  const needsErrorPanel = showEarlyState || (sorted.length === 0 && emptyReason)

  if (needsErrorPanel) {
    const reason = emptyReason
    return (
      <PanelBase id="news-timeline" title={locale === 'zh' ? 'AI 新闻时间轴' : 'AI News Timeline'}
        dataBadge={fetchError ? 'unavailable' : dataState} loading={showEarlyState && loading} error={showEarlyState ? fetchError : null} onRetry={handleRefresh}>
        {reason && !loading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="text-2xl mb-2 opacity-40">{reason.icon}</span>
            <p className="text-[11px] text-ink font-medium">{reason.title}</p>
            <p className="text-[10px] text-muted mt-1 max-w-xs">{reason.desc}</p>
            {fetchError && <button onClick={handleRefresh} className="mt-3 text-[10px] px-3 py-1 bg-elevated border border-edge-light rounded text-ink-2 hover:text-accent transition-colors">{locale === 'zh' ? '手动刷新' : 'Retry'}</button>}
          </div>
        )}
      </PanelBase>
    )
  }

  return (
    <PanelBase id="news-timeline" title={locale === 'zh' ? 'AI 新闻时间轴' : 'AI News Timeline'} dataBadge={dataState} count={sorted.length} newCount={newCount} className="flex flex-col h-full">
      <div className="flex flex-col min-h-0 select-none flex-1">
        {/* 分类 tabs */}
        {showTabs && tabs.length > 1 && (
          <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-edge">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent-bg text-accent font-medium'
                    : 'text-muted hover:text-ink-2 hover:bg-overlay'
                }`}>
                {locale === 'zh' ? tab.label_zh : tab.label_en}
              </button>
            ))}
          </div>
        )}
        <div ref={viewportRef} data-timeline-viewport role="region" aria-label={locale === 'zh' ? '新闻时间轴列表' : 'News timeline list'} tabIndex={0} className={`flex-1 min-h-0 relative ${paused ? 'overflow-y-auto' : 'overflow-hidden'}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          <div className="absolute top-0 left-0 right-0 h-6 z-10 pointer-events-none" style={{ background: 'linear-gradient(to bottom, var(--bg-card) 0%, transparent 100%)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-6 z-10 pointer-events-none" style={{ background: 'linear-gradient(to top, var(--bg-card) 0%, transparent 100%)' }} />
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-2xl mb-2 opacity-30">◇</span>
              <p className="text-[11px] text-muted">{locale === 'zh' ? '暂无此类信号' : 'No signals in this category'}</p>
              <p className="text-[9px] text-dim mt-1">{locale === 'zh' ? '尝试切换上方标签页查看其他类型' : 'Try switching tabs above'}</p>
            </div>
          ) : (
            <div className="relative py-2 px-3">
              <div className="absolute left-[17px] top-0 bottom-0 w-px bg-hover" />
              <div ref={stripRef} className="will-change-transform" style={{ transform: 'translateY(0px)' }}>
                <div>{sorted.map((signal, i) => (<div key={signal.id} data-tl><TimelineItem signal={signal} catColor={CAT_COLORS[signal.category] || '#5c5c72'} catLabel={CAT_LABELS[signal.category] || { en: '', zh: '' }} isActive={i === activeIdx} locale={locale} onClick={() => handleClick(signal)} /></div>))}</div>
                {/* 循环滚动副本：仅作无缝衔接的视觉重复，点击仍打开真实 signal（不伪造 id） */}
                <div aria-hidden={paused ? undefined : true}>{!paused && sorted.map((signal) => (<div key={`loop-${signal.id}`} data-tl><TimelineItem signal={signal} catColor={CAT_COLORS[signal.category] || '#5c5c72'} catLabel={CAT_LABELS[signal.category] || { en: '', zh: '' }} isActive={false} locale={locale} onClick={() => handleClick(signal)} /></div>))}</div>
              </div>
            </div>
          )}
        </div>
        {sorted.length > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-edge text-[10px] text-muted shrink-0">
            <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${paused ? 'bg-[#f59e0b]' : 'bg-[#06b6d4] animate-pulse-slow'}`} />{paused ? (locale === 'zh' ? '上下滚动查看更多' : 'Scroll to read') : (locale === 'zh' ? '自动滚动中' : 'Auto scrolling')}</span>
            <span className="flex items-center gap-3"><span>{paused ? (locale === 'zh' ? `最近${sorted.length}条` : `Latest ${sorted.length}`) : `${activeIdx + 1} / ${sorted.length}`}</span><button onClick={() => setPaused(p => !p)} className="px-2 py-0.5 text-[9px] rounded border border-edge-light text-ink-2 hover:text-accent hover:border-[#06b6d4]/30 transition-colors">{paused ? (locale === 'zh' ? '自动滚动' : 'Auto scroll') : (locale === 'zh' ? '暂停' : 'Pause')}</button></span>
          </div>
        )}
      </div>
    </PanelBase>
  )
}
