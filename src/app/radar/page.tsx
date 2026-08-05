'use client'

import { useState, useEffect } from 'react'
import { getLocale, type Locale } from '@/lib/i18n'
import PageHeader from '@/components/layout/PageHeader'
import CompanyRadar from '@/components/CompanyRadar'
import InfrastructurePanel from '@/components/InfrastructurePanel'
import DashboardMap from '@/components/DashboardMap'
import MonitorPanel from '@/components/MonitorPanel'
import type { Signal } from '@/types/signal'

export default function RadarPage() {
  const [locale, setLocale] = useState<Locale>('en')
  const [signals, setSignals] = useState<Signal[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setLocale(getLocale()) }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`/api/signals?locale=${getLocale()}&category=all`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setSignals(d.signals || []))
      .catch(e => setError(e.message))
    return () => ctrl.abort()
  }, [])

  return (
    <div className="min-h-full">
      <PageHeader title={locale === 'zh' ? '产业雷达' : 'RADAR'}
        valueProp={locale === 'zh' ? 'AI 产业雷达 — 企业动态、市场趋势与基础设施全景' : 'AI industry radar — company profiles, market trends, infrastructure overview'} />

      {error && (
        <div className="mx-4 mb-4 text-[11px] text-[var(--error)] bg-[var(--bg-card)] rounded p-3 border border-[var(--border)]">
          {locale === 'zh' ? '信号数据加载失败' : 'Signal load failed'}: {error}
        </div>
      )}

      <div className="px-4 pb-4 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3">
          <DashboardMap locale={locale} signals={signals} />
          <CompanyRadar locale={locale} signals={signals} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <InfrastructurePanel locale={locale} />
          <MonitorPanel signals={signals} locale={locale} />
        </div>
      </div>
    </div>
  )
}
