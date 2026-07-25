'use client'

import { useMemo } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import PanelBase from './PanelBase'

interface Props { locale: Locale; signals: Signal[] }

export default function ActivityBar({ locale, signals }: Props) {
  const hourlyData = useMemo(() => {
    const now = Date.now()
    const hours = Array.from({ length: 24 }, (_, i) => {
      const hourStart = now - (23 - i) * 3600000
      const hourEnd = hourStart + 3600000
      return {
        label: new Date(hourStart).getHours().toString().padStart(2, '0') + ':00',
        count: signals.filter(s => {
          const t = new Date(s.publishedAt).getTime()
          return t >= hourStart && t < hourEnd
        }).length,
        isNow: i === 23
      }
    })
    return hours
  }, [signals])

  const maxCount = Math.max(...hourlyData.map(h => h.count), 1)

  return (
    <PanelBase
      id="activity"
      title={locale === 'zh' ? '24h 活动' : '24h Activity'}
      dataBadge="live"
      collapsible
    >
      <div className="flex items-end gap-[3px] h-16">
        {hourlyData.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5">
            <div
              className={`w-full rounded-t-[2px] transition-all duration-300 ${
                h.isNow ? 'bg-[#06b6d4]' : 'bg-[#06b6d4]/30 hover:bg-[#06b6d4]/50'
              } ${h.count > 0 ? 'min-h-[2px]' : ''}`}
              style={{ height: `${Math.max((h.count / maxCount) * 100, h.count > 0 ? 8 : 0)}%` }}
              title={`${h.label}: ${h.count} signals`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[8px] text-[#5c5c72] font-mono">
        <span>{hourlyData[0].label}</span>
        <span>{hourlyData[12].label}</span>
        <span>{hourlyData[23].label}</span>
      </div>
    </PanelBase>
  )
}
