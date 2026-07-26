'use client'

import { useState, useEffect } from 'react'
import { getAnalyticsSummary, type AnalyticsSummary } from '@/lib/analytics'
import { type Locale } from '@/lib/i18n'
import PanelBase from './PanelBase'

export default function AnalyticsDashboard({ locale }: { locale: Locale }) {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)

  useEffect(() => {
    setSummary(getAnalyticsSummary())
  }, [])

  if (!summary) return null

  return (
    <PanelBase
      id="analytics"
      title={locale === 'zh' ? '访问统计' : 'Analytics'}
      dataBadge="static"
      collapsible
    >
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0c0c14] rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-[#06b6d4]">{summary.today?.pageviews ?? 0}</div>
            <div className="text-[8px] text-[#5c5c72]">{locale === 'zh' ? '今日 PV' : 'Today PV'}</div>
          </div>
          <div className="bg-[#0c0c14] rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-[#06b6d4]">{summary.today?.sessions ?? 0}</div>
            <div className="text-[8px] text-[#5c5c72]">{locale === 'zh' ? '今日访问' : 'Today Visits'}</div>
          </div>
          <div className="bg-[#0c0c14] rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-[#f59e0b]">{summary.dau}</div>
            <div className="text-[8px] text-[#5c5c72]">{locale === 'zh' ? '日均(7天)' : 'Avg DAU (7d)'}</div>
          </div>
        </div>

        {summary.week.length > 1 && (
          <div>
            <div className="text-[9px] text-[#5c5c72] mb-1.5 font-semibold uppercase tracking-[0.08em]">
              {locale === 'zh' ? '近7天趋势' : '7-Day Trend'}
            </div>
            <div className="flex items-end gap-1 h-16">
              {summary.week.slice().reverse().map((day, i) => {
                const maxVal = Math.max(...summary.week.map(d => d.pageviews), 1)
                const height = Math.max((day.pageviews / maxVal) * 100, 8)
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full bg-[#06b6d4]/60 rounded-t"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                      title={`${day.date}: ${day.pageviews} PV`}
                    />
                    <span className="text-[6px] text-[#5c5c72]">{day.date.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[9px] text-[#5c5c72] pt-2 border-t border-[#1e1e2e]/50">
          <span>{locale === 'zh' ? '总页面浏览' : 'Total PV'}: {summary.totalPageviews}</span>
          <span>{locale === 'zh' ? '总交互' : 'Total Interactions'}: {summary.totalInteractions}</span>
        </div>
      </div>
    </PanelBase>
  )
}
