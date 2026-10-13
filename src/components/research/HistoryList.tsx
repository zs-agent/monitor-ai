'use client'

import type { Locale } from '@/lib/i18n'

export interface RunSummary {
  task_id?: number | null
  run_id?: string
  focus?: string | null
  status?: string
  model?: string
  elapsed_sec?: number | null
  created_at?: number | null
  report_chars?: number
  events?: number
  error?: string | null
}

function when(ts?: number | null): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

const STATUS_STYLE: Record<string, { dot: string; zh: string; en: string }> = {
  running: { dot: 'bg-accent animate-pulse-slow', zh: '研究中', en: 'running' },
  done: { dot: 'bg-emerald-400', zh: '已完成', en: 'done' },
  cancelled: { dot: 'bg-slate-400', zh: '已取消', en: 'cancelled' },
  error: { dot: 'bg-red-400', zh: '失败', en: 'failed' },
}

interface Props {
  locale: Locale
  items: RunSummary[]
  activeKey: string | null
  onSelect: (item: RunSummary) => void
}

export default function HistoryList({ locale, items, activeKey, onSelect }: Props) {
  const zh = locale === 'zh'

  if (items.length === 0) {
    return (
      <p className="px-3 py-5 text-[11px] text-muted leading-relaxed">
        {zh
          ? '还没有研究记录。在左侧填写关注方向并开始研究，完成的报告会累积在这里（服务重启也不会丢）。'
          : 'No research yet. Fill a focus on the left and start a run; finished reports accumulate here and survive restarts.'}
      </p>
    )
  }

  return (
    <ul className="flex-1 min-h-0 overflow-y-auto">
      {items.map(item => {
        const key = item.run_id || String(item.task_id)
        const st = STATUS_STYLE[item.status || 'done'] || STATUS_STYLE.done
        const active = activeKey === key
        return (
          <li key={key}>
            <button
              onClick={() => onSelect(item)}
              className={`w-full text-left px-3 py-2.5 border-b border-edge/60 transition-colors ${active ? 'bg-accent-bg' : 'hover:bg-overlay'}`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-[6px] h-[6px] rounded-full shrink-0 ${st.dot}`} aria-hidden />
                <span className={`text-[12px] truncate ${active ? 'text-ink font-medium' : 'text-ink-2'}`}>
                  {item.focus || (zh ? '（无关注方向）' : '(no focus)')}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2.5 pl-[14px] text-[10px] font-mono text-muted tabular-nums">
                <span>{when(item.created_at)}</span>
                <span>{zh ? st.zh : st.en}</span>
                {typeof item.elapsed_sec === 'number' && <span>{Math.round(item.elapsed_sec)}s</span>}
                {!!item.report_chars && <span>{Math.round((item.report_chars || 0) / 100) / 10}k字</span>}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
