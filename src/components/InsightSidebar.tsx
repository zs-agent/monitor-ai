'use client'

import { useMemo } from 'react'
import type { Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import type { DataSourceState } from '@/lib/data-freshness'
import NewsTimeline from './NewsTimeline'

interface Props {
  locale: Locale
  signals: Signal[]
  sourceStates: DataSourceState[]
  onSignalClick?: (s: Signal) => void
  searchQuery?: string
  dataState?: 'live' | 'cached' | 'stale' | 'static'
}

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

export default function InsightSidebar({ locale, signals, sourceStates, onSignalClick, searchQuery, dataState = 'live' }: Props) {
  const filtered = useMemo(() => {
    if (!searchQuery) return signals
    const q = searchQuery.toLowerCase()
    return signals.filter(s =>
      s.title.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q) || s.tags?.some(t => t.toLowerCase().includes(q))
    )
  }, [signals, searchQuery])

  const topSignals = useMemo(
    () => [...filtered].sort((a, b) => b.importance - a.importance || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 2),
    [filtered],
  )

  const topTags = useMemo(() => {
    const counts = new Map<string, number>()
    filtered.forEach(s => s.tags?.forEach(t => counts.set(t, (counts.get(t) || 0) + 1)))
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
  }, [filtered])

  const SHORT_SOURCE: Record<string, string> = { hackernews: 'HN', huggingface: 'HF', github: 'GH', semanticscholar: 'S2' }

  /** 分类 → 一句话性质说明（“每条重点关注是干啥的”） */
  const CATEGORY_MEANING: Record<string, { zh: string; en: string }> = {
    models: { zh: '模型发布 / 更新 / 能力变化', en: 'Model release / update / capability' },
    products: { zh: '产品 / 工具发布', en: 'Product / tool launch' },
    industry: { zh: '产业 / 政策 / 市场动态', en: 'Industry / policy / market' },
    papers: { zh: '论文 / 技术报告', en: 'Paper / technical report' },
    tips: { zh: '工程实践 / 教程', en: 'Engineering / tutorial' },
  }

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* 核心判断 + 趋势关键词（压缩合并） */}
      <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden shrink-0">
        <header className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)]">
          <h2 className="text-[12px] font-semibold text-[var(--text-primary)]">{locale === 'zh' ? '重点关注' : 'Focus'}</h2>
          <span className="text-[10px] text-[var(--text-muted)]">{topSignals.length} {locale === 'zh' ? '条重点' : 'top'}</span>
        </header>
        <div className="divide-y divide-[var(--border)]/60">
          {topSignals.length === 0 ? (
            <p className="px-4 py-3 text-[11px] text-[var(--text-muted)]">{locale === 'zh' ? '当前筛选下暂无重点信号' : 'No key signals under current filter'}</p>
          ) : topSignals.map((s, i) => {
            const meaning = CATEGORY_MEANING[s.category] || { zh: s.category, en: s.category }
            return (
            <button key={s.id} onClick={() => onSignalClick?.(s)} className="w-full text-left px-4 py-1.5 hover:bg-[var(--hover-overlay)] transition-colors group">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-bold text-[var(--accent)] font-mono">#{i + 1}</span>
                <span className="text-[9px] px-1.5 py-px rounded-full border border-[var(--border-light)] text-[var(--text-muted)]">{s.category}</span>
                {s.importance >= 4 && <span className="text-[10px]">🔥</span>}
                <span className="ml-auto text-[9px] text-[var(--text-dim)] font-mono">{timeAgo(s.publishedAt)}</span>
              </div>
              <p className="text-[12px] leading-snug text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-1">{s.title}</p>
              {/* 性质说明：这条是干啥的 */}
              <p className="text-[9px] text-[var(--text-muted)] mt-0.5 truncate">
                {locale === 'zh' ? meaning.zh : meaning.en} · {s.source}
              </p>
            </button>
          )})}
        </div>
        {topTags.length > 0 && (
          <div className="flex items-center gap-1 px-4 py-1.5 border-t border-[var(--border)]/50 flex-wrap">
            {topTags.map(([tag, count]) => (
              <span key={tag} className="text-[9px] px-1.5 py-px rounded-full border border-[var(--border)] text-[var(--text-muted)]">
                #{tag} <span className="opacity-50">{count}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 数据源状态（紧凑一行） */}
      <section className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden shrink-0">
        <header className="flex items-center justify-between px-4 py-1.5 border-b border-[var(--border)]">
          <h2 className="text-[12px] font-semibold text-[var(--text-primary)]">{locale === 'zh' ? '数据源状态' : 'Source Health'}</h2>
          <span className="text-[10px] text-[var(--text-muted)]">{sourceStates.filter(s => s.status === 'fresh').length}/{sourceStates.length} {locale === 'zh' ? '在线' : 'live'}</span>
        </header>
        <div className="px-3 py-1.5 flex items-center gap-3 flex-wrap">
          {sourceStates.length === 0 && <span className="text-[10px] text-[var(--text-muted)]">—</span>}
          {sourceStates.map(s => {
            const ok = s.status === 'fresh' || s.status === 'stale' || s.status === 'very_stale'
            return (
              <span key={s.id} className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]" title={s.name}>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                {SHORT_SOURCE[s.id] || s.name}
              </span>
            )
          })}
        </div>
      </section>

      {/* AI 新闻时间轴（替换原“最新变化”，占侧栏剩余空间，动态滚动） */}
      <div className="flex-1 min-h-0">
        <NewsTimeline
          locale={locale}
          signals={filtered}
          dataState={dataState}
          onSignalClick={onSignalClick}
          showTabs={false}
        />
      </div>
    </div>
  )
}
