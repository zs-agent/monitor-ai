'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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

function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = d.getHours().toString().padStart(2, '0')
  const mins = d.getMinutes().toString().padStart(2, '0')
  return `${month}/${day} ${hours}:${mins}`
}

export default function NewsTimeline({ locale, signals, onSignalClick }: Props) {
  const sorted = useMemo(() => {
    return [...signals]
      .filter(s => s.title?.length > 0)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 20)
  }, [signals])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (paused || sorted.length === 0) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      return
    }
    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => {
        const next = prev + 1
        if (next >= sorted.length) return 0
        return next
      })
    }, 3000)
    return () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null } }
  }, [paused, sorted.length])

  useEffect(() => {
    if (listRef.current) {
      const itemEl = listRef.current.children[currentIndex] as HTMLElement
      if (itemEl) {
        itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [currentIndex])

  const highlightNew = (index: number) => {
    if (sorted.length < 5) return false
    const diff = index - currentIndex
    if (diff === 0) return true
    if (diff < 0) return sorted.length + diff <= 3
    return diff <= 3
  }

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
      <div
        ref={listRef}
        className="overflow-y-auto flex-1 min-h-0"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
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
            <div className="absolute left-[76px] top-0 bottom-0 w-px bg-[#1e1e2e]" />

            {sorted.map((signal, i) => {
              const color = CAT_COLORS[signal.category] || '#5c5c72'
              const catLabel = (CAT_LABELS[signal.category] || { en: '', zh: '' })
              const isNew = highlightNew(i)

              return (
                <div
                  key={signal.id}
                  className={`relative flex items-start gap-3 py-2 px-2 rounded-lg transition-all duration-300 cursor-pointer hover:bg-[#16162a] group ${
                    i === currentIndex ? 'bg-[#06b6d4]/5' : ''
                  }`}
                  onClick={() => onSignalClick(signal)}
                >
                  {/* Time column */}
                  <div className="w-16 shrink-0 pt-0.5 text-right">
                    <span className={`text-[8px] font-mono transition-colors duration-300 block ${
                      i === currentIndex ? 'text-[#06b6d4]' : 'text-[#5c5c72]'
                    }`}>
                      {formatDate(signal.publishedAt, locale)}
                    </span>
                    <span className="text-[7px] font-mono text-[#3c3c52] block">
                      {timeAgo(signal.publishedAt)}
                    </span>
                  </div>

                  {/* Timeline dot */}
                  <div className="relative shrink-0 pt-0.5" style={{ zIndex: 1 }}>
                    <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all duration-300 ${
                      i === currentIndex
                        ? 'border-[#06b6d4] bg-[#06b6d4] shadow-[0_0_6px_rgba(6,182,212,0.5)]'
                        : 'border-[#1e1e2e] bg-[#0a0a0f] group-hover:border-[#06b6d4]/50'
                    }`}
                      style={{ borderColor: i === currentIndex ? undefined : color + '40' }}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full border transition-all duration-300 ${
                        i === currentIndex
                          ? 'bg-[#06b6d4]/15 text-[#06b6d4] border-[#06b6d4]/30'
                          : 'bg-transparent text-[#5c5c72] border-transparent'
                      }`}
                        style={i !== currentIndex ? { color: color + 'cc', borderColor: color + '30' } : undefined}
                      >
                        {locale === 'zh' ? catLabel.zh : catLabel.en}
                      </span>
                      {isNew && (
                        <span className="text-[7px] font-bold text-[#06b6d4] animate-pulse-slow">● NEW</span>
                      )}
                    </div>
                    <p className={`text-[11px] leading-snug transition-colors duration-300 line-clamp-2 ${
                      i === currentIndex ? 'text-[#e5e5e5]' : 'text-[#8b8ba0]'
                    }`}>
                      {signal.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] text-[#5c5c72]">{signal.source}</span>
                      {signal.importance >= 4 && (
                        <span className="text-[8px] text-[#f59e0b]">🔥</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {sorted.length > 5 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-[#1e1e2e] text-[8px] text-[#5c5c72]">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${paused ? 'bg-[#f59e0b]' : 'bg-[#06b6d4] animate-pulse-slow'}`} />
            {paused
              ? (locale === 'zh' ? '已暂停' : 'Paused')
              : (locale === 'zh' ? '自动滚动中' : 'Auto-scrolling')
            }
          </span>
          <span>{currentIndex + 1} / {sorted.length}</span>
        </div>
      )}
    </PanelBase>
  )
}