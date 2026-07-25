'use client'

import { useMemo } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import PanelBase from './PanelBase'

interface Props { locale: Locale; signals: Signal[] }

const CATEGORY_COLORS: Record<string, string> = {
  models: 'text-violet-400', products: 'text-cyan-400',
  industry: 'text-amber-400', papers: 'text-emerald-400', tips: 'text-rose-400',
}

export default function TrendingPanel({ locale, signals }: Props) {
  const trending = useMemo(() => {
    return signals
      .filter(s => s.language === locale && s.importance >= 4)
      .sort((a, b) => b.sourcesCount - a.sourcesCount)
      .slice(0, 5)
  }, [signals, locale])

  if (trending.length === 0) return null

  return (
    <PanelBase
      id="trending"
      title={locale === 'zh' ? '热点追踪' : 'TRENDING'}
      severity="medium"
      dataBadge="live"
      count={trending.length}
      collapsible
    >
      <div className="space-y-2">
        {trending.map((s, i) => {
          const rankColor = i === 0 ? 'text-[#f59e0b]' : i === 1 ? 'text-[#8b8ba0]' : i === 2 ? 'text-[#5c5c72]' : 'text-[#3c3c52]'
          const catColor = CATEGORY_COLORS[s.category] || 'text-gray-400'
          return (
            <div key={s.id} className="flex items-start gap-3 group cursor-default">
              <span className={`text-xs font-mono w-4 text-center ${rankColor}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[#e5e5e5] group-hover:text-[#06b6d4] transition-colors line-clamp-1">{s.title}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[9px] ${catColor}`}>{locale === 'zh' ? ({ models: '模型', products: '产品', industry: '产业', papers: '论文', tips: '实战' }[s.category] || s.category) : s.category}</span>
                  <span className="text-[8px] text-[#5c5c72]">●</span>
                  <span className="text-[9px] text-[#5c5c72]">{s.sourcesCount} {locale === 'zh' ? '源' : 'src'}</span>
                  <span className="text-[8px] text-[#5c5c72]">●</span>
                  <span className="text-[9px] text-[#06b6d4]">{s.source}</span>
                </div>
              </div>
              {i < 3 && (
                <span className="shrink-0 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider rounded bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">
                  HOT
                </span>
              )}
            </div>
          )
        })}
      </div>
    </PanelBase>
  )
}
