'use client'

// 实体档案页：情报浏览器的「下钻终点」。
// 列表页（IntelligenceBrowser）负责筛选与排序，档案页只做一件事——把某个厂商/模型
// 在当前已聚合数据里的全部证据摊开（概览/时间线/关联/评估），并给出可量化的机械口径。
// 数据一律现拉（/api/signals、/api/model-reports、/api/arena），不读静态 JSON，
// 避免档案内容与观测中枢看到的数据脱节。

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getLocale, type Locale } from '@/lib/i18n'
import { useRemoteData } from '@/lib/use-remote-data'
import type { Signal } from '@/types/signal'
import type { ModelReportItem } from '@/data/model-reports'
import { VENDORS, computeVendorRows, type VendorDef, type VendorRow } from '@/lib/vendor-radar'
import { entityTokens, matchedKeywords, matchesKeyword, sameEntity } from '@/lib/text-match'

export interface EntityProfileProps {
  kind: 'vendor' | 'model'
  slug: string
}

interface SignalsResponse {
  signals?: Signal[]
}
interface ReportsResponse {
  live?: ModelReportItem[]
  curated?: ModelReportItem[]
}
interface ArenaEntry {
  rank: number
  model: string
  organization: string
  score: string
}
interface ArenaBoard {
  dimension: string
  source: string
  sourceUrl: string
  entries: ArenaEntry[]
}
interface ArenaResponse {
  boards?: ArenaBoard[]
}

type TabId = 'overview' | 'timeline' | 'related' | 'evaluation'

const TABS: { id: TabId; zh: string; en: string }[] = [
  { id: 'overview', zh: '概览', en: 'Overview' },
  { id: 'timeline', zh: '时间线', en: 'Timeline' },
  { id: 'related', zh: '关联', en: 'Related' },
  { id: 'evaluation', zh: '评估', en: 'Assessment' },
]

const SHORTLIST_KEY = 'monitor-ai-shortlist'

