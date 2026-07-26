'use client'

import { useState, useMemo } from 'react'
import { type Locale } from '@/lib/i18n'
import { AI_STOCKS, type AIStock } from '@/data/ai-stocks'
import PanelBase from './PanelBase'

const SECTOR_ORDER: AIStock['sector'][] = ['chip', 'cloud', 'model', 'infra', 'hardware']

const SECTOR_NAMES: Record<AIStock['sector'], [en: string, zh: string]> = {
  chip: ['Semiconductors', '半导体'],
  cloud: ['Cloud', '云服务'],
  model: ['Models', '大模型'],
  infra: ['Infrastructure', '基础设施'],
  hardware: ['Hardware', '硬件'],
}

const MARKET_STYLE: Record<string, string> = {
  US: 'bg-[#06b6d4]/10 text-[#06b6d4]',
  CN: 'bg-[#f59e0b]/10 text-[#f59e0b]',
  OTHER: 'bg-[#8b8ba0]/10 text-[#8b8ba0]',
}

export default function MarketTickerPanel({ locale }: { locale: Locale }) {
  const [showAll, setShowAll] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<AIStock['sector'], AIStock[]>()
    for (const sector of SECTOR_ORDER) map.set(sector, [])
    for (const stock of AI_STOCKS) {
      map.get(stock.sector)!.push(stock)
    }
    Array.from(map.values()).forEach(stocks => {
      stocks.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    })
    return map
  }, [])

  const flat = useMemo(() => {
    const result: { sector: AIStock['sector']; stock: AIStock }[] = []
    for (const sector of SECTOR_ORDER) {
      const stocks = grouped.get(sector)
      if (!stocks || stocks.length === 0) continue
      for (const stock of stocks) result.push({ sector, stock })
    }
    return result
  }, [grouped])

  const visible = showAll ? flat : flat.slice(0, 8)
  const total = flat.length

  let lastSector: AIStock['sector'] | null = null

  return (
    <PanelBase
      id="market-ticker"
      title={locale === 'zh' ? 'AI 股票行情' : 'AI Stock Ticker'}
      dataBadge="static"
      collapsible
    >
      <div className="overflow-y-auto">
        {visible.map(({ sector, stock }) => {
          const showHeader = sector !== lastSector
          lastSector = sector
          const isPositive = stock.change >= 0
          const name = locale === 'zh' ? stock.nameZh : stock.name

          return (
            <div key={stock.symbol}>
              {showHeader && (
                <div className="sticky top-0 z-10 px-3 pt-2 pb-1 text-[9px] text-[#5c5c72] uppercase tracking-[0.08em] bg-[#12121a]">
                  {locale === 'zh' ? SECTOR_NAMES[sector][1] : SECTOR_NAMES[sector][0]}
                </div>
              )}
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-3 px-3 py-0.5 hover:bg-[#16162a] transition-colors">
                <span className="text-[10px] font-mono text-[#8b8ba0]">{stock.symbol}</span>
                <span className="text-[10px] text-[#e5e5e5] truncate">{name}</span>
                <span className={`text-[10px] font-mono tabular-nums text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stock.market === 'CN' ? '¥' : '$'}{stock.price.toFixed(2)}
                </span>
                <span className={`text-[10px] font-mono tabular-nums text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPositive ? '+' : ''}{stock.changePct.toFixed(2)}%
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${MARKET_STYLE[stock.market]}`}>
                  {stock.market}
                </span>
              </div>
            </div>
          )
        })}
        {!showAll && total > 8 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-left px-3 py-2 text-[10px] text-[#06b6d4] hover:text-[#0891b2] transition-colors"
          >
            {locale === 'zh' ? `查看全部 ${total} →` : `View all ${total} →`}
          </button>
        )}
      </div>
    </PanelBase>
  )
}
