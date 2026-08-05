'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import PanelBase from './PanelBase'

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

function timeAgo(iso: string): string { const d = Date.now() - new Date(iso).getTime(); const m = Math.floor(d / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d` }
function formatDate(iso: string): string {
  const d = new Date(iso); return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

function TimelineItem({ signal, catColor, catLabel, isActive, locale, onClick }: {
  signal: Signal; catColor: string; catLabel: { en: string; zh: string }; isActive: boolean; locale: Locale; onClick: () => void
}) {
  return (
    <div className={`flex items-start gap-3 py-2 px-2 rounded-lg transition-all duration-500 cursor-pointer hover:bg-[#16162a] group ${isActive ? 'bg-[#06b6d4]/5' : ''}`} onClick={onClick}>
      <div className="w-[116px] shrink-0 pt-0.5 text-right">
        <span className={`text-[10px] font-mono transition-colors duration-300 block ${isActive ? 'text-[#06b6d4]' : 'text-[#5c5c72]'}`}>{formatDate(signal.publishedAt)}</span>
        <span className="text-[9px] font-mono text-[#3c3c52] block">{timeAgo(signal.publishedAt)}</span>
      </div>
      <div className="relative shrink-0 pt-0.5" style={{ zIndex: 1 }}>
        <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-500 ${isActive ? 'border-[#06b6d4] bg-[#06b6d4] shadow-[0_0_6px_rgba(6,182,212,0.5)]' : 'border-[#1e1e2e] bg-[#0a0a0f] group-hover:border-[#06b6d4]/50'}`} style={{ borderColor: isActive ? undefined : catColor + '40' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border transition-all duration-500 ${isActive ? 'bg-[#06b6d4]/15 text-[#06b6d4] border-[#06b6d4]/30' : 'bg-transparent text-[#5c5c72] border-transparent'}`} style={!isActive ? { color: catColor + 'cc', borderColor: catColor + '30' } : undefined}>{locale === 'zh' ? catLabel.zh : catLabel.en}</span>
        </div>
        <p className={`text-[12px] leading-snug transition-colors duration-500 line-clamp-2 ${isActive ? 'text-[#e5e5e5]' : 'text-[#8b8ba0]'}`}>{signal.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-[#5c5c72]">{signal.source}</span>
          <span className="text-[9px] text-[#3c3c52]">· {signal.language === 'zh' ? '中文' : 'EN'}</span>
          {signal.importance >= 4 && <span className="text-[10px] text-[#f59e0b]">🔥</span>}
        </div>
      </div>
    </div>
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
  const [paused, setPaused] = useState(false)
  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'all')
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
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 7)
  }, [signals, activeTab, tabs])

  const newCount = useMemo(() => {
    const h = Date.now() - 3600000; return sorted.filter(s => new Date(s.publishedAt).getTime() > h).length
  }, [sorted])

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { activeIdxRef.current = activeIdx }, [activeIdx])
  useEffect(() => { sortedLenRef.current = sorted.length }, [sorted.length])

  const emptyReason = useMemo(() => {
    if (!hasExternal && fetchError)
      return { icon: '⚠', title: locale === 'zh' ? '数据源暂时不可用' : 'Source Unavailable',
        desc: locale === 'zh'
          ? `无法连接到数据源：${fetchError}。系统将在 60 秒后自动重试，你也可以点击下方按钮手动刷新。`
          : `Cannot reach data sources: ${fetchError}. Auto-retry in 60s, or click the button below to retry now.` }
    if (!hasExternal && !fetchError && !loading)
      return { icon: '◇', title: locale === 'zh' ? '等待首批数据到达' : 'Awaiting First Data',
        desc: locale === 'zh'
          ? '系统已启动，正在获取信号数据。首次加载通常需要 3-10 秒，请稍候。'
          : 'System started — fetching initial signal data. This usually takes 3-10 seconds.' }
    if (hasExternal && signals.length === 0)
      return { icon: '◇', title: locale === 'zh' ? '当前数据源暂无 AI 信号' : 'No AI Signals from Sources',
        desc: locale === 'zh'
          ? '4 个数据源（HN/HF/GitHub/S2）均已连接，但过去 24 小时无符合筛选条件的 AI 相关信号。这不是异常——AI 新闻在非工作时间通常较少。'
          : 'All 4 sources (HN/HF/GitHub/S2) are connected but no AI signals match filters in the last 24h. This is normal during low-activity hours.' }
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

  const animate = useCallback((ts: number) => {
    if (visibleRef.current && !pausedRef.current && sortedLenRef.current > 1) {
      if (!lastTimeRef.current) lastTimeRef.current = ts
      const dt = (ts - lastTimeRef.current) / 1000; lastTimeRef.current = ts
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
    }
    rafRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => { lastTimeRef.current = 0; rafRef.current = requestAnimationFrame(animate); return () => cancelAnimationFrame(rafRef.current) }, [animate])
  useEffect(() => { requestAnimationFrame(measure) }, [sorted, measure])

  // 不可见时暂停动画，避免持续占用 CPU/内存
  useEffect(() => {
    const el = stripRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting
      if (!entry.isIntersecting) { lastTimeRef.current = 0 }
    })
    io.observe(el)
    const onVis = () => {
      visibleRef.current = document.visibilityState === 'visible'
      if (!visibleRef.current) lastTimeRef.current = 0
    }
    document.addEventListener('visibilitychange', onVis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [sorted.length])

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
            <p className="text-[11px] text-[#e5e5e5] font-medium">{reason.title}</p>
            <p className="text-[10px] text-[#5c5c72] mt-1 max-w-xs">{reason.desc}</p>
            {fetchError && <button onClick={handleRefresh} className="mt-3 text-[10px] px-3 py-1 bg-[#1a1a2e] border border-[#2a2a3e] rounded text-[#8b8ba0] hover:text-[#06b6d4] transition-colors">{locale === 'zh' ? '手动刷新' : 'Retry'}</button>}
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
          <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-[var(--border)]">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[var(--accent-bg)] text-[var(--accent)] font-medium'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]'
                }`}>
                {locale === 'zh' ? tab.label_zh : tab.label_en}
              </button>
            ))}
          </div>
        )}
        <div className="overflow-hidden flex-1 min-h-0 relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={() => setPaused(true)} onTouchEnd={() => setTimeout(() => setPaused(false), 4000)}>
          <div className="absolute top-0 left-0 right-0 h-6 z-10 pointer-events-none" style={{ background: 'linear-gradient(to bottom, #12121a 0%, transparent 100%)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-6 z-10 pointer-events-none" style={{ background: 'linear-gradient(to top, #12121a 0%, transparent 100%)' }} />
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-2xl mb-2 opacity-30">◇</span>
              <p className="text-[11px] text-[#5c5c72]">{locale === 'zh' ? '暂无此类信号' : 'No signals in this category'}</p>
              <p className="text-[9px] text-[#3c3c52] mt-1">{locale === 'zh' ? '尝试切换上方标签页查看其他类型' : 'Try switching tabs above'}</p>
            </div>
          ) : (
            <div className="relative py-3 px-4">
              <div className="absolute left-[132px] top-0 bottom-0 w-px bg-[#1e1e2e]" />
              <div ref={stripRef} className="will-change-transform" style={{ transform: 'translateY(0px)' }}>
                <div>{sorted.map((signal, i) => (<div key={signal.id} data-tl><TimelineItem signal={signal} catColor={CAT_COLORS[signal.category] || '#5c5c72'} catLabel={CAT_LABELS[signal.category] || { en: '', zh: '' }} isActive={i === activeIdx} locale={locale} onClick={() => handleClick(signal)} /></div>))}</div>
                {/* 循环滚动副本：仅作无缝衔接的视觉重复，点击仍打开真实 signal（不伪造 id） */}
                <div>{sorted.map((signal) => (<div key={`loop-${signal.id}`} data-tl><TimelineItem signal={signal} catColor={CAT_COLORS[signal.category] || '#5c5c72'} catLabel={CAT_LABELS[signal.category] || { en: '', zh: '' }} isActive={false} locale={locale} onClick={() => handleClick(signal)} /></div>))}</div>
              </div>
            </div>
          )}
        </div>
        {sorted.length > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#1e1e2e] text-[10px] text-[#5c5c72] shrink-0">
            <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${paused ? 'bg-[#f59e0b]' : 'bg-[#06b6d4] animate-pulse-slow'}`} />{paused ? (locale === 'zh' ? '已暂停' : 'Paused') : (locale === 'zh' ? '持续滚动中' : 'Scrolling')}</span>
            <span className="flex items-center gap-3"><span>{activeIdx + 1} / {sorted.length}</span><button onClick={() => setPaused(p => !p)} className="px-2 py-0.5 text-[9px] rounded border border-[#2a2a3e] text-[#8b8ba0] hover:text-[#06b6d4] hover:border-[#06b6d4]/30 transition-colors">{paused ? (locale === 'zh' ? '▶ 继续' : '▶ Resume') : (locale === 'zh' ? '暂停' : 'Pause')}</button></span>
          </div>
        )}
      </div>
    </PanelBase>
  )
}
