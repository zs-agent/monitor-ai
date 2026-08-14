'use client'

import { type Locale } from '@/lib/i18n'
import PanelBase from './PanelBase'

export interface SourceItem {
  id: string
  name: string
  status: 'fresh' | 'stale' | 'very_stale' | 'error' | 'no_data' | 'disabled'
  lastUpdate: number | null
  itemCount: number
}

interface Props {
  locale: Locale
  sources?: SourceItem[]
}

const STATUS_DOT: Record<string, string> = {
  fresh: 'bg-emerald-400',
  stale: 'bg-amber-400',
  very_stale: 'bg-orange-500',
  error: 'bg-red-400',
  no_data: 'bg-slate-400',
  disabled: 'bg-slate-600',
}

const STATUS_LABEL: Record<string, [en: string, zh: string]> = {
  fresh: ['Live', '在线'],
  stale: ['Stale', '延迟'],
  very_stale: ['Very Stale', '严重延迟'],
  error: ['Error', '异常'],
  no_data: ['No Data', '无数据'],
  disabled: ['Disabled', '停用'],
}

function timeSince(ts: number | null): string {
  if (!ts) return 'never'
  const diff = Date.now() - ts
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

export default function SourceHealthPanel({ locale, sources }: Props) {
  const hasData = sources && sources.length > 0

  return (
    <PanelBase
      id="source-health"
      title={locale === 'zh' ? '数据源健康度' : 'Source Health'}
      count={sources?.length}
      collapsible
    >
      <div className="overflow-y-auto">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-8 text-[10px] text-muted">
            <span className="text-[24px] mb-2 opacity-30">◇</span>
            <span>{locale === 'zh' ? '暂无数据源' : 'No data sources'}</span>
          </div>
        ) : (
          sources!.map((source) => (
            <div
              key={source.id}
              className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 px-3 py-1.5 border-b border-edge-50 hover:bg-hover transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[source.status]}`} />
                <span className="text-[10px] text-ink">{source.name}</span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-muted">
                <span>{timeSince(source.lastUpdate)}</span>
                <span className="text-dim">·</span>
                <span>{source.itemCount} items</span>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                source.status === 'fresh' ? 'bg-emerald-400/10 text-emerald-400' :
                source.status === 'stale' ? 'bg-amber-400/10 text-amber-400' :
                source.status === 'error' ? 'bg-red-400/10 text-red-400' :
                'bg-slate-400/10 text-slate-400'
              }`}>
                {locale === 'zh' ? STATUS_LABEL[source.status][1] : STATUS_LABEL[source.status][0]}
              </span>
            </div>
          ))
        )}
      </div>
    </PanelBase>
  )
}
