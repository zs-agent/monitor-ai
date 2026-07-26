'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import PanelBase from './PanelBase'

interface Props { locale: Locale; signals: Signal[]; onSignalClick: (s: Signal) => void }

const CAT_COLORS: Record<string, string> = {
  models: '#06b6d4',
  products: '#34d399',
  industry: '#f59e0b',
  papers: '#a78bfa',
  tips: '#5c5c72',
}

const CAT_LABELS: Record<string, { en: string; zh: string }> = {
  models: { en: 'Model', zh: '模型' },
  products: { en: 'Product', zh: '产品' },
  industry: { en: 'Industry', zh: '产业' },
  papers: { en: 'Paper', zh: '论文' },
  tips: { en: 'Tip', zh: '技巧' },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const hours = d.getHours().toString().padStart(2, '0')
  const mins = d.getMinutes().toString().padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${mins}`
}

/** Single timeline item row */
function TimelineItem({
  signal, catColor, catLabel, isActive, locale, onClick,
}: {
  signal: Signal; catColor: string; catLabel: { en: string; zh: string }
  isActive: boolean; locale: Locale; onClick: () => void
}) {
  return (
    <div
      className={`flex items-start gap-3 py-2 px-2 rounded-lg transition-all duration-500 cursor-pointer hover:bg-[#16162a] group ${
        isActive ? 'bg-[#06b6d4]/5' : ''
      }`}
      onClick={onClick}
    >
      {/* Time column */}
      <div className="w-[116px] shrink-0 pt-0.5 text-right">
        <span className={`text-[10px] font-mono transition-colors duration-300 block ${
          isActive ? 'text-[#06b6d4]' : 'text-[#5c5c72]'
        }`}>
          {formatDate(signal.publishedAt)}
        </span>
        <span className="text-[9px] font-mono text-[#3c3c52] block">
          {timeAgo(signal.publishedAt)}
        </span>
      </div>

      {/* Timeline dot */}
      <div className="relative shrink-0 pt-0.5" style={{ zIndex: 1 }}>
        <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-500 ${
          isActive
            ? 'border-[#06b6d4] bg-[#06b6d4] shadow-[0_0_6px_rgba(6,182,212,0.5)]'
            : 'border-[#1e1e2e] bg-[#0a0a0f] group-hover:border-[#06b6d4]/50'
        }`}
          style={{ borderColor: isActive ? undefined : catColor + '40' }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border transition-all duration-500 ${
            isActive
              ? 'bg-[#06b6d4]/15 text-[#06b6d4] border-[#06b6d4]/30'
              : 'bg-transparent text-[#5c5c72] border-transparent'
          }`}
            style={!isActive ? { color: catColor + 'cc', borderColor: catColor + '30' } : undefined}
          >
            {locale === 'zh' ? catLabel.zh : catLabel.en}
          </span>
          {isActive && (
            <span className="text-[9px] font-bold text-[#06b6d4] animate-pulse-slow">● NOW</span>
          )}
        </div>
        <p className={`text-[12px] leading-snug transition-colors duration-500 line-clamp-2 ${
          isActive ? 'text-[#e5e5e5]' : 'text-[#8b8ba0]'
        }`}>
          {signal.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-[#5c5c72]">{signal.source}</span>
          {signal.importance >= 4 && (
            <span className="text-[10px] text-[#f59e0b]">🔥</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NewsTimeline({ locale, signals, onSignalClick }: Props) {
  const sorted = useMemo(() => {
    return [...signals]
      .filter(s => s.title?.length > 0 && s.category !== 'papers')
      .sort((a, b) => {
        const timeA = new Date(a.publishedAt).getTime()
        const timeB = new Date(b.publishedAt).getTime()
        const scoreA = timeA + (a.importance * 30 * 60 * 1000)
        const scoreB = timeB + (b.importance * 30 * 60 * 1000)
        return scoreB - scoreA
      })
      .slice(0, 7)
  }, [signals])

  const [activeIdx, setActiveIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const offsetRef = useRef(0)
  const lastTimeRef = useRef(0)
  const heightsRef = useRef<number[]>([])
  const pausedRef = useRef(false)
  const activeIdxRef = useRef(0)
  const sortedLenRef = useRef(0)

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { activeIdxRef.current = activeIdx }, [activeIdx])
  useEffect(() => { sortedLenRef.current = sorted.length }, [sorted.length])

  const SPEED = 24 // px per second

  // Measure item heights after render
  const measure = useCallback(() => {
    const el = stripRef.current
    if (!el) return
    const items = el.querySelectorAll('[data-tl]')
    heightsRef.current = Array.from(items).map(item => (item as HTMLElement).offsetHeight)
  }, [])

  // RequestAnimationFrame loop: continuously translate strip upward
  const animate = useCallback((ts: number) => {
    if (!pausedRef.current && sortedLenRef.current > 1) {
      if (!lastTimeRef.current) lastTimeRef.current = ts
      const dt = (ts - lastTimeRef.current) / 1000
      lastTimeRef.current = ts

      offsetRef.current += SPEED * dt

      const strip = stripRef.current
      if (strip) {
        const allH = heightsRef.current
        if (allH.length > 0) {
          // allH contains both copies; the first copy is half
          const half = Math.floor(allH.length / 2)
          const first = allH.slice(0, half)
          const totalH = first.reduce((a, b) => a + b, 0)

          if (totalH > 0) {
            // Seamless loop: when first copy fully scrolled past, jump back
            if (offsetRef.current >= totalH) {
              offsetRef.current -= totalH
            }

            strip.style.transform = `translateY(-${offsetRef.current}px)`

            // Determine active: which item's midpoint is closest to offset
            let acc = 0
            let idx = 0
            for (let i = 0; i < first.length; i++) {
              const mid = acc + first[i] * 0.5
              if (offsetRef.current > mid && i + 1 < first.length) idx = i + 1
              acc += first[i]
            }

            if (idx !== activeIdxRef.current) setActiveIdx(idx)
          }
        }
      }
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [])

  // Start/stop loop
  useEffect(() => {
    lastTimeRef.current = 0
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [animate])

  // Re-measure when data changes
  useEffect(() => { requestAnimationFrame(measure) }, [sorted, measure])

  const handleClick = useCallback((s: Signal) => { setPaused(true); onSignalClick(s) }, [onSignalClick])

  const newCount = useMemo(() => {
    const oneHourAgo = Date.now() - 3600000
    return sorted.filter(s => new Date(s.publishedAt).getTime() > oneHourAgo).length
  }, [sorted])

  return (
    <PanelBase
      id="news-timeline"
      title={locale === 'zh' ? 'AI 新闻时间轴' : 'AI News Timeline'}
      dataBadge="live"
      count={sorted.length}
      newCount={newCount}
      className="flex flex-col flex-1"
    >
      <div className="flex flex-col min-h-0 select-none flex-1">
        {/* Viewport: clips the scrolling strip */}
        <div
          className="overflow-hidden flex-1 min-h-0 relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={() => setPaused(true)}
          onTouchEnd={() => setTimeout(() => setPaused(false), 4000)}
        >
          {/* Gradient fade edges */}
          <div className="absolute top-0 left-0 right-0 h-6 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, #12121a 0%, transparent 100%)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-6 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to top, #12121a 0%, transparent 100%)' }} />

          {sorted.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-center">
                <div className="text-2xl text-[#1e1e2e] mb-2">◇</div>
                <p className="text-[11px] text-[#5c5c72]">{locale === 'zh' ? '暂无新闻' : 'No news yet'}</p>
              </div>
            </div>
          ) : (
            <div className="relative py-3 px-4">
              {/* Timeline vertical line */}
              <div className="absolute left-[132px] top-0 bottom-0 w-px bg-[#1e1e2e]" />

              {/* Continuously translated strip */}
              <div ref={stripRef} className="will-change-transform" style={{ transform: 'translateY(0px)' }}>
                {/* First copy */}
                <div>
                  {sorted.map((signal, i) => {
                    const color = CAT_COLORS[signal.category] || '#5c5c72'
                    const catLabel = (CAT_LABELS[signal.category] || { en: '', zh: '' })
                    return (
                      <div key={signal.id} data-tl>
                        <TimelineItem
                          signal={signal}
                          catColor={color}
                          catLabel={catLabel}
                          isActive={i === activeIdx}
                          locale={locale}
                          onClick={() => handleClick(signal)}
                        />
                      </div>
                    )
                  })}
                </div>
                {/* Duplicate copy for seamless loop */}
                <div>
                  {sorted.map((signal, i) => {
                    const color = CAT_COLORS[signal.category] || '#5c5c72'
                    const catLabel = (CAT_LABELS[signal.category] || { en: '', zh: '' })
                    return (
                      <div key={`d-${signal.id}`} data-tl>
                        <TimelineItem
                          signal={signal}
                          catColor={color}
                          catLabel={catLabel}
                          isActive={false}
                          locale={locale}
                          onClick={() => handleClick({...signal, id: signal.id + '-copy'})}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Control bar */}
        {sorted.length > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#1e1e2e] text-[10px] text-[#5c5c72] shrink-0">
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${paused ? 'bg-[#f59e0b]' : 'bg-[#06b6d4] animate-pulse-slow'}`} />
              {paused
                ? (locale === 'zh' ? '已暂停' : 'Paused')
                : (locale === 'zh' ? '持续滚动中' : 'Scrolling')
              }
            </span>
            <span className="flex items-center gap-3">
              <span>{activeIdx + 1} / {sorted.length}</span>
              <button
                onClick={() => setPaused(p => !p)}
                className="px-2 py-0.5 text-[9px] rounded border border-[#2a2a3e] text-[#8b8ba0] hover:text-[#06b6d4] hover:border-[#06b6d4]/30 transition-colors"
              >
                {paused
                  ? (locale === 'zh' ? '▶ 继续' : '▶ Resume')
                  : (locale === 'zh' ? '暂停' : 'Pause')
                }
              </button>
            </span>
          </div>
        )}
      </div>
    </PanelBase>
  )
}
