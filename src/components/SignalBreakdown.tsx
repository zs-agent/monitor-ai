'use client'

import { useMemo } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import PanelBase from './PanelBase'

interface Props { locale: Locale; signals: Signal[] }

const CAT_COLORS: Record<string, string> = {
  models: '#8b5cf6',
  products: '#06b6d4',
  industry: '#f59e0b',
  papers: '#34d399',
  tips: '#f472b6',
}

const CAT_NAMES: Record<string, string> = {
  models: 'Models', products: 'Products', industry: 'Industry', papers: 'Papers', tips: 'Tips',
}

export default function SignalBreakdown({ locale, signals }: Props) {
  const stats = useMemo(() => {
    const lang = signals.filter(s => s.language === locale)
    const catMap = new Map<string, number>()
    const srcMap = new Map<string, number>()
    
    for (const s of lang) {
      catMap.set(s.category, (catMap.get(s.category) || 0) + 1)
      srcMap.set(s.source, (srcMap.get(s.source) || 0) + 1)
    }

    const cats = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])
    const srcs = Array.from(srcMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
    const total = lang.length
    const highImp = lang.filter(s => s.importance >= 4).length
    const avgImp = lang.length > 0 ? (lang.reduce((s, sig) => s + sig.importance, 0) / lang.length).toFixed(1) : '0'

    return { cats, srcs, total, highImp, avgImp }
  }, [signals, locale])

  const maxCat = Math.max(...stats.cats.map(c => c[1]), 1)

  return (
    <PanelBase
      id="signal-breakdown"
      title={locale === 'zh' ? '信号分布' : 'Signal Breakdown'}
      dataBadge="live"
      count={stats.total}
      collapsible
    >
      <div className="space-y-3">
        {/* Category distribution */}
        <div className="space-y-1.5">
          {stats.cats.map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-2">
              <span className="text-[10px] text-[#8b8ba0] w-14 shrink-0">
                {locale === 'zh'
                  ? ({ models: '模型', products: '产品', industry: '产业', papers: '论文', tips: '实战' }[cat] || cat)
                  : CAT_NAMES[cat] || cat}
              </span>
              <div className="flex-1 h-2.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(count / maxCat) * 100}%`, background: CAT_COLORS[cat] || '#555' }}
                />
              </div>
              <span className="text-[10px] text-[#5c5c72] font-mono w-5 text-right">{count}</span>
            </div>
          ))}
        </div>

        {/* Source breakdown */}
        <div className="border-t border-[#1e1e2e]/50 pt-2">
          <div className="text-[8px] text-[#5c5c72] uppercase tracking-wider mb-1.5">
            {locale === 'zh' ? 'Top 信源' : 'Top Sources'}
          </div>
          {stats.srcs.map(([name, count], i) => (
            <div key={name} className="flex items-center justify-between text-[10px] text-[#8b8ba0]">
              <span>{name}</span>
              <span className="font-mono text-[#e5e5e5]">{count}</span>
            </div>
          ))}
        </div>

        {/* Summary stats */}
        <div className="border-t border-[#1e1e2e]/50 pt-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs font-bold text-[#06b6d4]">{stats.total}</div>
              <div className="text-[7px] text-[#5c5c72]">{locale === 'zh' ? '总计' : 'Total'}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-[#f59e0b]">{stats.highImp}</div>
              <div className="text-[7px] text-[#5c5c72]">{locale === 'zh' ? '高重要度' : 'High Imp'}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-[#a78bfa]">{stats.avgImp}</div>
              <div className="text-[7px] text-[#5c5c72]">{locale === 'zh' ? '均分' : 'Avg'}</div>
            </div>
          </div>
        </div>
      </div>
    </PanelBase>
  )
}
