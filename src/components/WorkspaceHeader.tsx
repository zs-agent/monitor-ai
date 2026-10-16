'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import type { DataFreshnessSummary, DataSourceState } from '@/lib/data-freshness'
import { useRemoteData } from '@/lib/use-remote-data'
import type { CoverageResponse } from '@/types/coverage'
import { sourceMetaMap } from '@/lib/source-meta'

interface Props {
  locale: Locale
  signals: Signal[]
  freshness: DataFreshnessSummary | null
  /** 各数据源实时状态（HN/HF/GH/S2） */
  sourceStates: DataSourceState[]
  /** 数据更新时间 ISO */
  fetchedAt: string | null
  /** live / cached / stale / static / partial / error */
  dataState: string
  onRefresh: () => void
  onSearch: (q: string) => void
  refreshing: boolean
  /** 综合搜索数据（雷达/竞技场/报告/文章） */
  globalData?: GlobalSearchData
  onSignalClick?: (s: Signal) => void
  onModelSelect?: (model: string, dim?: string) => void
}

function fmtTime(iso: string | null, locale: Locale): string {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  return d.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

const STATE_META: Record<string, { en: string; zh: string; cls: string }> = {
  loading: { en: 'LOADING', zh: '加载中', cls: 'bg-hover text-muted' },  live: { en: 'LIVE', zh: '实时', cls: 'bg-accent-bg text-accent' },
  cached: { en: 'CACHED', zh: '缓存', cls: 'bg-[rgba(255,204,0,0.12)] text-warning' },
  stale: { en: 'STALE', zh: '延迟', cls: 'bg-[rgba(245,158,11,0.1)] text-warning' },
  static: { en: 'STATIC', zh: '静态参考', cls: 'bg-[rgba(255,204,0,0.08)] text-warning' },
  partial: { en: 'PARTIAL', zh: '部分可用', cls: 'bg-[rgba(255,204,0,0.12)] text-warning' },
  mock: { en: 'MOCK', zh: '模拟数据', cls: 'bg-danger-bg text-danger' },
  error: { en: 'ERROR', zh: '异常', cls: 'bg-danger-bg text-danger' },
}

export interface GlobalSearchItem {
  id: string
  name: string
  org?: string
  url?: string
  /** 模型所属竞技场维度（用于点击联动定位） */
  dim?: string
}

export interface GlobalSearchData {
  projects: GlobalSearchItem[]
  models: GlobalSearchItem[]
  reports: GlobalSearchItem[]
  articles: GlobalSearchItem[]
}

const EMPTY_GLOBAL: GlobalSearchData = { projects: [], models: [], reports: [], articles: [] }

export default function WorkspaceHeader({ locale, signals, freshness, sourceStates, fetchedAt, dataState, onRefresh, onSearch, refreshing, globalData = EMPTY_GLOBAL, onSignalClick, onModelSelect }: Props) {
  const { data: coverage, error: coverageError } = useRemoteData<CoverageResponse>('/api/coverage', [], { refreshInterval: 10 * 60 * 1000 })
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)
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
    const high = signals.filter(s => s.importance >= 4).length
    const local = [
      { key: 'total', label: locale === 'zh' ? (dataState === 'mock' ? '样例线索' : '已收录线索') : 'Loaded signals', value: signals.length.toLocaleString(), hint: locale === 'zh' ? '当前加载的资料' : 'Current feed', title: locale === 'zh' ? '下方可查看的资料条数，非全网去重总量' : 'Loaded feed, not a global total', url: undefined as string | undefined },
      { key: 'high', label: locale === 'zh' ? '高价值线索' : 'High value', value: high.toLocaleString(), hint: locale === 'zh' ? '已收录 · 重要性≥4' : 'Loaded · importance ≥4', title: locale === 'zh' ? '当前已收录资料中的高价值条目' : 'High value items in the feed', url: undefined as string | undefined },
    ]
    const labels = { papers: ['AI相关文献', 'AI literature'], models: ['公开模型仓库', 'Public model repos'], projects: ['AI公开项目', 'Public AI repos'] }
    for (const kind of ['papers', 'models', 'projects'] as const) {
      const item = coverage?.totals.find(row => row.kind === kind)
      const stale = !!coverageError || item?.status === 'stale'
      const value = item?.count == null ? '—' : new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(item.count)
      const suffix = stale ? (locale === 'zh' ? ' · 上次记录' : ' · stale') : ''
      local.push({ key: kind, label: labels[kind][locale === 'zh' ? 0 : 1], value: (item?.approximate ? '≈' : '') + value,
        hint: (item?.source || (locale === 'zh' ? '来源索引总量' : 'Source index')) + suffix,
        title: item?.count != null ? item.scope + '\n' + item.count.toLocaleString() + (item.approximate ? '（来源返回不完整结果）' : '') + '\n' + (locale === 'zh' ? '核对时间：' : 'Checked: ') + fmtTime(item.observedAt, locale) + suffix : (locale === 'zh' ? '来源总数暂不可用，等待更新' : 'Source total unavailable'), url: item?.url })
    }
    return local
  }, [signals, locale, coverage, coverageError, dataState])

  const freshCount = freshness?.activeSources ?? 0

  return (
    <div className="px-5 pt-5 pb-4 border-b border-edge">
      {/* 第一行：标题 + 状态 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">
              {locale === 'zh' ? 'AI Agent 情报工作台' : 'AI Agent Intelligence Workbench'}
            </h1>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${meta.cls}`}>{meta.en.toUpperCase()}</span>
          </div>
          <p className="text-[12px] text-muted mt-1 max-w-xl">
            {locale === 'zh'
              ? '全景生态 · 开源雷达 · 模型报告 · 竞技场 · 实时资讯 — 面向工程选型与前沿追踪的一站式情报台'
              : 'Ecosystem · OSS radar · model reports · arena · live feed — one-stop intelligence for AI engineers'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap max-w-full">
          {/* 数据更新时间 */}
          <div className="flex items-center gap-2 text-[11px] text-muted bg-card border border-edge rounded-lg px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            <span>{locale === 'zh' ? '数据更新' : 'Updated'}:</span>
            <span className="font-mono text-ink-2">{fmtTime(fetchedAt, locale)}</span>
          </div>
          {/* 数据源状态（4 源：状态点 + 缩写 + 条目数） */}
          <div className="flex flex-wrap items-center gap-2.5 max-w-full text-[10px] bg-card border border-edge rounded-lg px-3 py-1.5"
            title={locale === 'zh' ? '数据源状态' : 'Source health'}>
            {sourceStates.length === 0 && <span className="text-dim">—</span>}
            {sourceStates.map(s => {
              const ok = s.status === 'fresh' || s.status === 'stale' || s.status === 'very_stale'
              return (
                <span key={s.id} className="flex items-center gap-1" title={s.status === 'no_data' ? s.name + ' · 尚未探测' : `${s.name} · ${s.itemCount} items`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-400' : s.status === 'error' ? 'bg-red-400' : 'bg-dim'}`} />
                  <span className="text-ink-2 font-mono">{sourceMetaMap[s.id]?.short || s.id}</span>
                  <span className="text-dim font-mono">{s.itemCount}</span>
                </span>
              )
            })}
            <span className="w-px h-3 bg-edge" />
            <span className="text-muted">{freshCount}/{freshness?.totalSources ?? 0} {locale === 'zh' ? '在线' : 'live'}</span>
          </div>
          {/* 刷新 */}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-card border border-edge text-ink-2 hover:text-accent hover:border-accent-40 transition-colors disabled:opacity-50"
          >
            {refreshing ? (locale === 'zh' ? '刷新中…' : 'Refreshing…') : `↻ ${locale === 'zh' ? '刷新' : 'Refresh'}`}
          </button>
        </div>
      </div>

      {/* 第二行：搜索 + KPI */}
      <div className="flex items-end gap-4 mt-4 flex-wrap">
        {/* 综合搜索：匹配信号 + 开源项目 + 模型 + 报告 + 文章 */}
        <div className="flex-1 min-w-[240px] relative">
          <div className="flex items-center gap-2 bg-card border border-edge rounded-lg px-3 h-9 focus-within:border-accent-50 transition-colors">
            <span className="text-[13px] text-muted">⌕</span>
            <input
              value={q}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder={locale === 'zh' ? '搜索模型 / 项目 / 论文 / 资讯…' : 'Search models, projects, papers, news…'}
              className="flex-1 bg-transparent outline-none text-[13px] text-ink placeholder:text-muted"
            />
            {q && (
              <button onClick={() => { setQ(''); if (debounceRef.current) clearTimeout(debounceRef.current); onSearch('') }} className="text-[12px] text-muted hover:text-ink-2">×</button>
            )}
          </div>
          <p className="text-[9px] text-dim mt-1 px-1">{locale === 'zh' ? '综合搜索：信号 · 开源项目 · 模型 · 报告 · 文章' : 'Global search: signals · projects · models · reports · articles'}</p>

          {/* 下拉结果 */}
          {q.trim() && focused && (
            <GlobalSearchDropdown q={q.trim()} signals={signals} global={globalData} locale={locale} onSignalClick={onSignalClick} onModelSelect={onModelSelect} onClose={() => setFocused(false)} />
          )}
        </div>

        {/* KPI 组 */}
        <div><div className="flex items-center gap-2 flex-wrap" data-testid="coverage-cards">
          {kpis.map(k => (
            <div key={k.key} title={k.title} className="bg-card border border-edge rounded-lg px-3.5 py-1.5 min-w-[92px]">
              <div className="text-[10px] tracking-wider text-muted">{k.url ? <a href={k.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{k.label} ↗</a> : k.label}</div>
              <div className="text-[18px] font-semibold text-ink font-mono leading-tight">{k.value}</div>
              <div className="text-[9px] text-dim">{k.hint}</div>
            </div>
          ))}
        </div><p className="text-[9px] text-dim mt-1">{locale === 'zh' ? '后三项为各来源索引总量，每6小时核对；口径不同，不相加。悬停查看范围与时间。' : 'Last three: source index totals, checked every 6h. Separate scopes; do not add.'}</p></div>
      </div>
    </div>
  )
}

/** 综合搜索下拉：信号 / 开源项目 / 模型 / 报告 / 文章 */
function GlobalSearchDropdown({ q, signals, global, locale, onSignalClick, onModelSelect, onClose }: {
  q: string
  signals: Signal[]
  global: GlobalSearchData
  locale: Locale
  onSignalClick?: (s: Signal) => void
  onModelSelect?: (model: string, dim?: string) => void
  onClose: () => void
}) {
  const lq = q.toLowerCase()
  const sigHits = signals.filter(s => (s.title + ' ' + s.summary).toLowerCase().includes(lq)).slice(0, 4)
  const projHits = global.projects.filter(p => p.name.toLowerCase().includes(lq)).slice(0, 4)
  const modelHits = global.models.filter(m => (m.name + ' ' + (m.org || '')).toLowerCase().includes(lq)).slice(0, 4)
  const repHits = global.reports.filter(r => r.name.toLowerCase().includes(lq)).slice(0, 4)
  const artHits = global.articles.filter(a => a.name.toLowerCase().includes(lq)).slice(0, 4)
  const total = sigHits.length + projHits.length + modelHits.length + repHits.length + artHits.length

  if (total === 0) {
    return (
      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-edge rounded-lg shadow-xl p-3 text-[11px] text-muted">
        {locale === 'zh' ? '无匹配结果' : 'No matches'}
      </div>
    )
  }

  const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="pt-1 pb-0.5 first:pt-0">
      <div className="px-3 py-0.5 text-[9px] uppercase tracking-wider text-muted">{label}</div>
      {children}
    </div>
  )

  return (
    <div
      className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-edge rounded-lg shadow-xl max-h-[380px] overflow-y-auto py-1"
      onMouseDown={e => e.preventDefault()} // 阻止 mousedown 触发 input blur，避免下拉先消失导致点击丢失
    >
      {sigHits.length > 0 && (
        <Group label={locale === 'zh' ? '信号' : 'Signals'}>
          {sigHits.map(s => (
            <button key={s.id} onClick={() => { onSignalClick?.(s); onClose() }}
              className="w-full text-left px-3 py-1.5 hover:bg-overlay text-[11px] text-ink truncate">
              {s.title}
            </button>
          ))}
        </Group>
      )}
      {projHits.length > 0 && (
        <Group label={locale === 'zh' ? '开源项目' : 'Projects'}>
          {projHits.map(p => (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
              className="block px-3 py-1.5 hover:bg-overlay text-[11px] text-ink truncate">
              {p.name} <span className="text-muted">GitHub ↗</span>
            </a>
          ))}
        </Group>
      )}
      {modelHits.length > 0 && (
        <Group label={locale === 'zh' ? '模型（竞技场）' : 'Models (arena)'}>
          {modelHits.map(m => (
            <button key={m.id} onClick={() => { onModelSelect?.(m.name, m.dim); onClose() }}
              className="w-full text-left px-3 py-1.5 hover:bg-overlay text-[11px] text-ink truncate">
              {m.name} <span className="text-muted">{m.org}</span>
            </button>
          ))}
        </Group>
      )}
      {repHits.length > 0 && (
        <Group label={locale === 'zh' ? '报告 / 论文' : 'Reports / papers'}>
          {repHits.map(r => (
            <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
              className="block px-3 py-1.5 hover:bg-overlay text-[11px] text-ink truncate">
              {r.name} <span className="text-muted">↗</span>
            </a>
          ))}
        </Group>
      )}
      {artHits.length > 0 && (
        <Group label={locale === 'zh' ? '文章（紧箍咒）' : 'Articles'}>
          {artHits.map(a => (
            <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer"
              className="block px-3 py-1.5 hover:bg-overlay text-[11px] text-ink truncate">
              {a.name} <span className="text-muted">↗</span>
            </a>
          ))}
        </Group>
      )}
    </div>
  )
}
