'use client'

import { useMemo } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import { LEADERBOARD_INTL, LEADERBOARD_CN } from '@/data/leaderboard'
import { AI_INFRA, AI_STOCKS } from '@/data/ai-stocks'
import PanelBase from './PanelBase'

interface Props { locale: Locale; signals: Signal[] }

/* ───────────────────────────────────────────────
 * 六维雷达图 — 最直观的多维对比方式
 * US（青色）和 CN（琥珀色）多边形叠加，谁更靠外谁领先
 * ─────────────────────────────────────────────── */
const DIMENSIONS = [
  { label: 'Models', zh: '模型', us: 92, cn: 85 },
  { label: 'Funding', zh: '资金', us: 90, cn: 62 },
  { label: 'Patents', zh: '专利', us: 68, cn: 88 },
  { label: 'Talent', zh: '人才', us: 85, cn: 78 },
  { label: 'Infra', zh: '算力', us: 80, cn: 75 },
  { label: 'OpenSrc', zh: '开源', us: 72, cn: 82 },
]

function RadarChart({ locale }: { locale: Locale }) {
  const cx = 130; const cy = 130; const radius = 88
  const n = DIMENSIONS.length
  const maxVal = Math.max(...DIMENSIONS.map(d => Math.max(d.us, d.cn)))

  const getAngle = (i: number) => (i * 2 * Math.PI / n) - Math.PI / 2
  const getPt = (angle: number, r: number) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  })
  const polygonStr = (vals: number[]) =>
    vals.map((v, i) => { const p = getPt(getAngle(i), (v / maxVal) * radius); return `${p.x},${p.y}` }).join(' ')

  // 5 层网格（50~100，间隔 12.5）
  const gridVals = [50, 62.5, 75, 87.5, 100]
  // 标签位置（硬编码更精确）
  const labelCfg = [
    { anchor: 'middle' as const, dy: '-6' },  // i=0: 顶部
    { anchor: 'start' as const,  dy: '1' },   // i=1: 右上
    { anchor: 'start' as const,  dy: '4' },   // i=2: 右下
    { anchor: 'middle' as const, dy: '12' },  // i=3: 底部
    { anchor: 'end' as const,    dy: '4' },   // i=4: 左下
    { anchor: 'end' as const,    dy: '1' },   // i=5: 左上
  ]
  // 差分标记的 dy 偏移（与 labelCfg.dy 对应）
  const deltaDy = (dy: string) => {
    if (dy === '-6') return '-11'   // 顶部
    if (dy === '12') return '14'    // 底部
    return '-10'                    // 两侧
  }

  return (
    <svg viewBox="0 0 260 260" className="h-[250px] w-auto mx-auto" preserveAspectRatio="xMidYMid meet">
      {/* 网格多边形 + 刻度值 */}
      {gridVals.map(level => {
        const pts = Array.from({ length: n }, (_, i) => {
          const p = getPt(getAngle(i), (level / maxVal) * radius)
          return `${p.x},${p.y}`
        }).join(' ')
        return (
          <g key={level}>
            <polygon points={pts} fill="none" stroke="#1e1e2e" strokeWidth={level === 100 ? 0.6 : 0.4} strokeDasharray={level === 100 ? 'none' : '2 2'} />
            {/* 刻度值（放在右上角轴线旁） */}
            <text x={getPt(getAngle(1), (level / maxVal) * radius).x + 4} y={getPt(getAngle(1), (level / maxVal) * radius).y}
              textAnchor="start" dominantBaseline="middle" className="fill-[#3c3c52]" style={{ fontSize: '8px', fontFamily: 'ui-monospace, monospace' }}>
              {level}
            </text>
          </g>
        )
      })}

      {/* 轴线 */}
      {Array.from({ length: n }, (_, i) => {
        const end = getPt(getAngle(i), radius)
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="#1e1e2e" strokeWidth="0.4" />
      })}

      {/* CN 多边形（先画，作为底层） */}
      <polygon points={polygonStr(DIMENSIONS.map(d => d.cn))} fill="rgba(245,158,11,0.12)" stroke="#f59e0b" strokeWidth="1.8" strokeLinejoin="round" />
      {/* US 多边形（后画，覆盖在上面） */}
      <polygon points={polygonStr(DIMENSIONS.map(d => d.us))} fill="rgba(6,182,212,0.12)" stroke="#06b6d4" strokeWidth="1.8" strokeLinejoin="round" />

      {/* 数据点 + 维度标签 */}
      {DIMENSIONS.map((d, i) => {
        const angle = getAngle(i)
        const us = getPt(angle, (d.us / maxVal) * radius)
        const cn = getPt(angle, (d.cn / maxVal) * radius)
        const lbl = getPt(angle, radius + 20)
        const cfg = labelCfg[i]
        const gap = d.us - d.cn
        return (
          <g key={i}>
            {/* US 数据点 */}
            <circle cx={us.x} cy={us.y} r="3.5" fill="#06b6d4" stroke="#0a0a0f" strokeWidth="1" />
            {/* CN 数据点 */}
            <circle cx={cn.x} cy={cn.y} r="3.5" fill="#f59e0b" stroke="#0a0a0f" strokeWidth="1" />
            {/* 维度名 */}
            <text x={lbl.x} y={lbl.y} textAnchor={cfg.anchor} dominantBaseline="middle"
              className="fill-[#8b8ba0]" style={{ fontSize: '11px', fontWeight: 500 }}>
              {locale === 'zh' ? d.zh : d.label}
            </text>
            {/* 领先方标记（在维度名旁） */}
            {gap !== 0 && (
              <text x={lbl.x} y={lbl.y} textAnchor={cfg.anchor} dominantBaseline="middle"
                dy={deltaDy(cfg.dy)}
                className={gap > 0 ? 'fill-[#06b6d4]' : 'fill-[#f59e0b]'}
                style={{ fontSize: '9px', fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                {gap > 0 ? `▲${gap}` : `▼${Math.abs(gap)}`}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/* ───────────────────────────────────────────────
 * 趋势图 — 纯折线 + 面积，去掉重叠柱状图更干净
 * ─────────────────────────────────────────────── */
const TRENDS = [
  { label: 'Q1 2025', usModels: 12, cnModels: 10 },
  { label: 'Q2 2025', usModels: 15, cnModels: 14 },
  { label: 'Q3 2025', usModels: 18, cnModels: 16 },
  { label: 'Q4 2025', usModels: 20, cnModels: 18 },
  { label: 'Q1 2026', usModels: 23, cnModels: 22 },
  { label: 'Q2 2026', usModels: 27, cnModels: 25 },
]

function TrendChart({ locale }: { locale: Locale }) {
  const w = 600; const h = 130; const pad = { top: 14, right: 16, bottom: 22, left: 28 }
  const plotW = w - pad.left - pad.right
  const plotH = h - pad.top - pad.bottom
  const maxV = 30; const minV = 6
  const range = maxV - minV
  const n = TRENDS.length

  const x = (i: number) => pad.left + (i / (n - 1)) * plotW
  const y = (v: number) => pad.top + plotH - ((v - minV) / range) * plotH
  const x0 = x(0); const xn = x(n - 1); const y0 = y(minV)

  const usPts = TRENDS.map((t, i) => `${x(i)},${y(t.usModels)}`).join(' ')
  const cnPts = TRENDS.map((t, i) => `${x(i)},${y(t.cnModels)}`).join(' ')
  const usArea = `${x0},${y0} ${usPts} ${xn},${y0}`
  const cnArea = `${x0},${y0} ${cnPts} ${xn},${y0}`

  const gridLines = [10, 15, 20, 25]

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="usGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.02"/>
        </linearGradient>
        <linearGradient id="cnGrad2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02"/>
        </linearGradient>
        {/* 末端圆点发光滤镜 */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* 网格线 */}
      {gridLines.map(v => (
        <g key={v}>
          <line x1={pad.left} y1={y(v)} x2={w - pad.right} y2={y(v)} stroke="#1e1e2e" strokeWidth="0.5" strokeDasharray="3 3" />
          <text x={pad.left - 5} y={y(v) + 2.5} textAnchor="end" className="fill-[#5c5c72]" style={{ fontSize: '7px', fontFamily: 'ui-monospace, monospace' }}>{v}</text>
        </g>
      ))}

      {/* 面积填充 */}
      <polygon points={usArea} fill="url(#usGrad2)" />
      <polygon points={cnArea} fill="url(#cnGrad2)" />

      {/* 折线 */}
      <polyline points={usPts} fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={cnPts} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* 数据点 */}
      {TRENDS.map((t, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(t.usModels)} r="3" fill="#06b6d4" filter="url(#glow)" />
          <text x={x(i)} y={y(t.usModels) - 6} textAnchor="middle" className="fill-[#06b6d4]" style={{ fontSize: '6px', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{t.usModels}</text>
          <circle cx={x(i)} cy={y(t.cnModels)} r="3" fill="#f59e0b" filter="url(#glow)" />
          <text x={x(i)} y={y(t.cnModels) + 11} textAnchor="middle" className="fill-[#f59e0b]" style={{ fontSize: '6px', fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{t.cnModels}</text>
          {/* X轴标签 — 显示为 '25Q1, 25Q2 ...' */}
          <text x={x(i)} y={h - 3} textAnchor="middle" className="fill-[#5c5c72]" style={{ fontSize: '7px' }}>
            {'\''}{t.label.split(' ')[1].slice(2)}{t.label.split(' ')[0]}
          </text>
        </g>
      ))}

      {/* X轴 */}
      <line x1={pad.left} y1={y0} x2={w - pad.right} y2={y0} stroke="#2a2a3e" strokeWidth="0.5" />
    </svg>
  )
}

/* ───────────────────────────────────────────────
 * 模型排行榜迷你对比
 * ─────────────────────────────────────────────── */
function MiniLeaderboard({ locale }: { locale: Locale }) {
  const topUS = LEADERBOARD_INTL.filter(m => m.country === 'US').slice(0, 3)
  const topCN = LEADERBOARD_CN.slice(0, 3)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5c5c72]">
          {locale === 'zh' ? '模型排行榜' : 'Model Leaderboard'}
        </span>
        <span className="text-[7px] text-[#3c3c52] font-mono">
          {locale === 'zh' ? 'Arena 分数' : 'Arena Score'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {/* US 前三 */}
        <div className="bg-[#0c0c14] rounded-lg p-2 space-y-1.5">
          <div className="flex items-center gap-1 text-[9px] text-[#06b6d4] font-semibold mb-1">
            <span>🇺🇸</span>
            <span>TOP 3</span>
          </div>
          {topUS.map((m, i) => (
            <div key={m.model} className="flex items-center gap-1.5">
              <span className={`text-[7px] font-mono w-3 text-center ${i === 0 ? 'text-[#fbbf24]' : 'text-[#3c3c52]'}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
              </span>
              <span className="text-[8px] text-[#e5e5e5] truncate flex-1">{m.model}</span>
              <span className="text-[8px] font-mono text-[#8b8ba0]">{m.arenaScore}</span>
            </div>
          ))}
        </div>
        {/* CN 前三 */}
        <div className="bg-[#0c0c14] rounded-lg p-2 space-y-1.5">
          <div className="flex items-center gap-1 text-[9px] text-[#f59e0b] font-semibold mb-1">
            <span>🇨🇳</span>
            <span>TOP 3</span>
          </div>
          {topCN.map((m, i) => (
            <div key={m.model} className="flex items-center gap-1.5">
              <span className={`text-[7px] font-mono w-3 text-center ${i === 0 ? 'text-[#fbbf24]' : 'text-[#3c3c52]'}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
              </span>
              <span className="text-[8px] text-[#e5e5e5] truncate flex-1">{m.model}</span>
              <span className="text-[8px] font-mono text-[#8b8ba0]">{m.arenaScore}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────────────────────────────
 * 股票表现迷你对比
 * ─────────────────────────────────────────────── */
function StockMini({ locale }: { locale: Locale }) {
  const usStocks = AI_STOCKS.filter(s => s.market === 'US').slice(0, 4)
  const cnStocks = AI_STOCKS.filter(s => s.market === 'CN').slice(0, 4)

  return (
    <div className="space-y-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5c5c72]">
        {locale === 'zh' ? 'AI 个股表现' : 'AI Stock Performance'}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {/* US */}
        <div className="space-y-1">
          {usStocks.map(s => (
            <div key={s.symbol} className="flex items-center justify-between text-[9px]">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[7px] text-[#5c5c72] font-mono shrink-0">{s.symbol}</span>
                <span className="text-[#e5e5e5] truncate">{locale === 'zh' ? s.nameZh : s.name}</span>
              </div>
              <span className={`font-mono font-semibold shrink-0 ml-1 ${s.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {s.change >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
        {/* CN */}
        <div className="space-y-1">
          {cnStocks.map(s => (
            <div key={s.symbol} className="flex items-center justify-between text-[9px]">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[7px] text-[#5c5c72] font-mono shrink-0">{s.symbol}</span>
                <span className="text-[#e5e5e5] truncate">{locale === 'zh' ? s.nameZh : s.name}</span>
              </div>
              <span className={`font-mono font-semibold shrink-0 ml-1 ${s.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {s.change >= 0 ? '+' : ''}{s.changePct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────────────────────────────
 * 算力对比摘要
 * ─────────────────────────────────────────────── */
function computeGPUStats() {
  // 按国家分类 AI 基础设施
  const usItems = AI_INFRA.filter(i => ['US', 'IA', 'CA', 'OK'].some(k => i.location.includes(k) || i.locationZh.includes(k)))
  // CN: items where location is in China
  const cnItems = AI_INFRA.filter(i => ['Guangdong', 'Hebei', 'Beijing', '广东', '河北', '北京'].some(k => i.location.includes(k) || i.locationZh.includes(k)))
  const usGPUs = usItems.reduce((s, i) => s + i.gpuCount, 0)
  const cnGPUs = cnItems.reduce((s, i) => s + i.gpuCount, 0)
  return { usGPUs, cnGPUs, total: usGPUs + cnGPUs }
}

/* ───────────────────────────────────────────────
 * 主面板
 * ─────────────────────────────────────────────── */
export default function ComparisonPanel({ locale, signals }: Props) {
  const signalsThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000
    return signals.filter(s => new Date(s.publishedAt).getTime() > weekAgo).length
  }, [signals])

  const gpuStats = useMemo(() => computeGPUStats(), [])

  // 计算 Arena 分数差距
  const topUSArena = LEADERBOARD_INTL.filter(m => m.country === 'US' && m.arenaScore != null)[0]?.arenaScore ?? 0
  const topCNArena = LEADERBOARD_CN[0]?.arenaScore ?? 0
  const arenaGap = topUSArena - topCNArena

  return (
    <PanelBase
      id="comparison"
      title={locale === 'zh' ? '中美 AI 实力对比' : 'US vs China AI'}
      dataBadge="static"
      collapsible
    >
      <div className="p-3 overflow-y-auto">
        <div className="text-[9px] text-[#ffcc00] bg-[rgba(255,204,0,0.06)] border border-[rgba(255,204,0,0.12)] rounded px-2 py-1 mb-3">
          <div className="font-semibold mb-0.5">{locale === 'zh' ? '估算数据 · 仅供参考' : 'Estimated data · For reference'}</div>
          <div>{locale === 'zh' ? '来源: Artificial Analysis, SuperCLUE, C-Eval, 公开财报' : 'Sources: Artificial Analysis, SuperCLUE, C-Eval, Public Filings'}</div>
        </div>

        {/* 头部徽章 */}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* ── 左列：六维雷达图 ── */}
          <div className="space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5c5c72]">
                {locale === 'zh' ? '六维雷达' : '6-D Radar'}
              </span>
              <div className="flex items-center gap-2 text-[8px]">
                <span className="flex items-center gap-0.5"><span className="w-2 h-1.5 rounded-full bg-[#06b6d4]" /> US</span>
                <span className="flex items-center gap-0.5"><span className="w-2 h-1.5 rounded-full bg-[#f59e0b]" /> CN</span>
              </div>
            </div>
            {/* 雷达图 */}
            <div className="flex items-center justify-center -mx-2">
              <RadarChart locale={locale} />
            </div>
            {/* 各维度具体分数（紧凑参考行） */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[9px]">
              {DIMENSIONS.map(d => {
                const gap = d.us - d.cn
                const leader = gap > 0 ? 'US' : gap < 0 ? 'CN' : null
                return (
                  <div key={d.label} className="flex items-center gap-1">
                    <span className="text-[#5c5c72] w-7 shrink-0 text-right">{locale === 'zh' ? d.zh : d.label}</span>
                    <span className="text-[#06b6d4] font-mono font-semibold">{d.us}</span>
                    <span className="text-[#3c3c52]">vs</span>
                    <span className="text-[#f59e0b] font-mono font-semibold">{d.cn}</span>
                    {leader && (
                      <span className={`text-[7px] font-mono ${leader === 'US' ? 'text-[#06b6d4]' : 'text-[#f59e0b]'}`}>
                        ( {leader === 'US' ? '+': ''}{gap > 0 ? `+${gap}` : gap})
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {/* AI 个股表现对比 */}
            <StockMini locale={locale} />
          </div>

          {/* ── 右列：趋势图 + 排行榜 ── */}
          <div className="space-y-3">
            {/* 趋势图 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#5c5c72]">
                  {locale === 'zh' ? '模型发布趋势' : 'Model Release Trend'}
                </span>
                <div className="flex items-center gap-2 text-[8px]">
                  <span className="flex items-center gap-0.5"><span className="w-2 h-0.5 rounded-full bg-[#06b6d4]" /> US</span>
                  <span className="flex items-center gap-0.5"><span className="w-2 h-0.5 rounded-full bg-[#f59e0b]" /> CN</span>
                </div>
              </div>
              <TrendChart locale={locale} />
            </div>

            {/* 排行榜迷你对比 */}
            <MiniLeaderboard locale={locale} />
          </div>
        </div>

        {/* ── 底部关键数据卡片 ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#1e1e2e]/50">
          {/* GPU 算力对比 */}
          <div className="bg-[#0c0c14] rounded-lg py-2 px-2 text-center">
            <div className="text-[11px] font-bold text-[#06b6d4]">{(gpuStats.usGPUs / 10000).toFixed(0)}万</div>
            <div className="text-[9px] text-[#5c5c72] mt-0.5">{locale === 'zh' ? '美国 GPU 算力' : 'US GPU Capacity'}</div>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <span className="w-6 h-1 rounded-full bg-[#06b6d4]/30 overflow-hidden">
                <span className="block h-full bg-[#06b6d4] rounded-full" style={{ width: `${(gpuStats.usGPUs / (gpuStats.usGPUs + gpuStats.cnGPUs)) * 100}%` }} />
              </span>
              <span className="text-[8px] text-[#3c3c52]">{((gpuStats.usGPUs / (gpuStats.usGPUs + gpuStats.cnGPUs)) * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="bg-[#0c0c14] rounded-lg py-2 px-2 text-center">
            <div className="text-[11px] font-bold text-[#f59e0b]">{(gpuStats.cnGPUs / 10000).toFixed(0)}万</div>
            <div className="text-[9px] text-[#5c5c72] mt-0.5">{locale === 'zh' ? '中国 GPU 算力' : 'CN GPU Capacity'}</div>
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              <span className="w-6 h-1 rounded-full bg-[#f59e0b]/30 overflow-hidden">
                <span className="block h-full bg-[#f59e0b] rounded-full" style={{ width: `${(gpuStats.cnGPUs / (gpuStats.usGPUs + gpuStats.cnGPUs)) * 100}%` }} />
              </span>
              <span className="text-[8px] text-[#3c3c52]">{((gpuStats.cnGPUs / (gpuStats.usGPUs + gpuStats.cnGPUs)) * 100).toFixed(0)}%</span>
            </div>
          </div>
          {/* Arena 分数差距 */}
          <div className="bg-[#0c0c14] rounded-lg py-2 px-2 text-center">
            <div className="text-[11px] font-bold text-[#e5e5e5]">{topUSArena} vs {topCNArena}</div>
            <div className="text-[9px] text-[#5c5c72] mt-0.5">{locale === 'zh' ? '头部模型 Arena 分数' : 'Top Model Arena Score'}</div>
            <div className="text-[8px] text-[#06b6d4] mt-0.5">
              {locale === 'zh' ? `美国领先 ${arenaGap} 分` : `US leads by ${arenaGap} pts`}
            </div>
          </div>
          {/* 季度增速 */}
          <div className="bg-[#0c0c14] rounded-lg py-2 px-2 text-center">
            <div className="text-[11px] font-bold space-x-2">
              <span className="text-[#06b6d4]">+17%</span>
              <span className="text-[#5c5c72]">|</span>
              <span className="text-[#f59e0b]">+14%</span>
            </div>
            <div className="text-[9px] text-[#5c5c72] mt-0.5">{locale === 'zh' ? '季度增速 US / CN' : 'QoQ Growth US / CN'}</div>
            <div className="text-[8px] text-[#8b8ba0] mt-0.5">
              {locale === 'zh' ? '基于模型发布量' : 'Based on model releases'}
            </div>
          </div>
        </div>
      </div>
    </PanelBase>
  )
}
