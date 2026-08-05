'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import PanelBase from './PanelBase'
import { RADAR_CATEGORIES, type AgentRadarProject, type RadarCategory } from '@/data/agent-radar'

interface Props {
  locale: Locale
}

type DataState = 'live' | 'cached' | 'partial' | 'static' | 'error'

interface RadarResponse {
  fetchedAt?: string
  state?: DataState
  projects?: AgentRadarProject[]
  failedRepos?: string[]
  snapshotNote?: string
}

function fmtStars(n: number | undefined): string {
  if (n === undefined) return '\u2014'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function fmtDelta(n: number | null | undefined): string {
  if (n === null || n === undefined) return '\u2014'
  return `+${n}`
}

function diffDays(iso: string | null | undefined): string {
  if (!iso) return '\u2014'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d < 1) return 'today'
  if (d === 1) return '1d ago'
  return `${d}d ago`
}

function difficultyDots(level: number): string {
  return '●'.repeat(level) + '○'.repeat(5 - level)
}

function riskColor(level: number): string {
  if (level <= 2) return 'var(--success)'
  if (level === 3) return 'var(--warning)'
  return 'var(--error)'
}

export default function AgentRadarPanel({ locale }: Props) {
  const [projects, setProjects] = useState<AgentRadarProject[]>([])
  const [state, setState] = useState<DataState>('static')
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [failedRepos, setFailedRepos] = useState<string[]>([])
  const [snapshotNote, setSnapshotNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<RadarCategory | 'all'>('all')
  const abortRef = useRef<AbortController | null>(null)

  const load = () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true); setError(null)
    fetch('/api/agent-radar', { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<RadarResponse> })
      .then(d => {
        if (ctrl.signal.aborted) return
        setProjects(d.projects || [])
        setState(d.state || 'static')
        setFetchedAt(d.fetchedAt || null)
        setFailedRepos(d.failedRepos || [])
        setSnapshotNote(d.snapshotNote || null)
        setLoading(false)
      })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); setState('error'); setLoading(false) } })
  }

  useEffect(() => { load(); return () => abortRef.current?.abort() }, [])

  const filtered = useMemo(() => {
    if (category === 'all') return projects
    return projects.filter(p => p.category === category)
  }, [projects, category])

  const badge = state === 'live' ? 'live' : state === 'cached' ? 'cached' : state === 'partial' ? 'cached' : 'static'

  return (
    <PanelBase
      id="agent-radar"
      title={locale === 'zh' ? 'Agent 开源雷达' : 'Agent Open-Source Radar'}
      dataBadge={badge}
      dataBadgeDetail={fetchedAt ? fetchedAt.slice(0, 10) : undefined}
      count={projects.length}
      error={error}
      onRetry={load}
      className="flex flex-col h-full"
    >
      {!error && (
        <div className="flex flex-col min-h-0 flex-1">
          {/* 分类 tabs */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1.5 border-b border-[var(--border)] overflow-x-auto">
            <button
              onClick={() => setCategory('all')}
              className={`px-2.5 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors ${category === 'all' ? 'bg-[var(--accent-bg)] text-[var(--accent)] font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]'}`}
            >
              {locale === 'zh' ? '全部' : 'All'} ({projects.length})
            </button>
            {RADAR_CATEGORIES.map(c => {
              const count = projects.filter(p => p.category === c.key).length
              if (count === 0) return null
              return (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`px-2.5 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors ${category === c.key ? 'bg-[var(--accent-bg)] text-[var(--accent)] font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]'}`}
                >
                  {locale === 'zh' ? c.zh : c.en} ({count})
                </button>
              )
            })}
          </div>

          {/* 数据说明条 */}
          {(snapshotNote || failedRepos.length > 0) && (
            <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)]/60 text-[10px] text-[var(--text-muted)] flex-wrap">
              {state === 'static' && <span className="text-[var(--warning)]">⚠ {locale === 'zh' ? 'GitHub API 暂不可达，显示静态清单（无实时指标）' : 'GitHub API unreachable — static list (no live metrics)'}</span>}
              {state === 'partial' && <span className="text-[var(--warning)]">⚠ {locale === 'zh' ? `部分仓库获取失败（${failedRepos.length}）：${failedRepos.join(', ')}` : `Some repos failed (${failedRepos.length}): ${failedRepos.join(', ')}`}</span>}
              {snapshotNote && <span>· {snapshotNote}</span>}
            </div>
          )}

          {/* 项目卡片 */}
          <div className="p-3 overflow-y-auto min-h-0 flex-1">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-44 bg-[var(--bg-hover)] rounded-xl animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <span className="text-2xl mb-2 opacity-30">◇</span>
                <p className="text-[12px] text-[var(--text-muted)]">{locale === 'zh' ? '该分类暂无项目' : 'No projects in this category'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map(p => (
                  <article key={p.id} className="bg-[var(--bg-card-2)] border border-[var(--border)] rounded-xl p-3.5 flex flex-col gap-2.5 hover:border-[var(--border-light)] transition-colors">
                    {/* 头 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <a href={`https://github.com/${p.repo}`} target="_blank" rel="noopener noreferrer"
                          className="text-[14px] font-semibold text-[var(--accent)] hover:text-[var(--accent-dim)] transition-colors truncate block">
                          {p.name}
                        </a>
                        <div className="text-[10px] text-[var(--text-muted)] font-mono truncate">{p.repo}</div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0 bg-[var(--bg-hover)] text-[var(--text-muted)]">
                        {locale === 'zh' ? (RADAR_CATEGORIES.find(c => c.key === p.category)?.zh || p.category) : p.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-snug">{p.description}</p>

                    {/* 指标 */}
                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      <div className="bg-[var(--bg-card)] rounded-lg px-2 py-1.5">
                        <div className="text-[9px] text-[var(--text-muted)]">Stars</div>
                        <div className="font-mono text-[var(--text-primary)] font-semibold">{fmtStars(p.stars)}</div>
                        <div className="text-[9px] text-emerald-400 font-mono">{locale === 'zh' ? '7日' : '7d'}: {fmtDelta(p.starsDelta7d)}</div>
                      </div>
                      <div className="bg-[var(--bg-card)] rounded-lg px-2 py-1.5">
                        <div className="text-[9px] text-[var(--text-muted)]">Forks</div>
                        <div className="font-mono text-[var(--text-primary)] font-semibold">{fmtStars(p.forks)}</div>
                        <div className="text-[9px] text-[var(--text-muted)]">{locale === 'zh' ? '提交' : 'push'} {diffDays(p.pushedAt)}</div>
                      </div>
                      <div className="bg-[var(--bg-card)] rounded-lg px-2 py-1.5">
                        <div className="text-[9px] text-[var(--text-muted)]">Release</div>
                        <div className="font-mono text-[var(--text-primary)] font-semibold truncate">{p.latestRelease || '\u2014'}</div>
                        <div className="text-[9px] text-[var(--text-muted)]">{locale === 'zh' ? 'Issues' : 'Issues'}: {p.openIssues ?? '\u2014'}</div>
                      </div>
                    </div>

                    {/* 标签与风险 */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[9px]">
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">{p.license}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">{p.language}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]" title={locale === 'zh' ? '部署难度' : 'Deployment difficulty'}>
                        {locale === 'zh' ? '部署' : 'Deploy'} {difficultyDots(p.deploymentDifficulty)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[var(--bg-hover)]" style={{ color: riskColor(p.enterpriseRisk.level) }}
                        title={p.enterpriseRisk.note}>
                        {locale === 'zh' ? '企业风险' : 'Risk'} {difficultyDots(p.enterpriseRisk.level)}
                      </span>
                    </div>
                    <p className="text-[9px] text-[var(--text-muted)] border-t border-[var(--border)]/50 pt-1.5">
                      <span className="text-[var(--warning)]">◈</span> {p.whyWatch}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </PanelBase>
  )
}
