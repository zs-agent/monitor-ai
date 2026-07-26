'use client'

import { useMemo } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import PanelBase from './PanelBase'

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

const TRENDS = [
  { label: 'Q1 2025', usModels: 12, cnModels: 10 },
  { label: 'Q2 2025', usModels: 15, cnModels: 14 },
  { label: 'Q3 2025', usModels: 18, cnModels: 16 },
  { label: 'Q4 2025', usModels: 20, cnModels: 18 },
  { label: 'Q1 2026', usModels: 23, cnModels: 22 },
  { label: 'Q2 2026', usModels: 27, cnModels: 25 },
]

function TrendChart({ locale }: { locale: Locale }) {
  const w = 600; const h = 120; const pad = { top: 12, right: 16, bottom: 20, left: 24 }
  const plotW = w - pad.left - pad.right
  const plotH = h - pad.top - pad.bottom
  const maxV = 28; const minV = 6
  const range = maxV - minV
  const n = TRENDS.length
  const barW = plotW / n / 2.5

  const x = (i: number) => pad.left + (i / (n - 1)) * plotW
  const y = (v: number) => pad.top + plotH - ((v - minV) / range) * plotH

  const usPts = TRENDS.map((t, i) => `${x(i)},${y(t.usModels)}`).join(' ')
  const cnPts = TRENDS.map((t, i) => `${x(i)},${y(t.cnModels)}`).join(' ')
  const usArea = `${x(0)},${y(minV)} ${usPts} ${x(n - 1)},${y(minV)}`
  const cnArea = `${x(0)},${y(minV)} ${cnPts} ${x(n - 1)},${y(minV)}`

  const gridLines = [10, 15, 20, 25]

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="usGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02"/>
        </linearGradient>
        <linearGradient id="cnGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02"/>
        </linearGradient>
      </defs>

      {gridLines.map(v => (
        <g key={v}>
          <line x1={pad.left} y1={y(v)} x2={w - pad.right} y2={y(v)} stroke="#1e1e2e" strokeWidth="0.5" strokeDasharray="3 3" />
          <text x={pad.left - 4} y={y(v) + 3} textAnchor="end" className="fill-[#5c5c72]" style={{ fontSize: '7px' }}>{v}</text>
        </g>
      ))}

      <polygon points={usArea} fill="url(#usGrad)" />
      <polygon points={cnArea} fill="url(#cnGrad)" />

      <polyline points={usPts} fill="none" stroke="#06b6d4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={cnPts} fill="none" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />

      {TRENDS.map((t, i) => {
        const bx = x(i) - barW * 1.5
        const gap = barW * 0.3
        const usBarW = barW
        const cnBarW = barW
        const usH = ((t.usModels - minV) / range) * plotH
        const cnH = ((t.cnModels - minV) / range) * plotH
        const baseY = y(minV)
        return (
          <g key={i}>
            <rect x={bx} y={baseY - usH} width={usBarW} height={usH} rx="1.5" fill="#06b6d4" opacity="0.7" />
            <rect x={bx + usBarW + gap} y={baseY - cnH} width={cnBarW} height={cnH} rx="1.5" fill="#f59e0b" opacity="0.7" />
            <text x={bx + usBarW / 2} y={baseY - usH - 4} textAnchor="middle" className="fill-[#06b6d4]" style={{ fontSize: '6px', fontWeight: 600 }}>{t.usModels}</text>
            <text x={bx + usBarW + gap + cnBarW / 2} y={baseY - cnH - 4} textAnchor="middle" className="fill-[#f59e0b]" style={{ fontSize: '6px', fontWeight: 600 }}>{t.cnModels}</text>
            <text x={bx + barW + gap / 2} y={h - 3} textAnchor="middle" className="fill-[#5c5c72]" style={{ fontSize: '7px' }}>{t.label.slice(3)}</text>
          </g>
        )
      })}

      <line x1={pad.left} y1={y(minV)} x2={w - pad.right} y2={y(minV)} stroke="#2a2a3e" strokeWidth="0.5" />
    </svg>
  )
}

