'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { useRemoteData } from '@/lib/use-remote-data'
import PanelBase from './PanelBase'
import CredibilityTag from './CredibilityTag'
import { type ShacklesItem } from '@/data/agent-shackles'

interface Props {
  locale: Locale
}

interface ShacklesResponse {
  state?: string
  fetchedAt?: string
  items?: ShacklesItem[]
  staticItems?: ShacklesItem[]
  account?: string
  note?: string
}

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime()
  const days = Math.floor(d / 86400000)
  if (days < 1) return 'today'
  if (days < 30) return `${days}d ago`
  return new Date(iso).toISOString().slice(0, 10)
}

type Tab = 'all' | 'live' | 'curated'

export default function ShacklesPanel({ locale }: Props) {
  const { data, loading, error, reload } = useRemoteData<ShacklesResponse>('/api/agent-shackles', [], { refreshInterval: 5 * 60 * 1000 })
  const items = useMemo(() => data?.items ?? [], [data])
  const staticItems = useMemo(() => data?.staticItems ?? [], [data])
  const state = data?.state || 'static'
  const fetchedAt = data?.fetchedAt || null
  const account = data?.account || ''
  const [tab, setTab] = useState<Tab>('live')
  const [onlyPriority, setOnlyPriority] = useState(false)

  const allItems = useMemo(() => {
    const liveIds = new Set(items.map(i => i.title))
    const curatedOnly = staticItems.filter(i => !liveIds.has(i.title))
    return [...items, ...curatedOnly].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  }, [items, staticItems])

  const filtered = useMemo(() => {
    const source = tab === 'curated' ? staticItems : tab === 'live' ? items : allItems
    return source
      .filter(i => !onlyPriority || i.priority)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  }, [items, staticItems, allItems, tab, onlyPriority])

  const badge = state === 'live' ? 'live' : state === 'cached' ? 'cached' : 'static'

  return (
    <PanelBase
      id="agent-shackles"
      title={locale === 'zh' ? 'Agent紧箍咒' : 'Agent Shackles'}
      dataBadge={badge}
      dataBadgeDetail={fetchedAt ? fetchedAt.slice(0, 10) : undefined}
      count={allItems.length}
      error={error}
      onRetry={reload}
      className="flex flex-col h-full"
      headerExtra={
        <label className="flex items-center gap-1.5 text-[10px] text-muted cursor-pointer mr-1">
          <input type="checkbox" checked={onlyPriority} onChange={e => setOnlyPriority(e.target.checked)} className="w-2.5 h-2.5 rounded accent-[var(--accent)]" />
          {locale === 'zh' ? '仅优先阅读' : 'Priority only'}
        </label>
      }
    >
      {!error && (
        <div className="flex flex-col min-h-0 flex-1">
          {/* tabs + 说明 */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1.5 border-b border-edge overflow-x-auto">
            {([['all', locale === 'zh' ? '全部' : 'All'], ['live', '微信'], ['curated', 'REF']] as [Tab, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-2 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors ${tab === k ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="px-4 py-1.5 border-b border-edge-60 bg-card-2-50 flex items-center gap-2 flex-wrap text-[10px] text-muted">
            <CredibilityTag level={state === 'static' ? 'low' : 'high'} locale={locale} />
            {state === 'static'
              ? `⚠ ${locale === 'zh' ? '微信抓取暂不可达，显示静态清单' : 'WeChat fetch unavailable — static list'}`
              : `${locale === 'zh' ? '自动抓取' : 'Auto-fetch'}: ${locale === 'zh' ? '微信公众号' : 'WeChat'}` + (account ? `「${account}」` : '') + `${fetchedAt ? ` · ${locale === 'zh' ? '更新' : 'updated'}: ${fetchedAt.slice(0, 10)}` : ''}`}
          </div>

          {/* 列表 */}
          <div className="p-3 overflow-y-auto min-h-0 flex-1 space-y-2">
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-hover rounded-lg animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="text-2xl mb-2 opacity-30">◇</span>
                <p className="text-[12px] text-muted">{locale === 'zh' ? '暂无条目' : 'No items'}</p>
                <p className="text-[10px] text-dim mt-0.5">{locale === 'zh' ? '请配置公众号名或等待抓取恢复' : 'Configure account or wait for fetch recovery'}</p>
              </div>
            ) : filtered.map(i => {
              const isLive = items.some(x => x.title === i.title)
              return (
                <article key={i.id} className="bg-card-2 border border-edge rounded-lg p-3 hover:border-edge-light transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <a href={i.url} target="_blank" rel="noopener noreferrer"
                      className="text-[13px] font-medium text-ink hover:text-accent transition-colors leading-snug line-clamp-2">
                      {i.title}
                    </a>
                    <span className={`text-[9px] px-1 py-px rounded shrink-0 ${isLive ? 'bg-accent-bg text-accent' : 'bg-hover text-muted'}`}>
                      {isLive ? '微信' : 'REF'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-muted">
                    <span className="font-mono">{timeAgo(i.publishedAt)}</span>
                    {i.related.length > 0 && <><span className="w-px h-2.5 bg-edge" /><span>{i.related[0]}</span></>}
                    {i.priority && <span className="text-warning">{locale === 'zh' ? '优先' : 'PRIORITY'}</span>}
                  </div>
                  {i.summary && <p className="text-[11px] text-ink-2 leading-snug mt-1.5 line-clamp-2">{i.summary}</p>}
                  {i.keywords.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {i.keywords.map(k => <span key={k} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-bg text-accent">#{k}</span>)}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </div>
      )}
    </PanelBase>
  )
}
