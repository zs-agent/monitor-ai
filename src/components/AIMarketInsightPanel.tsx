'use client'

import { useState } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import { AI_STOCKS, AI_EVENT_IMPACTS, AI_INFRA } from '@/data/ai-stocks'
import PanelBase from './PanelBase'

interface Props { locale: Locale; signals: Signal[] }

function StockTicker({ locale }: { locale: Locale }) {
  const sectors = [
    { key: 'all', label: 'All', zh: '全部' },
    { key: 'chip', label: 'Chip', zh: '芯片' },
    { key: 'cloud', label: 'Cloud', zh: '云' },
    { key: 'infra', label: 'Infra', zh: '基础设施' },
  ] as const
  const [sector, setSector] = useState<string>('all')
  const filtered = sector === 'all' ? AI_STOCKS : AI_STOCKS.filter(s => s.sector === sector)

  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        {sectors.map(s => (
          <button
            key={s.key}
            onClick={() => setSector(s.key)}
            className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${
              sector === s.key ? 'bg-[#06b6d4]/15 text-[#06b6d4]' : 'text-[#5c5c72] hover:text-[#8b8ba0]'
            }`}
          >
            {locale === 'zh' ? s.zh : s.label}
          </button>
        ))}
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {filtered.map(stock => (
          <div key={stock.symbol} className="flex items-center gap-2 py-0.5 group hover:bg-[#16162a] rounded px-1 transition-colors cursor-default">
            <div className="flex items-center gap-1.5 w-16 shrink-0">
              <span className={`w-1 h-1 rounded-full ${stock.market === 'US' ? 'bg-cyan-400' : 'bg-amber-400'}`} />
              <span className="text-[11px] font-mono text-[#e5e5e5]">{stock.symbol}</span>
            </div>
            <span className="text-[11px] text-[#5c5c72] flex-1 truncate">{locale === 'zh' ? stock.nameZh : stock.name}</span>
            <span className="text-[11px] font-mono text-[#e5e5e5] w-16 text-right">${stock.price.toFixed(2)}</span>
            <span className={`text-[11px] font-mono w-14 text-right ${stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stock.change >= 0 ? '+' : ''}{stock.changePct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EventImpactFeed({ locale }: { locale: Locale }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5c5c72] mb-1">
        {locale === 'zh' ? 'AI 事件 · 市场影响' : 'AI Events · Market Impact'}
      </div>
      {AI_EVENT_IMPACTS.slice(0, 4).map(event => {
        const isExpanded = expanded === event.id
        const impactColor = event.impact === 'positive' ? 'text-emerald-400' : event.impact === 'negative' ? 'text-rose-400' : 'text-[#8b8ba0]'
        const impactLabel = event.impact === 'positive'
          ? (locale === 'zh' ? '利好' : 'Bullish')
          : event.impact === 'negative'
          ? (locale === 'zh' ? '利空' : 'Bearish')
          : (locale === 'zh' ? '中性' : 'Neutral')

        return (
          <div
            key={event.id}
            className="border border-[#1e1e2e] rounded-lg p-2 hover:border-[#2a2a3e] transition-colors cursor-pointer"
            onClick={() => setExpanded(isExpanded ? null : event.id)}
          >
            <div className="flex items-start gap-1.5">
              <span className={`text-[12px] mt-0.5 ${impactColor}`}>
                {event.impact === 'positive' ? '▲' : event.impact === 'negative' ? '▼' : '◆'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-[#e5e5e5] leading-snug line-clamp-2">
                      {locale === 'zh' ? event.titleZh : event.title}
                    </div>
                    {isExpanded && (
                      <div className="mt-1 text-[11px] text-[#8b8ba0] leading-relaxed">
                        {locale === 'zh' ? event.summaryZh : event.summary}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-semibold ${impactColor}`}>{impactLabel}</span>
                      <span className="text-[9px] text-[#5c5c72]">·</span>
                      <span className="text-[10px] text-[#5c5c72]">{event.affectedStocks.join(', ')}</span>
                      <span className="text-[9px] text-[#5c5c72]">·</span>
                      <span className="text-[10px] text-[#5c5c72]">{event.source}</span>
                    </div>
                  </div>
                  <span className="shrink-0 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">
                    HOT
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InfraMini({ locale }: { locale: Locale }) {
  const totalGPU = AI_INFRA.reduce((s, i) => s + i.gpuCount, 0)
  const totalPower = AI_INFRA.reduce((s, i) => s + i.powerMW, 0)

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5c5c72] mb-1.5">
        {locale === 'zh' ? 'AI 基础设施' : 'AI Infrastructure'}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-[#0c0c14] rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-[#06b6d4]">{(totalGPU / 10000).toFixed(0)}万</div>
          <div className="text-[10px] text-[#5c5c72]">{locale === 'zh' ? 'GPU 总量' : 'Total GPUs'}</div>
        </div>
        <div className="bg-[#0c0c14] rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-[#f59e0b]">{totalPower}MW</div>
          <div className="text-[10px] text-[#5c5c72]">{locale === 'zh' ? '总功耗' : 'Total Power'}</div>
        </div>
      </div>
      <div className="space-y-1 max-h-24 overflow-y-auto">
        {AI_INFRA.map(item => (
          <div key={item.id} className="flex items-center gap-2 text-[11px] py-0.5">
            <span className={`w-1 h-1 rounded-full shrink-0 ${item.status === 'operational' ? 'bg-emerald-400' : item.status === 'building' ? 'bg-amber-400' : 'bg-[#5c5c72]'}`} />
            <span className="text-[11px] text-[#8b8ba0] truncate flex-1">{locale === 'zh' ? item.nameZh : item.name}</span>
            <span className="text-[11px] text-emerald-400">{locale === 'zh' ? item.locationZh : item.location}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AIMarketInsightPanel({ locale, signals }: Props) {
  return (
    <PanelBase
      id="ai-market-insight"
      title={locale === 'zh' ? 'AI 市场洞察' : 'AI Market Insight'}
      dataBadge="live"
      collapsible
    >
      <div className="p-3 space-y-3 overflow-y-auto" style={{ maxHeight: '100%' }}>
        <StockTicker locale={locale} />
        <div className="border-t border-[#1e1e2e] pt-2">
          <EventImpactFeed locale={locale} />
        </div>
        <div className="border-t border-[#1e1e2e] pt-2">
          <InfraMini locale={locale} />
        </div>
      </div>
    </PanelBase>
  )
}