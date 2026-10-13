'use client'

import type { Locale } from '@/lib/i18n'
import { renderMarkdown } from '@/lib/markdown'

export interface ReportMeta {
  focus?: string | null
  model?: string
  elapsedSec?: number | null
  events?: number
  signals?: number
  finishedAt?: number | null
}

interface Props {
  locale: Locale
  status: string
  report: string | null
  meta: ReportMeta
  error?: string | null
}

export default function ReportView({ locale, status, report, meta, error }: Props) {
  const zh = locale === 'zh'

  // 取消不是失败：error 字段里也记着"已被用户取消"，这里必须排在 error 之前
  if (status === 'cancelled' && !report) {
    return (
      <div className="px-4 py-6">
        <p className="text-[12px] font-semibold text-ink-2">{zh ? '这次研究已被取消' : 'This run was cancelled'}</p>
        <p className="mt-2 text-[11px] text-muted leading-relaxed">
          {zh
            ? '中途停止不会有报告产出；已经发出的模型调用不会退费。要的话直接重新发起一次研究即可，取消记录会留在左侧报告库里。'
            : 'A cancelled run produces no report; already-issued model calls are not refunded. Start a new run when ready — the cancelled record stays in the report library.'}
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-5">
        <p className="text-[12px] font-semibold text-[var(--error)]">{zh ? '这次研究失败了' : 'This run failed'}</p>
        <p className="mt-2 text-[11px] text-ink-2 break-words leading-relaxed">{error}</p>
        <p className="mt-3 text-[11px] text-muted leading-relaxed">
          {zh
            ? '常见原因：模型 key 未配置或额度不足、检索源全部不可达、单次上下文超限。修好后重新开始即可，失败记录会保留在左侧历史里。'
            : 'Common causes: missing/invalid model key, all retrievers unreachable, or context limit exceeded. Fix and start again; failed runs stay in the history list.'}
        </p>
      </div>
    )
  }

  if (status === 'running' && !report) {
    return (
      <div className="panel-loading">
        <div className="panel-loading-radar">
          <div className="panel-radar-dot" />
        </div>
        <div className="panel-loading-text">
          {zh ? '智能体正在协作，报告完成后会出现在这里' : 'Agents are working; the report lands here when done'}
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="px-4 py-6">
        <p className="text-[12px] text-ink-2 leading-relaxed">
          {zh ? '还没有选中报告。' : 'No report selected yet.'}
        </p>
        <p className="mt-2 text-[11px] text-muted leading-relaxed">
          {zh
            ? '在左侧填写关注方向并开始研究；右侧会同步显示协作过程。完成的报告按时间累积在历史列表里，随时点开重读。'
            : 'Start a run on the left; the right column shows agent collaboration live. Finished reports accumulate in the history list.'}
        </p>
      </div>
    )
  }

  const metaBits: string[] = []
  if (meta.model) metaBits.push(`模型 ${meta.model}`)
  if (typeof meta.elapsedSec === 'number') metaBits.push(`耗时 ${Math.round(meta.elapsedSec)}s`)
  if (meta.events) metaBits.push(`协作事件 ${meta.events}`)
  if (meta.signals) metaBits.push(`信号 ${meta.signals}`)
  if (meta.finishedAt) {
    const d = new Date(meta.finishedAt * 1000)
    metaBits.push(`生成于 ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
      {metaBits.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pb-3 mb-4 border-b border-edge text-[10px] font-mono text-muted tabular-nums">
          {metaBits.map(b => <span key={b}>{b}</span>)}
        </div>
      )}
      <article className="max-w-[74ch] text-[13px] leading-7 text-ink-2">
        {renderMarkdown(report)}
      </article>
    </div>
  )
}
