'use client'

import { useMemo } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import PanelBase from './PanelBase'

interface Props { locale: Locale; signals: Signal[] }

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'up') return <span className="text-emerald-400 text-[10px] font-bold">↑</span>
  if (trend === 'down') return <span className="text-rose-400 text-[10px] font-bold">↓</span>
  return <span className="text-[#5c5c72] text-[10px]">→</span>
}

function MiniBar({ values, color, max }: { values: number[]; color: string; max: number }) {
  return (
    <div className="flex items-end gap-px h-4 w-14 shrink-0">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px]"
          style={{ height: `${Math.max((v / max) * 100, 4)}%`, background: color, opacity: 0.3 + (i / values.length) * 0.7 }}
        />
      ))}
    </div>
  )
}

export default function TopSources({ locale, signals }: Props) {
  const sources = useMemo(() => {
    const map = new Map<string, { count: number; trend: number[]; lastCount: number }>()
    const allTime = new Map<string, number>()
    const recent = new Map<string, number>()
    const now = Date.now()
    const lang = signals.filter(s => s.language === locale)

    for (const s of lang) {
      const age = now - new Date(s.publishedAt).getTime()
      const e = map.get(s.source) || { count: 0, trend: [0, 0, 0, 0, 0, 0], lastCount: 0 }
      e.count++
      const bucket = Math.max(0, 5 - Math.floor(age / (10 * 60000)))
      if (bucket >= 0 && bucket < 6) e.trend[bucket]++
      
      allTime.set(s.source, (allTime.get(s.source) || 0) + 1)
      if (age < 30 * 60000) {
        recent.set(s.source, (recent.get(s.source) || 0) + 1)
      }
      map.set(s.source, e)
    }

    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, data]) => {
        const total = allTime.get(name) || data.count
        const recentCount = recent.get(name) || 0
        const prevRecent = data.count - recentCount
        const trend: 'up' | 'down' | 'flat' = recentCount > prevRecent * 0.2 + 2 ? 'up' : recentCount < prevRecent * 0.2 ? 'down' : 'flat'
        return {
          name,
          count: data.count,
          trend: data.trend,
          pct: Math.round((data.count / lang.length) * 100),
          trendDir: trend,
          recentRate: recentCount,
          velocity: Math.round((data.count / Math.max(total, 1)) * 100),
        }
      })
  }, [signals, locale])

  const maxCount = Math.max(...sources.map(s => s.count), 1)
  const maxTrend = Math.max(...sources.flatMap(s => s.trend), 1)

  return (
    <PanelBase
      id="top-sources"
      title={locale === 'zh' ? '活跃信源' : 'TOP SOURCES'}
      dataBadge="live"
      count={sources.reduce((sum, s) => sum + s.count, 0)}
      collapsible
    >
      <div className="space-y-1.5">
        {sources.map((src, i) => (
          <div key={src.name} className="group flex items-center gap-2 py-0.5">
            <span className="text-[9px] text-[#5c5c72] w-4 text-right shrink-0">{i + 1}</span>
            <span className="text-[10px] text-[#8b8ba0] w-16 truncate shrink-0 text-right" title={src.name}>{src.name}</span>
            
            {/* Bar + trend mini-bar */}
            <div className="flex-1 space-y-0.5 min-w-0">
              <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#06b6d4]/50 to-[#06b6d4] rounded-full transition-all duration-500"
                  style={{ width: `${(src.count / maxCount) * 100}%` }}
                />
              </div>
              <MiniBar values={src.trend} color="#06b6d4" max={maxTrend} />
            </div>

            {/* Right side metrics - always visible */}
            <div className="flex items-center gap-0.5 shrink-0">
              <span className="text-[10px] text-[#e5e5e5] font-mono w-5 text-right">{src.count}</span>
              <span className="text-[8px] text-[#5c5c72] w-7 text-right">{src.pct}%</span>
              <TrendArrow trend={src.trendDir} />
              <span className="text-[8px] text-[#5c5c72] w-4 text-right">{src.velocity}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer with column headers */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#1e1e2e]/50 text-[8px] text-[#5c5c72]">
        <span className="w-4 text-right">#</span>
        <span className="w-16 text-right">{locale === 'zh' ? '信源' : 'Source'}</span>
        <span className="flex-1" />
        <span className="w-5 text-right">{locale === 'zh' ? '数' : '#'}</span>
        <span className="w-7 text-right">%</span>
        <span className="w-3 text-center">{locale === 'zh' ? '势' : '⇅'}</span>
        <span className="w-4 text-right">{locale === 'zh' ? '速' : 'vel'}</span>
      </div>
    </PanelBase>
  )
}
