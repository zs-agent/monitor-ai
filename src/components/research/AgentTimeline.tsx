'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { KEY_EVENTS, agentOf } from './agentMap'

export interface RunEvent {
  type?: string
  event?: string
  output?: string
  ts?: number
}

function timeOf(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export default function AgentTimeline({ locale, events, running }: { locale: Locale; events: RunEvent[]; running: boolean }) {
  const zh = locale === 'zh'
  const [keyOnly, setKeyOnly] = useState(true)

  const shown = useMemo(
    () => (keyOnly ? events.filter(e => KEY_EVENTS[e.event || '']) : events),
    [events, keyOnly],
  )

  if (events.length === 0) {
    return (
      <div className="px-4 py-6">
        <p className="text-[12px] text-ink-2 leading-relaxed">
          {zh ? '研究开始后，这里实时显示每个智能体正在做什么。' : 'Once a research run starts, every agent step streams in here.'}
        </p>
        <ul className="mt-4 space-y-2 text-[11px] text-muted">
          {(zh
            ? ['主编：拆解子问题、规划报告章节', '研究员：按章节并行检索、抓取正文', '评审与改写：按情报口径打回重写', '事实核查：核对结论与引用是否成立', '可视化与发布：出图、成稿、给引用']
            : ['Chief editor: splits questions, plans sections', 'Researchers: parallel retrieval + full-page scraping', 'Reviewer / reviser: enforces the analysis guidelines', 'Fact checker: verifies claims against evidence', 'Visualizer / publisher: diagram, assemble, cite']
          ).map(t => <li key={t} className="leading-relaxed">· {t}</li>)}
        </ul>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-edge">
        {([[true, zh ? '关键节点' : 'Milestones'], [false, zh ? '全部事件' : 'All events']] as [boolean, string][]).map(([v, label]) => (
          <button
            key={String(v)}
            onClick={() => setKeyOnly(v)}
            className={`px-2 py-1 text-[11px] rounded-md transition-colors ${keyOnly === v ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'}`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[10px] font-mono text-muted tabular-nums">
          {shown.length}/{events.length}
        </span>
      </div>

      <ol className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        {shown.map((e, i) => {
          const agent = agentOf(e.event)
          const isLast = i === shown.length - 1
          return (
            <li key={`${e.ts}-${i}`} className="relative flex gap-2.5 pb-3 last:pb-0">
              {!isLast && <span className="absolute left-[2.5px] top-3 bottom-0 w-px bg-edge" aria-hidden />}
              <span className={`mt-1.5 w-[6px] h-[6px] rounded-full shrink-0 ${agent.dotClass} ${running && isLast ? 'animate-pulse-slow' : ''}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${agent.className}`}>{agent.label(zh)}</span>
                  <span className="text-[10px] font-mono text-muted tabular-nums">{timeOf(e.ts)}</span>
                </div>
                {e.output && (
                  <p className={`mt-0.5 text-[11px] leading-relaxed break-words ${keyOnly ? 'text-ink-2' : 'text-muted'}`}>
                    {String(e.output).slice(0, keyOnly ? 220 : 400)}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
