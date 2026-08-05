'use client'

import { useEffect, useRef } from 'react'
import type { Signal } from '@/types/signal'
import type { Locale } from '@/lib/i18n'

interface Props {
  signal: Signal
  locale: Locale
  onClose: () => void
  onRelatedClick?: (keyword: string) => void
}

export default function SignalDetailDrawer({ signal, locale, onClose, onRelatedClick }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const importanceLabel = signal.importance >= 4
    ? { text: locale === 'zh' ? '高' : 'High', color: 'var(--warning)' }
    : signal.importance >= 2
      ? { text: locale === 'zh' ? '中' : 'Medium', color: 'var(--accent)' }
      : { text: locale === 'zh' ? '低' : 'Low', color: 'var(--text-muted)' }

  const credibilityLabel = signal.credibility >= 4
    ? { text: locale === 'zh' ? '可信' : 'Trusted', color: 'var(--success)' }
    : signal.credibility >= 2
      ? { text: locale === 'zh' ? '参考' : 'Reference', color: 'var(--warning)' }
      : { text: locale === 'zh' ? '低可信' : 'Low', color: 'var(--error)' }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div ref={ref} tabIndex={-1}
        className="fixed right-0 top-0 bottom-0 w-[420px] max-w-[90vw] z-50 bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl overflow-y-auto animate-slide-in"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border)] z-10 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {locale === 'zh' ? '情报详情' : 'INTELLIGENCE DETAIL'}
            </span>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none px-1">&times;</button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* What happened */}
          <section>
            <h3 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              {locale === 'zh' ? '发生了什么' : 'WHAT HAPPENED'}
            </h3>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)] leading-snug">{signal.title}</h2>
            <p className="text-[12px] text-[var(--text-secondary)] mt-2 leading-relaxed">{signal.summary}</p>
          </section>

          {/* Why important */}
          <section>
            <h3 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              {locale === 'zh' ? '为什么重要' : 'WHY IT MATTERS'}
            </h3>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: importanceLabel.color + '18', color: importanceLabel.color }}>
                {locale === 'zh' ? '重要性' : 'Importance'}: {importanceLabel.text}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: credibilityLabel.color + '18', color: credibilityLabel.color }}>
                {locale === 'zh' ? '可信度' : 'Credibility'}: {credibilityLabel.text}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent)]">
                {signal.category.toUpperCase()}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-secondary)]">
                {signal.language === 'zh' ? '中文' : 'EN'}
              </span>
            </div>
          </section>

          {/* Source & time */}
          <section className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--bg-hover)] rounded p-2.5">
              <div className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider mb-1">{locale === 'zh' ? '来源' : 'SOURCE'}</div>
              <div className="text-[12px] text-[var(--text-primary)] font-medium">{signal.source}</div>
              <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-[var(--accent)] hover:text-[var(--accent-dim)] transition-colors mt-1 inline-block">
                {locale === 'zh' ? '查看原文 →' : 'View source →'}
              </a>
            </div>
            <div className="bg-[var(--bg-hover)] rounded p-2.5">
              <div className="text-[8px] text-[var(--text-muted)] uppercase tracking-wider mb-1">{locale === 'zh' ? '时间' : 'TIME'}</div>
              <div className="text-[12px] text-[var(--text-primary)] font-medium">
                {new Date(signal.publishedAt).toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
              <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{new Date(signal.publishedAt).toLocaleTimeString()}</div>
            </div>
          </section>

          {/* Credibility reasons */}
          <section>
            <h3 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              {locale === 'zh' ? '数据质量' : 'DATA QUALITY'}
            </h3>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shrink-0" />
                <span className="text-[var(--text-secondary)]">{locale === 'zh' ? '来源' : 'Source'}: {signal.source}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${signal.credibility >= 3 ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'}`} />
                <span className="text-[var(--text-secondary)]">
                  {locale === 'zh' ? '可信度评分' : 'Credibility score'}: {signal.credibility}/5
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                <span className="text-[var(--text-secondary)]">{locale === 'zh' ? '信源数' : 'Sources'}: {signal.sourcesCount || 1}</span>
              </div>
            </div>
          </section>

          {/* Tags / entities */}
          {signal.tags && signal.tags.length > 0 && (
            <section>
              <h3 className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                {locale === 'zh' ? '关联实体' : 'RELATED ENTITIES'}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {signal.tags.map(tag => (
                  <button key={tag} onClick={() => onRelatedClick?.(tag)}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
                    #{tag}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  )
}