function readShortlist(): string[] {
  try {
    const raw = localStorage.getItem(SHORTLIST_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

/** 机械统计口径：所有评估数字都从当前信号列表实算，不做语义判断 */
interface Evaluation {
  count: number
  avgCredibility: number
  highValue: number
  sources: [string, number][]
  topSourceShare: number
  spanDays: number
  earliest: string
  latest: string
  conclusion: string
}

function evaluateSignals(list: Signal[], locale: Locale): Evaluation {
  const zh = locale === 'zh'
  const times = list.map(s => new Date(s.publishedAt).getTime()).filter(t => !Number.isNaN(t))
  const earliest = times.length ? new Date(Math.min(...times)).toISOString() : ''
  const latest = times.length ? new Date(Math.max(...times)).toISOString() : ''
  const spanDays = times.length ? Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 86400000)) : 0

  const bySource = new Map<string, number>()
  for (const s of list) bySource.set(s.source, (bySource.get(s.source) ?? 0) + 1)
  const sources = Array.from(bySource.entries()).sort((a, b) => b[1] - a[1])
  const topSourceShare = list.length && sources[0] ? sources[0][1] / list.length : 0
  const avgCredibility = list.length ? list.reduce((a, s) => a + s.credibility, 0) / list.length : 0
  const highValue = list.filter(s => s.importance >= 4).length

  let conclusion: string
  if (list.length === 0) {
    conclusion = zh ? '数据不足，无法给出结论。' : 'Insufficient data to conclude.'
  } else if (sources.length === 1) {
    conclusion = zh
      ? `证据全部来自「${sources[0][0]}」单一来源，覆盖极窄，结论可靠性低。`
      : `All evidence comes from a single source (${sources[0][0]}); coverage is very narrow.`
  } else if (topSourceShare >= 0.6 && sources[0]) {
    conclusion = zh
      ? `证据集中在「${sources[0][0]}」（占 ${(topSourceShare * 100).toFixed(0)}%），来源覆盖偏窄。`
      : `Evidence is concentrated in ${sources[0][0]} (${(topSourceShare * 100).toFixed(0)}% of signals); source coverage is narrow.`
  } else {
    conclusion = zh
      ? `来源较分散，最大单一来源占 ${(topSourceShare * 100).toFixed(0)}%，样本量 ${list.length} 条。`
      : `Sources are fairly diverse; the largest single source accounts for ${(topSourceShare * 100).toFixed(0)}% across ${list.length} signals.`
  }

  return { count: list.length, avgCredibility, highValue, sources, topSourceShare, spanDays, earliest, latest, conclusion }
}

/** 时间跨度一行文本 */
function spanText(ev: Evaluation, locale: Locale): string {
  if (!ev.earliest) return locale === 'zh' ? '无信号' : 'none'
  return `${formatDate(ev.earliest, locale)} → ${formatDate(ev.latest, locale)}（${ev.spanDays} ${locale === 'zh' ? '天' : 'd'}）`
}

function IntroValue({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card border border-edge rounded-lg px-3 py-2.5">
      <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-[14px] text-ink font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-dim">{hint}</p>}
    </div>
  )
}

function SignalTimeline({ list, locale }: { list: Signal[]; locale: Locale }) {
  if (list.length === 0) {
    return (
      <p className="text-[11px] text-muted py-8 text-center">
        {locale === 'zh' ? '暂无相关信号，无法构建时间线。' : 'No related signals to build a timeline.'}
      </p>
    )
  }
  return (
    <ol className="relative border-l border-edge ml-2">
      {list.map(s => (
        <li key={s.id} className="relative pl-4 pb-4 last:pb-0">
          <span className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-accent-40 border border-accent" />
          <div className="flex items-center gap-2 text-[10px] text-muted">
            <span className="font-mono tabular-nums">{formatDate(s.publishedAt, locale)}</span>
            <span>·</span>
            <span>{s.source}</span>
            <span className="text-dim">
              {locale === 'zh' ? '可信度' : 'cred'} {s.credibility}/5
            </span>
            <span className={`text-dim ${s.importance >= 4 ? 'text-accent' : ''}`}>
              {locale === 'zh' ? '重要度' : 'imp'} {'★'.repeat(Math.max(0, Math.min(5, Math.round(s.importance))))}
            </span>
          </div>
          <a
            href={s.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 block text-[12px] text-ink-2 hover:text-accent transition-colors line-clamp-2"
          >
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  )
}

export default function EntityProfile({ kind, slug }: EntityProfileProps) {
  const [locale, setLocale] = useState<Locale>('en')
  const [tab, setTab] = useState<TabId>('overview')
  const [shortlisted, setShortlisted] = useState(false)

  useEffect(() => { setLocale(getLocale()) }, [])

  const sig = useRemoteData<SignalsResponse>(`/api/signals?locale=${locale}&category=all`, [], { refreshInterval: 5 * 60 * 1000 })
  const rep = useRemoteData<ReportsResponse>('/api/model-reports', [], { refreshInterval: 10 * 60 * 1000 })
  const arena = useRemoteData<ArenaResponse>('/api/arena', [], { refreshInterval: 10 * 60 * 1000 })

  const signals = useMemo(() => sig.data?.signals ?? [], [sig.data])
  const reports = useMemo(() => [...(rep.data?.curated ?? []), ...(rep.data?.live ?? [])], [rep.data])
  const boards = useMemo(() => arena.data?.boards ?? [], [arena.data])

  const vendor: VendorDef | null = kind === 'vendor' ? VENDORS.find(v => v.id === slug) ?? null : null
  const model: ModelReportItem | null = kind === 'model' ? reports.find(m => m.id === slug) ?? null : null
  const resolved = kind === 'vendor' ? vendor !== null : model !== null

  const entityName = vendor ? (locale === 'zh' ? vendor.nameZh : vendor.name) : model ? model.name : slug
  const shortlistKey = `${kind}:${slug}`

  // 关注状态：localStorage 短名单，刷新后保持
  useEffect(() => {
    setShortlisted(readShortlist().includes(shortlistKey))
  }, [shortlistKey])

  // 页面标题：实体名 — monitor.ai（客户端组件无 metadata，用 document.title）
  useEffect(() => {
    document.title = resolved ? `${entityName} — monitor.ai` : `实体档案 — monitor.ai`
    return () => { document.title = 'monitor.ai - AI Global Intelligence' }
  }, [resolved, entityName])

  // 厂商档案：信号是唯一证据来源，其错误即整页不可用
  // 模型档案：model-reports 决定实体是否存在，其错误即整页不可用
  const primaryError = kind === 'vendor' ? sig.error : rep.error
  const primaryLoading = kind === 'vendor' ? sig.loading : rep.loading
  const allErrored = !!sig.error && !!rep.error && !!arena.error

  const reloadAll = () => { sig.reload(); rep.reload(); arena.reload() }

  const vendorStats = useMemo(() => (kind === 'vendor' ? computeVendorRows(signals, 3650) : null), [kind, signals])
  const vendorRow: VendorRow | null = vendor && vendorStats ? vendorStats.rows.find(r => r.id === vendor.id) ?? null : null
  const entitySignals = useMemo(() => {
    if (kind === 'vendor') return vendorRow?.signals ?? []
    if (!model) return []
    const tokens = entityTokens(model.name)
    if (tokens.length === 0) return []
    return signals.filter(s => {
      const text = `${s.title} ${s.summary ?? ''}`
      return tokens.some(t => matchesKeyword(text, t))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, vendorRow, model, signals])

  const timelineSignals = useMemo(
    () => [...entitySignals].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    [entitySignals],
  )

  const evaluation = useMemo(() => evaluateSignals(entitySignals, locale), [entitySignals, locale])

  // 厂商关联：先取有提及的其它厂商，再按共现次数排序
  const relatedVendors = useMemo(() => {
    if (kind !== 'vendor' || !vendorRow || !vendorStats) return []
    return vendorStats.rows
      .filter(r => r.id !== vendorRow.id)
      .map(r => ({
        row: r,
        co: vendorRow.signals.filter(s => matchedKeywords(`${s.title} ${s.summary ?? ''}`, r.keys).length > 0).length,
      }))
      .filter(x => x.co > 0)
      .sort((a, b) => b.co - a.co)
      .slice(0, 8)
  }, [kind, vendorRow, vendorStats])

  // 模型关联：同厂商的其它模型
  const siblingModels = useMemo(() => {
    if (!model || model.vendor === '—') return []
    return reports.filter(m => m.id !== model.id && m.vendor === model.vendor).slice(0, 8)
  }, [model, reports])

  // 模型关联：竞技场同维度相邻名次
  const arenaNeighbours = useMemo(() => {
    if (!model) return []
    return boards
      .map(b => {
        const me = b.entries.find(e => sameEntity(e.model, model.name))
        if (!me) return null
        const near = b.entries.filter(e => e !== me && Math.abs(e.rank - me.rank) <= 2)
        if (near.length === 0) return null
        return { dimension: b.dimension, entries: near }
      })
      .filter((x): x is { dimension: string; entries: ArenaEntry[] } => x !== null)
  }, [boards, model])

  // 竞技场分数：模型名写法不同，用归一化实体名比对
  const modelArenaRows = useMemo(() => {
    if (!model) return []
    return boards
      .map(b => ({ dimension: b.dimension, source: b.source, entry: b.entries.find(e => sameEntity(e.model, model.name)) }))
      .filter((x): x is { dimension: string; source: string; entry: ArenaEntry } => x.entry !== undefined)
  }, [boards, model])

  const toggleShortlist = () => {
    const list = readShortlist()
    const set = new Set(list)
    if (set.has(shortlistKey)) set.delete(shortlistKey)
    else set.add(shortlistKey)
    const next = Array.from(set)
    try { localStorage.setItem(SHORTLIST_KEY, JSON.stringify(next)) } catch { /* 隐私模式下写入失败，忽略 */ }
    setShortlisted(next.includes(shortlistKey))
  }

  const zh = locale === 'zh'
  const crumbKind = kind === 'vendor' ? (zh ? '厂商' : 'Vendor') : (zh ? '模型' : 'Model')

  const crumb = (
    <nav className="flex items-center gap-1.5 text-[10px] text-muted px-4 pt-3">
      <Link href="/nexus?tab=dashboard" className="hover:text-accent transition-colors">{zh ? '观测中枢' : 'Nexus'}</Link>
      <span className="text-dim">/</span>
      <Link href="/nexus?tab=dashboard" className="hover:text-accent transition-colors">{zh ? '情报浏览器' : 'Intelligence Browser'}</Link>
      <span className="text-dim">/</span>
      <span className="text-muted">{crumbKind}</span>
      <span className="text-dim">/</span>
      <span className="text-ink-2">{resolved ? entityName : slug}</span>
    </nav>
  )

  // ——— 数据源不可达 / 加载中 / 实体不存在 的非正常态 ———
  if (allErrored || primaryError) {
    return (
      <div className="min-h-full">
        {crumb}
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-[13px] text-ink-2">{zh ? '数据源不可达' : 'Data source unreachable'}</p>
          <p className="text-[10px] text-muted max-w-md text-center">
            {zh
              ? `无法加载 ${kind === 'vendor' ? '信号' : '模型报告'}数据，暂时无法展示该实体档案。`
              : `Failed to load ${kind === 'vendor' ? 'signals' : 'model reports'}; the profile cannot be shown.`}
          </p>
          <p className="text-[10px] text-dim font-mono">{allErrored ? sig.error : primaryError}</p>
          <button onClick={reloadAll} className="text-[11px] px-3 py-1.5 rounded-md bg-accent-bg border border-accent text-accent hover:opacity-80 transition-opacity">
            {zh ? '重试' : 'Retry'}
          </button>
          <Link href="/nexus?tab=dashboard" className="text-[10px] text-muted hover:text-accent transition-colors">
            {zh ? '返回工作台' : 'Back to workspace'}
          </Link>
        </div>
      </div>
    )
  }

  if (primaryLoading && !resolved) {
    return (
      <div className="min-h-full">
        {crumb}
        <div className="p-4 animate-pulse space-y-3">
          <div className="h-16 bg-card rounded-lg" />
          <div className="h-10 bg-card rounded-lg" />
          <div className="h-48 bg-card rounded-lg" />
        </div>
      </div>
    )
  }

  if (!resolved) {
    return (
      <div className="min-h-full">
        {crumb}
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-[13px] text-ink-2">{zh ? '该实体未在本地名单中找到' : 'Entity not found in the local registry'}</p>
          <p className="text-[10px] text-muted max-w-md text-center">
            {zh
              ? `slug「${slug}」不在本地${crumbKind}名单中，可能拼写有误、名单已更新，或该实体尚未被收录。`
              : `Slug "${slug}" is not in the local ${crumbKind.toLowerCase()} registry — it may be misspelled, renamed, or not yet covered.`}
          </p>
          <Link href="/nexus?tab=dashboard" className="text-[11px] px-3 py-1.5 rounded-md bg-accent-bg border border-accent text-accent hover:opacity-80 transition-opacity">
            {zh ? '返回工作台' : 'Back to workspace'}
          </Link>
        </div>
      </div>
    )
  }

  // 信号源单独失败时：档案头仍在，但依赖信号的标签页给出明确空态
  const signalsUnavailable = !!sig.error

  const renderOverview = () => {
    if (kind === 'vendor' && vendor) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <IntroValue label={zh ? '提及数' : 'Mentions'} value={String(entitySignals.length)} />
            <IntroValue label={zh ? '最高重要度' : 'Peak importance'} value={vendorRow ? `${vendorRow.peakImportance}` : '—'} />
            <IntroValue label={zh ? '命中关键词' : 'Matched key'} value={vendorRow?.bestKey ?? '—'} />
            <IntroValue
              label={zh ? '覆盖信号源' : 'Sources covered'}
              value={String(new Set(entitySignals.map(s => s.source)).size)}
            />
          </div>
          <div className="bg-card border border-edge rounded-lg px-3 py-2.5">
            <p className="text-[10px] text-muted uppercase tracking-wider">{zh ? '时间跨度' : 'Time span'}</p>
            <p className="mt-1 text-[12px] text-ink-2 font-mono">{spanText(evaluation, locale)}</p>
          </div>
          {vendorRow?.topTitle && (
            <div className="bg-card border border-edge rounded-lg px-3 py-2.5">
              <p className="text-[10px] text-muted uppercase tracking-wider">{zh ? '最高重要度信号' : 'Top signal'}</p>
              <p className="mt-1 text-[12px] text-ink-2">{vendorRow.topTitle}</p>
            </div>
          )}
        </div>
      )
    }
    if (kind === 'model' && model) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <IntroValue label={zh ? '厂商' : 'Vendor'} value={model.vendor} />
            <IntroValue label={zh ? '类型' : 'Type'} value={model.type} />
            <IntroValue label={zh ? '日期' : 'Date'} value={model.date} />
            <IntroValue label={zh ? '相关信号' : 'Signals'} value={String(entitySignals.length)} />
          </div>
          <div className="bg-card border border-edge rounded-lg px-3 py-3 space-y-2.5">
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">{zh ? '来源' : 'Source'}</p>
              <a href={model.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block text-[11px] text-accent hover:underline break-all">
                {model.sourceUrl}
              </a>
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">{zh ? '关键技术变化' : 'Key change'}</p>
              <p className="mt-0.5 text-[11px] text-ink-2 leading-relaxed">{model.keyChange || (zh ? '（无）' : '(none)')}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wider">{zh ? '对使用的影响' : 'Usage impact'}</p>
              <p className="mt-0.5 text-[11px] text-ink-2 leading-relaxed">{model.usageImpact || (zh ? '（无）' : '(none)')}</p>
            </div>
          </div>
          <div className="bg-card border border-edge rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-edge text-[10px] font-semibold text-muted uppercase tracking-wider">
              {zh ? '竞技场各维度分数' : 'Arena scores by dimension'}
            </div>
            {modelArenaRows.length === 0 ? (
              <p className="px-3 py-4 text-[11px] text-muted">{zh ? '竞技场暂无该模型的名次（名称可能未收录）。' : 'No arena ranking found for this model.'}</p>
            ) : (
              <table className="w-full text-[11px]">
                <tbody>
                  {modelArenaRows.map(r => (
                    <tr key={r.dimension} className="border-b border-edge-50 last:border-b-0">
                      <td className="py-2 px-3 text-ink-2">{r.dimension}</td>
                      <td className="py-2 px-3 text-muted text-[10px]">{r.source}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-ink">#{r.entry.rank} · {r.entry.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  const renderRelated = () => {
    if (kind === 'vendor') {
      if (relatedVendors.length === 0) {
        return (
          <p className="text-[11px] text-muted py-8 text-center">
            {zh ? '相关信号中未出现其它厂商，暂无关联。' : 'No other vendors co-occur in the related signals.'}
          </p>
        )
      }
      return (
        <ul className="divide-y divide-edge-50">
          {relatedVendors.map(({ row, co }) => (
            <li key={row.id}>
              <Link href={`/entity/vendor/${row.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-overlay transition-colors">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: row.color }} />
                <span className="text-[12px] text-ink-2 flex-1 truncate">{zh ? row.nameZh : row.name}</span>
                <span className="text-[10px] text-muted font-mono">
                  {zh ? `共现 ${co} 次` : `co-occur ${co}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )
    }
    if (kind === 'model' && model) {
      return (
        <div className="space-y-4">
          <div className="bg-card border border-edge rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-edge text-[10px] font-semibold text-muted uppercase tracking-wider">
              {zh ? `同厂商（${model.vendor}）其它模型` : `Other models by ${model.vendor}`}
            </div>
            {siblingModels.length === 0 ? (
              <p className="px-3 py-4 text-[11px] text-muted">{zh ? '本地名单中没有同厂商的其它模型。' : 'No sibling models in the local registry.'}</p>
            ) : (
              <ul className="divide-y divide-edge-50">
                {siblingModels.map(m => (
                  <li key={m.id}>
                    <Link href={`/entity/model/${m.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-overlay transition-colors">
                      <span className="text-[11px] text-ink-2 flex-1 truncate">{m.name}</span>
                      <span className="text-[10px] text-muted shrink-0">{m.type}</span>
                      <span className="text-[10px] font-mono text-dim shrink-0">{m.date}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="bg-card border border-edge rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-edge text-[10px] font-semibold text-muted uppercase tracking-wider">
              {zh ? '竞技场同维度相邻名次' : 'Arena neighbours'}
            </div>
            {arenaNeighbours.length === 0 ? (
              <p className="px-3 py-4 text-[11px] text-muted">{zh ? '竞技场中没有该模型的相邻名次。' : 'No adjacent arena rankings for this model.'}</p>
            ) : (
              <ul className="divide-y divide-edge-50">
                {arenaNeighbours.map(group => (
                  <li key={group.dimension} className="px-3 py-2.5">
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">{group.dimension}</p>
                    <div className="space-y-1">
                      {group.entries.sort((a, b) => a.rank - b.rank).map(e => (
                        <div key={`${group.dimension}-${e.rank}`} className="flex items-center gap-2 text-[11px]">
                          <span className="font-mono text-dim w-7 text-right tabular-nums">#{e.rank}</span>
                          <span className="text-ink-2 flex-1 truncate">{e.model}</span>
                          <span className="font-mono text-muted tabular-nums">{e.score}</span>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  const renderEvaluation = () => {
    if (signalsUnavailable) {
      return (
        <div className="flex flex-col items-center gap-2 py-10">
          <p className="text-[12px] text-ink-2">{zh ? '信号数据源不可达，无法评估。' : 'Signal source unreachable; cannot assess.'}</p>
          <button onClick={() => sig.reload()} className="text-[11px] px-3 py-1.5 rounded-md bg-accent-bg border border-accent text-accent hover:opacity-80 transition-opacity">
            {zh ? '重试' : 'Retry'}
          </button>
        </div>
      )
    }
    if (evaluation.count === 0) {
      return (
        <p className="text-[11px] text-muted py-8 text-center">
          {zh ? '数据不足：当前没有与该实体相关的信号。' : 'Insufficient data: no signals related to this entity.'}
        </p>
      )
    }
    return (
      <div className="space-y-4">
        <p className="text-[10px] text-dim">
          {zh ? '本页评估为机械统计口径，仅基于当前已聚合信号，不含语义判断。' : 'This assessment is a mechanical count over currently aggregated signals; no semantic judgement is applied.'}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <IntroValue label={zh ? '信号条数' : 'Signals'} value={String(evaluation.count)} />
          <IntroValue label={zh ? '平均可信度' : 'Avg credibility'} value={`${evaluation.avgCredibility.toFixed(2)}/5`} />
          <IntroValue label={zh ? '高价值信号' : 'High-value'} value={String(evaluation.highValue)} hint={zh ? 'importance ≥ 4' : 'importance ≥ 4'} />
          <IntroValue label={zh ? '最大单一来源占比' : 'Top source share'} value={`${(evaluation.topSourceShare * 100).toFixed(0)}%`} />
        </div>
        <div className="bg-card border border-edge rounded-lg px-3 py-2.5">
          <p className="text-[10px] text-muted uppercase tracking-wider">{zh ? '时间跨度' : 'Time span'}</p>
          <p className="mt-1 text-[12px] text-ink-2 font-mono">{spanText(evaluation, locale)}</p>
        </div>
        <div className="bg-card border border-edge rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-edge text-[10px] font-semibold text-muted uppercase tracking-wider">
            {zh ? '来源分布' : 'Source distribution'}
          </div>
          <ul className="divide-y divide-edge-50">
            {evaluation.sources.map(([name, n]) => (
              <li key={name} className="flex items-center gap-3 px-3 py-2 text-[11px]">
                <span className="text-ink-2 flex-1 truncate">{name}</span>
                <span className="flex-1 max-w-[180px] h-1.5 bg-hover rounded-full overflow-hidden">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round((n / evaluation.count) * 100)}%` }} />
                </span>
                <span className="font-mono text-muted tabular-nums w-10 text-right">{n}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-accent-bg-30 border border-accent-30 rounded-lg px-3 py-2.5">
          <p className="text-[10px] text-muted uppercase tracking-wider">{zh ? '结论' : 'Conclusion'}</p>
          <p className="mt-1 text-[12px] text-ink-2 leading-relaxed">{evaluation.conclusion}</p>
        </div>
      </div>
    )
  }

  const subjectLabel = kind === 'vendor' ? (zh ? '厂商档案' : 'Vendor profile') : (zh ? '模型档案' : 'Model profile')

  return (
    <div className="min-h-full">
      {crumb}

      {/* 档案头 */}
      <div className="px-4 pt-3 pb-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {vendor && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: vendor.color }} />}
              <h1 className="text-[20px] font-bold text-ink truncate">{entityName}</h1>
            </div>
            <p className="mt-1 text-[11px] text-muted font-mono">
              {subjectLabel}
              <span className="text-dim"> · </span>
              {kind === 'vendor'
                ? (vendorRow ? `${zh ? '命中关键词' : 'key'} ${vendorRow.bestKey}` : (zh ? '命中关键词 —' : 'key —'))
                : model && `${model.vendor} · ${model.type} · ${model.date}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/nexus?tab=research&focus=${encodeURIComponent(entityName)}`}
              className="text-[11px] px-3 py-1.5 rounded-md bg-accent-bg border border-accent text-accent hover:opacity-80 transition-opacity whitespace-nowrap"
            >
              {zh ? '用这个实体发起研究' : 'Research this entity'}
            </Link>
            <button
              onClick={toggleShortlist}
              className={`text-[11px] px-3 py-1.5 rounded-md border transition-colors whitespace-nowrap ${
                shortlisted ? 'bg-accent-bg border-accent text-accent' : 'border-edge text-muted hover:text-ink-2 hover:border-edge-light'
              }`}
            >
              {shortlisted ? (zh ? '★ 已关注' : '★ Following') : (zh ? '☆ 关注' : '☆ Follow')}
            </button>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex items-center gap-1 px-4 border-b border-edge">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[12px] -mb-px border-b-2 transition-colors ${
              tab === t.id ? 'border-accent text-accent font-medium' : 'border-transparent text-muted hover:text-ink-2'
            }`}
          >
            {zh ? t.zh : t.en}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {tab === 'overview' && renderOverview()}
        {tab === 'timeline' && (
          signalsUnavailable ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <p className="text-[12px] text-ink-2">{zh ? '信号数据源不可达，无法展示时间线。' : 'Signal source unreachable; timeline unavailable.'}</p>
              <button onClick={() => sig.reload()} className="text-[11px] px-3 py-1.5 rounded-md bg-accent-bg border border-accent text-accent hover:opacity-80 transition-opacity">
                {zh ? '重试' : 'Retry'}
              </button>
            </div>
          ) : <SignalTimeline list={timelineSignals} locale={locale} />
        )}
        {tab === 'related' && renderRelated()}
        {tab === 'evaluation' && renderEvaluation()}
      </div>
    </div>
  )
}
