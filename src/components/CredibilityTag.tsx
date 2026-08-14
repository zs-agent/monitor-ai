'use client'

import type { Locale } from '@/lib/i18n'

export type Credibility = 'high' | 'medium' | 'low'

/** 数据源可信度/时效统一标识：官方接口（高）· 抓取（中）· 静态快照（低） */
export default function CredibilityTag({ level, locale, className = '' }: { level: Credibility; locale: Locale; className?: string }) {
  const map: Record<Credibility, { zh: string; en: string; cls: string }> = {
    high: { zh: '官方接口', en: 'Official API', cls: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/30' },
    medium: { zh: '抓取', en: 'Scraped', cls: 'bg-amber-400/10 text-amber-400 border-amber-400/30' },
    low: { zh: '静态快照', en: 'Snapshot', cls: 'bg-slate-400/10 text-slate-400 border-slate-400/30' },
  }
  const m = map[level]
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-px rounded border ${m.cls} ${className}`}>
      <span className="w-1 h-1 rounded-full bg-current" />
      {locale === 'zh' ? m.zh : m.en}
    </span>
  )
}
