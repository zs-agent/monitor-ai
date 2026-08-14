'use client'

import { useMemo, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { useRemoteData } from '@/lib/use-remote-data'
import PanelBase from './PanelBase'
import CredibilityTag from './CredibilityTag'
import { RADAR_CATEGORIES, WHY_WATCH_EN, type AgentRadarProject, type RadarCategory } from '@/data/agent-radar'

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

/** 迷你走势线（近 7 日 star 快照） */
function TrendSpark({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const w = 64, h = 16
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${(h - 2) - ((v - min) / range) * (h - 4)}`).join(' ')
  const up = data[data.length - 1] >= data[0]
  return (
    <svg width={w} height={h} className="shrink-0" aria-label="trend">
      <polyline points={pts} fill="none" stroke={up ? 'var(--success)' : 'var(--error)'} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function difficultyDots(level: number): string {
  const l = Math.max(1, Math.min(5, Math.round(level) || 1))
  return '●'.repeat(l) + '○'.repeat(5 - l)
}

function riskColor(level: number): string {
  if (level <= 2) return 'var(--success)'
  if (level === 3) return 'var(--warning)'
  return 'var(--error)'
}

export default function AgentRadarPanel({ locale }: Props) {
  const { data, loading, error, reload } = useRemoteData<RadarResponse>('/api/agent-radar', [], { refreshInterval: 5 * 60 * 1000 })
  const projects = useMemo(() => data?.projects ?? [], [data])
  const state = data?.state || 'static'
  const fetchedAt = data?.fetchedAt || null
  const failedRepos = useMemo(() => data?.failedRepos ?? [], [data])
  const snapshotNote = data?.snapshotNote || null
  const [category, setCategory] = useState<RadarCategory | 'all'>('all')
  const [sortBy, setSortBy] = useState<'default' | 'growth'>('default')

  const filtered = useMemo(() => {
    let list = category === 'all' ? projects : projects.filter(p => p.category === category)
    if (sortBy === 'growth') {
      // 本周增长最快：无增量数据（null/undefined）排最后
      list = [...list].sort((a, b) => (b.starsDelta7d ?? -1) - (a.starsDelta7d ?? -1))
    }
    return list
  }, [projects, category, sortBy])

  const badge = state === 'live' ? 'live' : state === 'cached' ? 'cached' : state === 'partial' ? 'cached' : 'static'

  return (
    <PanelBase
      id="agent-radar"
      title={locale === 'zh' ? 'Agent 开源雷达' : 'Agent Open-Source Radar'}
      dataBadge={badge}
      dataBadgeDetail={fetchedAt ? fetchedAt.slice(0, 10) : undefined}
      count={projects.length}
      error={error}
      onRetry={reload}
      className="flex flex-col h-full"
    >
      {!error && (
        <div className="flex flex-col min-h-0 flex-1">
          {/* 分类 tabs + 排序 */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1.5 border-b border-edge overflow-x-auto">
            <button
              onClick={() => setCategory('all')}
              className={`px-2.5 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors ${category === 'all' ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'}`}
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
                  className={`px-2.5 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors ${category === c.key ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'}`}
                >
                  {locale === 'zh' ? c.zh : c.en} ({count})
                </button>
              )
            })}
            <span className="w-px h-4 bg-edge mx-1 shrink-0" />
            <button
              onClick={() => setSortBy(s => s === 'default' ? 'growth' : 'default')}
              className={`px-2.5 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors shrink-0 ${sortBy === 'growth' ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'}`}
              title={locale === 'zh' ? '按近 7 日 star 增量排序' : 'Sort by 7-day star growth'}
            >
              {locale === 'zh' ? '⚡ 本周增长' : '⚡ Growth'}
            </button>
          </div>

          {/* 数据说明条 */}
          {(snapshotNote || failedRepos.length > 0) && (
            <div className="flex items-center gap-2 px-4 py-1.5 border-b border-edge-60 text-[10px] text-muted flex-wrap">
              <CredibilityTag level={state === 'static' ? 'low' : state === 'partial' ? 'medium' : 'high'} locale={locale} />
              {state === 'static' && <span className="text-warning">⚠ {locale === 'zh' ? 'GitHub API 暂不可达，显示静态清单（无实时指标）' : 'GitHub API unreachable — static list (no live metrics)'}</span>}
              {state === 'partial' && <span className="text-warning">⚠ {locale === 'zh' ? `部分仓库获取失败（${failedRepos.length}）：${failedRepos.join(', ')}` : `Some repos failed (${failedRepos.length}): ${failedRepos.join(', ')}`}</span>}
              {snapshotNote && <span>· {snapshotNote}</span>}
            </div>
          )}

          {/* 项目卡片 */}
          <div className="p-3 overflow-y-auto min-h-0 flex-1">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-44 bg-hover rounded-xl animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <span className="text-2xl mb-2 opacity-30">◇</span>
                <p className="text-[12px] text-muted">{locale === 'zh' ? '该分类暂无项目' : 'No projects in this category'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map(p => (
                  <article key={p.id} className="bg-card-2 border border-edge rounded-xl p-3.5 flex flex-col gap-2.5 hover:border-edge-light transition-colors">
                    {/* 头 */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <a href={`https://github.com/${p.repo}`} target="_blank" rel="noopener noreferrer"
                          className="text-[14px] font-semibold text-accent hover:text-accent-dim transition-colors truncate block">
                          {p.name}
                        </a>
                        <div className="text-[10px] text-muted font-mono truncate">{p.repo}</div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0 bg-hover text-muted">
                        {locale === 'zh' ? (RADAR_CATEGORIES.find(c => c.key === p.category)?.zh || p.category) : p.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-2 leading-snug">{p.description}</p>

                    {/* 指标 */}
                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      <div className="bg-card rounded-lg px-2 py-1.5">
                        <div className="text-[9px] text-muted">Stars</div>
                        <div className="font-mono text-ink font-semibold">{fmtStars(p.stars)}</div>
                        <div className="text-[9px] text-emerald-400 font-mono">{locale === 'zh' ? '7日' : '7d'}: {fmtDelta(p.starsDelta7d)}</div>
                      </div>                      <div className="bg-card rounded-lg px-2 py-1.5">
                        <div className="text-[9px] text-muted">Forks</div>
                        <div className="font-mono text-ink font-semibold">{fmtStars(p.forks)}</div>
                        <div className="text-[9px] text-muted">{locale === 'zh' ? '提交' : 'push'} {diffDays(p.pushedAt)}</div>
                      </div>
                      <div className="bg-card rounded-lg px-2 py-1.5">
                        <div className="text-[9px] text-muted">Release</div>
                        <div className="font-mono text-ink font-semibold truncate">{p.latestRelease || '\u2014'}</div>
                        <div className="text-[9px] text-muted">{locale === 'zh' ? 'Issues' : 'Issues'}: {p.openIssues ?? '\u2014'}</div>
                      </div>
                    </div>

                    {/* 标签与风险 */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[9px]">
                      <span className="px-1.5 py-0.5 rounded bg-hover text-muted">{p.license}</span>
                      <span className="px-1.5 py-0.5 rounded bg-hover text-muted">{p.language}</span>
                      <span className="px-1.5 py-0.5 rounded bg-hover text-muted" title={locale === 'zh' ? '部署难度' : 'Deployment difficulty'}>
                        {locale === 'zh' ? '部署' : 'Deploy'} {difficultyDots(p.deploymentDifficulty)}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-hover" style={{ color: riskColor(p.enterpriseRisk.level) }}
                        title={p.enterpriseRisk.note}>
                        {locale === 'zh' ? '企业风险' : 'Risk'} {difficultyDots(p.enterpriseRisk.level)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-edge-50 pt-1.5">
                      {p.starHistory && p.starHistory.length >= 2
                        ? <TrendSpark data={p.starHistory.map(h => h.stars)} />
                        : <span className="text-[8px] text-dim">{locale === 'zh' ? '趋势积累中' : 'accumulating'}</span>}
                      <p className="text-[9px] text-muted truncate" title={locale === 'zh' ? p.whyWatch : (WHY_WATCH_EN[p.id] || p.whyWatch)}>
                        <span className="text-warning">◈</span> {locale === 'zh' ? p.whyWatch : (WHY_WATCH_EN[p.id] || p.whyWatch)}
                      </p>
                    </div>
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
