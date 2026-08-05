'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import type { DataFreshnessSummary } from '@/lib/data-freshness'

interface Props {
  locale: Locale
  signals: Signal[]
  freshness: DataFreshnessSummary | null
  /** 数据更新时间 ISO */
  fetchedAt: string | null
  /** live / cached / stale / static / partial / error */
  dataState: string
  onRefresh: () => void
  onSearch: (q: string) => void
  refreshing: boolean
}

function fmtTime(iso: string | null, locale: Locale): string {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  return d.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const STATE_META: Record<string, { en: string; zh: string; cls: string }> = {
  loading: { en: 'LOADING', zh: '加载中', cls: 'bg-[var(--bg-hover)] text-[var(--text-muted)]' },
  live: { en: 'LIVE', zh: '实时', cls: 'bg-[var(--accent-bg)] text-[var(--accent)]' },
  cached: { en: 'CACHED', zh: '缓存', cls: 'bg-[rgba(255,204,0,0.12)] text-[var(--warning)]' },
  stale: { en: 'STALE', zh: '延迟', cls: 'bg-[rgba(245,158,11,0.1)] text-[var(--warning)]' },
  static: { en: 'STATIC', zh: '静态参考', cls: 'bg-[rgba(255,204,0,0.08)] text-[var(--warning)]' },
  partial: { en: 'PARTIAL', zh: '部分可用', cls: 'bg-[rgba(255,204,0,0.12)] text-[var(--warning)]' },
  mock: { en: 'MOCK', zh: '模拟数据', cls: 'bg-[var(--error-bg)] text-[var(--error)]' },
  error: { en: 'ERROR', zh: '异常', cls: 'bg-[var(--error-bg)] text-[var(--error)]' },
}

export default function WorkspaceHeader({ locale, signals, freshness, fetchedAt, dataState, onRefresh, onSearch, refreshing }: Props) {
  const [q, setQ] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const meta = STATE_META[dataState] || STATE_META.error

  // 搜索防抖：输入停止 300ms 后才把查询上抛给父组件，避免每敲一个字就重渲染整个地图
  const handleSearch = (value: string) => {
    setQ(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearch(value), 300)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const kpis = useMemo(() => {
    const papers = signals.filter(s => s.category === 'papers').length
    const models = signals.filter(s => s.category === 'models').length
    const github = signals.filter(s => s.source === 'GitHub').length
    const high = signals.filter(s => s.importance >= 4).length
    return [
      { key: 'total', label: locale === 'zh' ? '信号总数' : 'Signals', value: signals.length, hint: locale === 'zh' ? '过去 24 小时聚合' : 'last 24h aggregated' },
      { key: 'high', label: locale === 'zh' ? '高价值信号' : 'High Value', value: high, hint: locale === 'zh' ? '重要性 ≥ 4' : 'importance ≥ 4' },
      { key: 'papers', label: locale === 'zh' ? '论文' : 'Papers', value: papers, hint: 'arXiv / HF / S2' },
      { key: 'models', label: locale === 'zh' ? '模型动态' : 'Models', value: models, hint: locale === 'zh' ? '发布与更新' : 'releases & updates' },
      { key: 'github', label: locale === 'zh' ? '开源项目' : 'Open Source', value: github, hint: 'GitHub' },
    ]
  }, [signals, locale])

  const freshCount = freshness?.activeSources ?? 0
  const errCount = (freshness?.errorSources ?? 0) + (freshness?.disabledSources ?? 0)

  return (
    <div className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
      {/* 第一行：标题 + 状态 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary)]">
              {locale === 'zh' ? 'AI Agent 情报工作台' : 'AI Agent Intelligence Workbench'}
            </h1>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${meta.cls}`}>{meta.en.toUpperCase()}</span>
          </div>
          <p className="text-[12px] text-[var(--text-muted)] mt-1 max-w-xl">
            {locale === 'zh'
              ? '全景生态 · 开源雷达 · 模型报告 · 竞技场 · 实时资讯 — 面向工程选型与前沿追踪的一站式情报台'
              : 'Ecosystem · OSS radar · model reports · arena · live feed — one-stop intelligence for AI engineers'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap shrink-0">
          {/* 数据更新时间 */}
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            <span>{locale === 'zh' ? '数据更新' : 'Updated'}:</span>
            <span className="font-mono text-[var(--text-secondary)]">{fmtTime(fetchedAt, locale)}</span>
          </div>
          {/* 源状态 */}
          <div className="flex items-center gap-3 text-[11px] bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 py-1.5">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {locale === 'zh' ? '在线' : 'Live'}: {freshCount}
            </span>
            <span className="w-px h-3 bg-[var(--border)]" />
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              {locale === 'zh' ? '异常' : 'Error'}: {errCount}
            </span>
          </div>
          {/* 刷新 */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-colors disabled:opacity-50"
          >
            {refreshing ? (locale === 'zh' ? '刷新中…' : 'Refreshing…') : `↻ ${locale === 'zh' ? '刷新' : 'Refresh'}`}
          </button>
        </div>
      </div>

      {/* 第二行：搜索 + KPI */}
      <div className="flex items-end gap-4 mt-4 flex-wrap">
        {/* 全局搜索：flex-1 吸收剩余空间，避免右侧留白 */}
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3 h-9 focus-within:border-[var(--accent)]/50 transition-colors">
            <span className="text-[13px] text-[var(--text-muted)]">⌕</span>
            <input
              value={q}
              onChange={e => handleSearch(e.target.value)}
              placeholder={locale === 'zh' ? '搜索模型 / 项目 / 论文 / 资讯…' : 'Search models, projects, papers, news…'}
              className="flex-1 bg-transparent outline-none text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            />
            {q && (
              <button onClick={() => { setQ(''); if (debounceRef.current) clearTimeout(debounceRef.current); onSearch('') }} className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)]">×</button>
            )}
          </div>
          <p className="text-[9px] text-[var(--text-dim)] mt-1 px-1">{locale === 'zh' ? '搜索作用于地图信号、侧栏判断与底部资讯时间轴' : 'Filters map signals, sidebar insights and the timeline'}</p>
        </div>

        {/* KPI 组 */}
        <div className="flex items-center gap-2 flex-wrap">
          {kpis.map(k => (
            <div key={k.key} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg px-3.5 py-1.5 min-w-[92px]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">{k.label}</div>
              <div className="text-[18px] font-semibold text-[var(--text-primary)] font-mono leading-tight">{k.value}</div>
              <div className="text-[9px] text-[var(--text-dim)]">{k.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
