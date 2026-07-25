'use client'

import { useMemo } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'

interface Props { locale: Locale; signals: Signal[] }

const DIMENSIONS = [
  { label: 'Models', zh: '模型', us: 92, cn: 85 },
  { label: 'Funding', zh: '资金', us: 90, cn: 62 },
  { label: 'Patents', zh: '专利', us: 68, cn: 88 },
  { label: 'Talent', zh: '人才', us: 85, cn: 78 },
  { label: 'Infra', zh: '算力', us: 80, cn: 75 },
  { label: 'OpenSrc', zh: '开源', us: 72, cn: 82 },
]

function BarRow({ label, usVal, cnVal, maxVal }: { label: string; usVal: number; cnVal: number; maxVal: number }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr_auto_1fr] items-center gap-1.5 text-[10px]">
      <span className="text-[#5c5c72]">{label}</span>
      <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
        <div className="h-full bg-[#06b6d4]/80 rounded-full" style={{ width: `${(usVal / maxVal) * 100}%` }} />
      </div>
      <div className="flex items-center gap-1.5 text-[9px]">
        <span className="text-[#06b6d4] font-mono w-6 text-right">{usVal}</span>
        <span className="text-[#5c5c72]">vs</span>
        <span className="text-[#f59e0b] font-mono w-6">{cnVal}</span>
      </div>
      <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
        <div className="h-full bg-[#f59e0b]/80 rounded-full" style={{ width: `${(cnVal / maxVal) * 100}%` }} />
      </div>
    </div>
  )
}

export default function ComparisonPanel({ locale, signals }: Props) {
  const signalsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000
    return signals.filter(s => new Date(s.publishedAt).getTime() > weekAgo).length
  }, [signals])

  const maxVal = Math.max(...DIMENSIONS.map(d => Math.max(d.us, d.cn)))

  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse-slow" />
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b8ba0]">
            {locale === 'zh' ? '中美 AI 实力对比' : 'US vs China AI'}
          </h3>
        </div>
        <span className="text-[9px] text-[#5c5c72]">{signalsThisWeek} {locale === 'zh' ? '条本周信号' : 'signals this week'}</span>
      </div>

      {/* Header badges */}
      <div className="flex items-center gap-4 px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5">
          <span className="text-base">🇺🇸</span>
          <span className="text-xs font-semibold text-[#e5e5e5]">United States</span>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#06b6d4]/10 text-[#06b6d4]">LEAD</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-base">🇨🇳</span>
          <span className="text-xs font-semibold text-[#e5e5e5]">China</span>
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b]">CHASE</span>
        </div>
      </div>

      {/* Combined bar chart */}
      <div className="px-4 pt-2 pb-3 space-y-2">
        <BarRow label={locale === 'zh' ? '模型' : 'Models'} usVal={92} cnVal={85} maxVal={maxVal} />
        <BarRow label={locale === 'zh' ? '资金' : 'Funding'} usVal={90} cnVal={62} maxVal={maxVal} />
        <BarRow label={locale === 'zh' ? '专利' : 'Patents'} usVal={68} cnVal={88} maxVal={maxVal} />
        <BarRow label={locale === 'zh' ? '人才' : 'Talent'} usVal={85} cnVal={78} maxVal={maxVal} />
        <BarRow label={locale === 'zh' ? '算力' : 'Infra'} usVal={80} cnVal={75} maxVal={maxVal} />
        <BarRow label={locale === 'zh' ? '开源' : 'OpenSrc'} usVal={72} cnVal={82} maxVal={maxVal} />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        <div className="bg-[#0c0c14] rounded-lg p-2 text-[9px] text-[#5c5c72] space-y-0.5">
          <div className="flex justify-between"><span>{locale === 'zh' ? '头部公司' : 'Top'}</span><span className="text-[#8b8ba0]">OpenAI, Anthropic, Meta, xAI</span></div>
          <div className="flex justify-between"><span>{locale === 'zh' ? '季度增速' : 'QoQ'}</span><span className="text-emerald-400">+17%</span></div>
        </div>
        <div className="bg-[#0c0c14] rounded-lg p-2 text-[9px] text-[#5c5c72] space-y-0.5">
          <div className="flex justify-between"><span>{locale === 'zh' ? '头部公司' : 'Top'}</span><span className="text-[#8b8ba0]">DeepSeek, 阿里, 腾讯, 智谱</span></div>
          <div className="flex justify-between"><span>{locale === 'zh' ? '季度增速' : 'QoQ'}</span><span className="text-emerald-400">+14%</span></div>
        </div>
      </div>
    </div>
  )
}