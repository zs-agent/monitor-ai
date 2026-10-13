'use client'

// 关注清单：跨维度的"盯盘名单"，做成看板顶部的一行细条（原来是一个 240px 的面板，占位太重）。
// 空的时候也只占一行提示，不浪费版面。数据存 localStorage（monitor-ai-shortlist）。
import { useMemo } from 'react'
import Link from 'next/link'
import { type Locale } from '@/lib/i18n'
import { useRemoteData } from '@/lib/use-remote-data'
import type { ModelReportItem } from '@/data/model-reports'
import { VENDORS } from '@/lib/vendor-radar'
import { parseShortlistKey } from '@/lib/local-store'

interface ReportsResponse { live?: ModelReportItem[]; curated?: ModelReportItem[] }

interface Props {
  locale: Locale
  keys: string[]
  onRemove: (key: string) => void
}

export default function ShortlistStrip({ locale, keys, onRemove }: Props) {
  const zh = locale === 'zh'
  const { data: reports } = useRemoteData<ReportsResponse>('/api/model-reports', [], { refreshInterval: 15 * 60 * 1000 })

  const items = useMemo(() => {
    const models = [...(reports?.curated ?? []), ...(reports?.live ?? [])]
    return keys.map(key => {
      const { kind, id } = parseShortlistKey(key)
      if (kind === 'vendor') {
        const v = VENDORS.find(x => x.id === id)
        return { key, kind, label: v ? (zh ? v.nameZh : v.name) : id, href: `/entity/vendor/${id}`, color: v?.color }
      }
      if (kind === 'model') {
        const m = models.find(x => x.id === id)
        return { key, kind, label: m ? m.name : id, href: `/entity/model/${encodeURIComponent(id)}`, color: undefined }
      }
      return { key, kind, label: id, href: '', color: undefined }
    })
  }, [keys, reports, zh])

  return (
    <div className="mx-5 mt-3 flex items-center gap-2 rounded-md border border-edge bg-sidebar px-3 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted whitespace-nowrap">
        {zh ? '关注清单' : 'Shortlist'}
      </span>
      {items.length > 0 && (
        <span className="text-[10px] font-mono text-dim tabular-nums shrink-0">{items.length}</span>
      )}
      {items.length === 0 ? (
        <span className="text-[10px] text-dim truncate">
          {zh ? '为空 —— 在「情报检索」里点行尾 ☆ 加入（只存本机）' : 'empty — click ☆ at the end of a row in Intelligence (stored locally)'}
        </span>
      ) : (
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          {items.map(item => (
            <span key={item.key} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-edge max-w-[220px]">
              {item.color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />}
              <Link href={item.href || '/nexus?tab=dashboard'} className="text-ink-2 hover:text-accent truncate transition-colors">
                {item.label}
              </Link>
              <button
                onClick={() => onRemove(item.key)}
                className="text-dim hover:text-[var(--error)] transition-colors shrink-0"
                title={zh ? '移出关注' : 'Remove'}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
