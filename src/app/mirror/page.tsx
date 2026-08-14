'use client'

import { useState, useEffect } from 'react'
import { getLocale, type Locale } from '@/lib/i18n'
import PageHeader from '@/components/layout/PageHeader'
import IndicatorsPanel from '@/components/IndicatorsPanel'
import InfrastructurePanel from '@/components/InfrastructurePanel'

export default function MirrorPage() {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => { setLocale(getLocale()) }, [])

  return (
    <div className="min-h-full">
      <PageHeader title={locale === 'zh' ? '中美镜像' : 'MIRROR'}
        valueProp={locale === 'zh' ? '中美宏观镜像 — AI 产业指标对比、科技投入、人才与基础设施基准分析' : 'US-China macro mirror — AI industry indicators, R&D investment, talent and infrastructure benchmarks'} />

      <div className="px-4 pb-4 space-y-3">
        <IndicatorsPanel locale={locale} />
        <InfrastructurePanel locale={locale} />
      </div>
    </div>
  )
}