export default function ComparisonPanel({ locale, signals }: Props) {
  const signalsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000
    return signals.filter(s => new Date(s.publishedAt).getTime() > weekAgo).length
  }, [signals])

  const maxVal = Math.max(...DIMENSIONS.map(d => Math.max(d.us, d.cn)))

  return (
    <PanelBase
      id="comparison"
      title={locale === 'zh' ? '中美 AI 实力对比' : 'US vs China AI'}
      dataBadge="static"
      collapsible
    >
      <div className="p-3 overflow-y-auto">
        <div className="text-[9px] text-[#ffcc00] bg-[rgba(255,204,0,0.06)] border border-[rgba(255,204,0,0.12)] rounded px-2 py-1 mb-3">
          {locale === 'zh' ? '基于公开数据的估算' : 'Estimates based on public data'}
        </div>
        {/* Header badges */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <span className="text-base">🇺🇸</span>
            <span className="text-xs font-semibold text-[#e5e5e5]">United States</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#06b6d4]/10 text-[#06b6d4]">LEAD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base">🇨🇳</span>
            <span className="text-xs font-semibold text-[#e5e5e5]">China</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f59e0b]/10 text-[#f59e0b]">CHASE</span>
          </div>
          <span className="ml-auto text-[9px] text-[#5c5c72]">{signalsThisWeek} {locale === 'zh' ? '条本周信号' : 'signals this week'}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Left: Dimension bars + Info cards */}
          <div className="space-y-3">
            <div className="space-y-2">
              <BarRow label={locale === 'zh' ? '模型' : 'Models'} usVal={92} cnVal={85} maxVal={maxVal} />
              <BarRow label={locale === 'zh' ? '资金' : 'Funding'} usVal={90} cnVal={62} maxVal={maxVal} />
              <BarRow label={locale === 'zh' ? '专利' : 'Patents'} usVal={68} cnVal={88} maxVal={maxVal} />
              <BarRow label={locale === 'zh' ? '人才' : 'Talent'} usVal={85} cnVal={78} maxVal={maxVal} />
              <BarRow label={locale === 'zh' ? '算力' : 'Infra'} usVal={80} cnVal={75} maxVal={maxVal} />
              <BarRow label={locale === 'zh' ? '开源' : 'OpenSrc'} usVal={72} cnVal={82} maxVal={maxVal} />
            </div>
            <div className="grid grid-cols-2 gap-2">
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

          {/* Right: Trend chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5c5c72]">
                {locale === 'zh' ? '2025 Q1 — 2026 Q2' : '2025 Q1 — 2026 Q2'}
              </span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded-full bg-[#06b6d4]" />US</span>
                <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded-full bg-[#f59e0b]" />CN</span>
              </div>
            </div>
            <TrendChart locale={locale} />
            <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#1e1e2e]/50">
              <div className="text-center bg-[#0c0c14] rounded-lg py-2">
                <div className="text-xs font-bold text-[#06b6d4]">+125%</div>
                <div className="text-[10px] text-[#5c5c72] mt-0.5">{locale === 'zh' ? '美国增速' : 'US 1.5yr Growth'}</div>
              </div>
              <div className="text-center bg-[#0c0c14] rounded-lg py-2">
                <div className="text-xs font-bold text-[#f59e0b]">+150%</div>
                <div className="text-[10px] text-[#5c5c72] mt-0.5">{locale === 'zh' ? '中国增速' : 'CN 1.5yr Growth'}</div>
              </div>
              <div className="text-center bg-[#0c0c14] rounded-lg py-2">
                <div className="text-xs font-bold text-[#e5e5e5]">27</div>
                <div className="text-[10px] text-[#5c5c72] mt-0.5">{locale === 'zh' ? '美国 Q2\'26' : 'US Q2 2026'}</div>
              </div>
              <div className="text-center bg-[#0c0c14] rounded-lg py-2">
                <div className="text-xs font-bold text-[#e5e5e5]">25</div>
                <div className="text-[10px] text-[#5c5c72] mt-0.5">{locale === 'zh' ? '中国 Q2\'26' : 'CN Q2 2026'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PanelBase>
  )
}