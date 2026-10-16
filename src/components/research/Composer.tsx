'use client'

import type { Locale } from '@/lib/i18n'
import type { ReactNode } from 'react'

interface Props {
  locale: Locale
  structured?: boolean
  focus: string
  onFocusChange: (v: string) => void
  top: number
  onTopChange: (v: number) => void
  maxSections: number
  onMaxSectionsChange: (v: number) => void
  onStart: () => void
  onCancel: () => void
  running: boolean
  ready: boolean
  blockedReason: string | null
  children?: ReactNode
}

const PRESETS = [
  { zh: 'AI 智能体编排框架', en: 'AI agent orchestration', value: 'AI 智能体编排框架' },
  { zh: '推理成本与算力路线', en: 'Inference cost & compute', value: '推理成本与算力路线' },
  { zh: '多模态模型落地进展', en: 'Multimodal deployment', value: '多模态模型落地进展' },
]

export default function Composer({
  locale, structured = false, focus, onFocusChange, top, onTopChange, maxSections, onMaxSectionsChange, onStart, onCancel, running, ready, blockedReason, children,
}: Props) {
  const zh = locale === 'zh'
  const disabled = running || !ready

  return (
    <div className="p-3 space-y-3">
      <label className="block">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
          {zh ? '研究对象或问题' : 'Research object or question'}
        </span>
        <input
          value={focus}
          onChange={e => onFocusChange(e.target.value)}
          disabled={running}
          placeholder={zh ? '例：开源模型新版本的部署要求' : 'e.g. deployment requirements of a new model version'}
          className="w-full bg-elevated border border-edge rounded px-2.5 py-1.5 text-[12px] text-ink outline-none transition-colors focus:border-accent-60 disabled:opacity-50 placeholder:text-muted"
        />
      </label>

      {!structured && <div className="flex flex-wrap gap-1">
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => onFocusChange(p.value)}
            disabled={running}
            className="px-2 py-1 text-[10px] rounded-md border border-edge text-muted hover:text-ink-2 hover:border-edge-light transition-colors disabled:opacity-40"
          >
            {zh ? p.zh : p.en}
          </button>
        ))}
      </div>}

      {!structured && <div className="flex gap-3">
        <label className="flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
            {zh ? '信号条数' : 'Signals'}
          </span>
          <input
            type="number" min={1} max={50} name="signals" value={top} disabled={running}
            onChange={e => onTopChange(Math.max(1, Math.min(50, Number(e.target.value) || 0)))}
            className="w-full bg-elevated border border-edge rounded px-2.5 py-1.5 text-[12px] text-ink font-mono outline-none focus:border-accent-60 disabled:opacity-50"
          />
        </label>
        {!structured && <label className="flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1.5">
            {zh ? '报告章节' : 'Sections'}
          </span>
          <input
            type="number" min={1} max={8} name="sections" value={maxSections} disabled={running}
            onChange={e => onMaxSectionsChange(Math.max(1, Math.min(8, Number(e.target.value) || 0)))}
            className="w-full bg-elevated border border-edge rounded px-2.5 py-1.5 text-[12px] text-ink font-mono outline-none focus:border-accent-60 disabled:opacity-50"
          />
        </label>}
      </div>}

      {children}

      <div className="flex gap-2">
        <button
          onClick={onStart}
          disabled={disabled}
          className="flex-1 text-[12px] font-semibold bg-accent text-black rounded px-3 py-2 hover:bg-accent-dim hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? (zh ? '研究中…' : 'Researching…') : (zh ? '开始研究' : 'Start research')}
        </button>
        {running && (
          <button
            onClick={onCancel}
            className="text-[12px] font-semibold rounded px-3 py-2 border border-edge text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
          >
            {zh ? '停止' : 'Stop'}
          </button>
        )}
      </div>

      {blockedReason && (
        <p className="text-[11px] text-warning leading-relaxed">{blockedReason}</p>
      )}

      <p className="text-[10px] text-muted leading-relaxed">
        {zh
          ? (structured ? '根据关注对象组织分析问题，在动作预算内检索与核查；后续研究保留稳定内容，复核相关变化。' : '根据监测线索组织课题，经规划、章节研究、审核与整合形成报告。通常需要几分钟。')
          : 'The topic is assembled from monitor-ai signal snapshots: initial retrieval, parallel per-section deep research, review/revision, fact-check, then publication. Usually takes minutes.'}
      </p>
    </div>
  )
}
