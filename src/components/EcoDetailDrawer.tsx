'use client'

import { useMemo } from 'react'
import type { Locale } from '@/lib/i18n'
import type { AiLocation } from '@/data/ai-locations'
import { ECOSYSTEM_ENTITIES, ECO_SUBTYPE_LABELS } from '@/data/agent-ecosystem'
import { MODEL_REPORTS } from '@/data/model-reports'
import type { Signal } from '@/types/signal'

interface Props {
  locale: Locale
  entity: AiLocation | null
  signals: Signal[]
  onClose: () => void
  onSignalClick?: (s: Signal) => void
}

const TYPE_ZH: Record<string, string> = {
  lab: '大模型厂商', 'agent-project': 'Agent 开源项目', 'agent-platform': '企业级 Agent 平台', infra: '基础设施',
  company: '公司', research: '研究机构',
}

export default function EcoDetailDrawer({ locale, entity, signals, onClose, onSignalClick }: Props) {
  const related = useMemo(() => {
    if (!entity) return { projects: [], reports: [], news: [] as Signal[] }
    const relations = entity.ecosystem?.techRelations?.map(t => t.toLowerCase()) || []
    const projects = ECOSYSTEM_ENTITIES.filter(e =>
      e.id !== entity.id && (e.type === entity.type || (relations.length > 0 && e.ecosystem?.techRelations?.some(r => relations.includes(r.toLowerCase()))))
    ).slice(0, 6)
    const reports = MODEL_REPORTS.filter(r =>
      relations.some(kw => (r.name + r.vendor + r.keyChange).toLowerCase().includes(kw)) ||
      (entity.name.toLowerCase().split(' ')[0].length > 2 && (r.vendor.toLowerCase().includes(entity.name.toLowerCase().split(' ')[0]) || entity.name.toLowerCase().includes(r.vendor.toLowerCase())))
    ).slice(0, 4)
    const news = signals
      .filter(s => relations.some(kw => (s.title + ' ' + s.summary + ' ' + (s.tags || []).join(' ')).toLowerCase().includes(kw)))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 6)
    return { projects, reports, news }
  }, [entity, signals])

  if (!entity) return null
  const isZh = locale === 'zh'
  const subtype = entity.ecosystem?.subtype ? ECO_SUBTYPE_LABELS[entity.ecosystem.subtype as keyof typeof ECO_SUBTYPE_LABELS] : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative w-full max-w-[400px] h-full bg-[var(--bg-card)] border-l border-[var(--border)] shadow-2xl flex flex-col animate-slide-in">
        {/* 头部 */}
        <header className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">{isZh ? entity.nameZh : entity.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent)]/30">
                {isZh ? (TYPE_ZH[entity.type] || entity.type) : entity.type}
              </span>
              {subtype && <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">{isZh ? subtype.zh : subtype.en}</span>}
              <span className="text-[10px] text-[var(--text-muted)]">{entity.city}{entity.country ? `, ${entity.country}` : ''}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[16px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">×</button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* 描述 */}
          {entity.description && (
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">{entity.description}</p>
          )}
          {entity.ecosystem?.note && (
            <p className="text-[10px] text-[var(--text-dim)]">※ {entity.ecosystem.note}</p>
          )}

          {/* 链接 */}
          {(entity.ecosystem?.github || entity.ecosystem?.home) && (
            <div className="flex items-center gap-2 flex-wrap">
              {entity.ecosystem.github && (
                <a href={`https://github.com/${entity.ecosystem.github}`} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-3 py-1.5 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)]/40 transition-colors">
                  GitHub ↗
                </a>
              )}
              {entity.ecosystem.home && (
                <a href={entity.ecosystem.home} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] px-3 py-1.5 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                  {isZh ? '官网' : 'Home'} ↗
                </a>
              )}
            </div>
          )}

          {/* 相关项目 */}
          <Section title={isZh ? '相关项目 / 平台' : 'Related Projects'}>
            {related.projects.length === 0 ? (
              <EmptyLine locale={locale} />
            ) : (
              <div className="space-y-1.5">
                {related.projects.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg bg-[var(--bg-card-2)]">
                    <span className="text-[12px] text-[var(--text-primary)]">{isZh ? p.nameZh : p.name}</span>
                    <span className="text-[9px] text-[var(--text-muted)]">{isZh ? (TYPE_ZH[p.type] || p.type) : p.type}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 相关模型报告 */}
          <Section title={isZh ? '相关模型 / 论文' : 'Related Models & Papers'}>
            {related.reports.length === 0 ? (
              <EmptyLine locale={locale} />
            ) : (
              <div className="space-y-1.5">
                {related.reports.map(r => (
                  <a key={r.id} href={r.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="block py-1.5 px-2.5 rounded-lg bg-[var(--bg-card-2)] hover:bg-[var(--hover-overlay)] transition-colors">
                    <div className="text-[11px] text-[var(--accent)]">{r.name}</div>
                    <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{r.vendor} · {r.type} · {r.date}</div>
                  </a>
                ))}
              </div>
            )}
          </Section>

          {/* 相关资讯 */}
          <Section title={isZh ? '相关资讯' : 'Related Signals'}>
            {related.news.length === 0 ? (
              <EmptyLine locale={locale} />
            ) : (
              <div className="space-y-1.5">
                {related.news.map(s => (
                  <button key={s.id} onClick={() => onSignalClick?.(s)}
                    className="w-full text-left py-1.5 px-2.5 rounded-lg bg-[var(--bg-card-2)] hover:bg-[var(--hover-overlay)] transition-colors">
                    <div className="text-[11px] text-[var(--text-primary)] leading-snug line-clamp-2">{s.title}</div>
                    <div className="text-[9px] text-[var(--text-muted)] mt-0.5">{s.source} · {new Date(s.publishedAt).toLocaleDateString()}</div>
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>
      </aside>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">{title}</h4>
      {children}
    </section>
  )
}

function EmptyLine({ locale }: { locale: Locale }) {
  return <p className="text-[10px] text-[var(--text-dim)]">{locale === 'zh' ? '暂无关联内容（等待数据接入）' : 'No related content yet'}</p>
}
