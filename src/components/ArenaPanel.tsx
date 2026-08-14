'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { useRemoteData } from '@/lib/use-remote-data'
import PanelBase from './PanelBase'
import CredibilityTag from './CredibilityTag'
import { isFavorite, toggleFavorite } from '@/lib/favorites'
import { type ArenaBoard } from '@/data/arena'

interface Props {
  locale: Locale
  focus?: { model: string; dim?: string; ts: number } | null
}

interface ArenaResponse {
  state?: string
  fetchedAt?: string
  boards?: ArenaBoard[]
  staticBoards?: ArenaBoard[]
  note?: string
}

export default function ArenaPanel({ locale, focus }: Props) {
  const { data, loading, error, reload } = useRemoteData<ArenaResponse>('/api/arena', [], { refreshInterval: 5 * 60 * 1000 })
  const boards = useMemo(() => data?.boards ?? [], [data])
  const staticBoards = useMemo(() => data?.staticBoards ?? [], [data])
  const state = data?.state || 'static'
  const fetchedAt = data?.fetchedAt || null
  const [dimension, setDimension] = useState('')
  const [compare, setCompare] = useState<Set<string>>(new Set())
  const [favVer, setFavVer] = useState(0)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const favKey = (m: string) => `arena:${m}`

  // 综合搜索点击模型联动：切维度并高亮 6 秒（只响应 focus.ts，避免父级重渲染重复触发）
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!focus) return
    if (focus.dim) setDimension(focus.dim)
    setHighlight(focus.model)
    const t = setTimeout(() => setHighlight(null), 6000)
    return () => clearTimeout(t)
  }, [focus?.ts])
  /* eslint-enable react-hooks/exhaustive-deps */

  const toggleCompare = (model: string) => {
    setCompare(prev => {
      const next = new Set(prev)
      if (next.has(model)) next.delete(model)
      else {
        if (next.size >= 4) return prev // 最多对比 4 个
        next.add(model)
      }
      return next
    })
  }

  const allBoards = useMemo(() => {
    // 动态接口完整返回 9 维时直接用；全挂时兑底静态快照（标注 REF）
    if (boards.length > 0) return boards
    return staticBoards
  }, [boards, staticBoards])

  const sourceTag = (b: ArenaBoard): 'AA' | 'HF' | 'PENDING' | 'REF' => {
    if (b.entries.length === 0 && b.source === '待接入') return 'PENDING'
    if (b.source.includes('Artificial Analysis')) return 'AA'
    if (b.source.includes('HuggingFace')) return 'HF'
    return 'REF'
  }

  // 默认选中第一个动态维度
  useEffect(() => { if (!dimension && allBoards.length > 0) setDimension(allBoards[0].dimension) }, [allBoards, dimension])

  // 切换维度时收起展开状态（新维度默认只看前 12）
  useEffect(() => { setShowAll(false) }, [dimension])

  const board = allBoards.find(b => b.dimension === dimension) || allBoards[0]
  const tag = board ? sourceTag(board) : 'REF'

  const badge = state === 'live' ? 'live' : state === 'cached' ? 'cached' : 'static'

  return (
    <PanelBase
      id="model-arena"
      title={locale === 'zh' ? '模型竞技场' : 'Model Arena'}
      dataBadge={badge}
      dataBadgeDetail={fetchedAt ? fetchedAt.slice(0, 10) : undefined}
      count={allBoards.length}
      error={error}
      onRetry={reload}
      className="flex flex-col h-full"
    >
      {!error && (
        <div className="flex flex-col min-h-0 flex-1">
          {/* 维度切换 */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1.5 border-b border-edge overflow-x-auto">
            {allBoards.map(b => {
              const t = sourceTag(b)
              return (
                <button
                  key={b.dimension}
                  onClick={() => setDimension(b.dimension)}
                  className={`px-2 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors flex items-center gap-1 ${
                    dimension === b.dimension ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'
                  }`}
                >
                  {locale === 'zh' ? b.dimension : DIMENSION_EN[b.dimension] || b.dimension}
                  <span className={`text-[8px] px-1 rounded ${t === 'AA' ? 'bg-accent-bg text-accent' : t === 'HF' ? 'bg-[#34d399]/10 text-[#34d399]' : t === 'PENDING' ? 'bg-hover text-dim' : 'bg-hover text-muted'}`}>{t}</span>
                </button>
              )
            })}
          </div>

          {/* 口径说明 */}
          <div className="px-4 py-2 border-b border-edge-60 bg-card-2-50">
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted">
              <CredibilityTag level={board && board.entries.length > 0 ? 'high' : 'low'} locale={locale} />
              <span className="text-ink-2 font-medium">{locale === 'zh' ? '评测来源' : 'Source'}: {board?.source}</span>
              <span className="w-px h-3 bg-edge" />
              <span>{locale === 'zh' ? '时间' : 'Date'}: {board?.date}</span>
              <span className="w-px h-3 bg-edge" />
              <span className={tag === 'AA' || tag === 'HF' ? 'text-accent' : tag === 'PENDING' ? 'text-dim' : ''}>{tag === 'AA' || tag === 'HF' ? '动态' : tag === 'PENDING' ? (locale === 'zh' ? '待接入' : 'pending') : 'REF'}</span>
            </div>
            <p className="text-[10px] text-muted mt-0.5">{locale === 'zh' ? '口径' : 'Method'}: {board?.methodology}</p>
            <p className="text-[9px] text-dim mt-0.5">⚠ {locale === 'zh' ? '各维度分数口径不同（Elo/指数/成功率/下载量），横向比较请以排名为准' : 'Scores use different metrics (Elo/index/success rate/downloads); compare by rank'}</p>
          </div>

          {/* 对比条（勾选 ≥1 时显示） */}
          {compare.size > 0 && (
            <div className="px-3 py-2 border-b border-edge-60 bg-accent-bg-40">
              <div className="text-[9px] uppercase tracking-wider text-muted mb-1">{locale === 'zh' ? `对比（${board?.dimension || ''}）` : 'Compare'}</div>
              <div className="flex gap-2 flex-wrap">
                {Array.from(compare).map(m => {
                  const e = board?.entries.find(x => x.model === m)
                  return (
                    <div key={m} className="bg-card border border-edge rounded px-2 py-1 text-[10px] flex items-center gap-1.5">
                      <span className="text-ink truncate max-w-[120px]">{m}</span>
                      <span className="font-mono text-accent">{e?.score || '—'}</span>
                      <button onClick={() => toggleCompare(m)} className="text-muted hover:text-danger">×</button>
                    </div>
                  )
                })}
                <button onClick={() => setCompare(new Set())} className="text-[9px] text-muted hover:text-ink-2 underline">{locale === 'zh' ? '清空' : 'Clear'}</button>
              </div>
            </div>
          )}

          {/* 榜单 */}
          <div className="p-3 overflow-y-auto min-h-0 flex-1">
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-7 bg-hover rounded animate-pulse" />)}</div>
            ) : !board || board.entries.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="text-2xl mb-2 opacity-30">◇</span>
                <p className="text-[12px] text-muted">{locale === 'zh' ? '当前维度暂无数据' : 'No data for this dimension'}</p>
              </div>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-edge text-left">
                    <th className="py-1.5 pr-1 text-[9px] uppercase tracking-wider text-muted w-6"></th>
                    <th className="py-1.5 pr-2 text-[9px] uppercase tracking-wider text-muted w-8">#</th>
                    <th className="py-1.5 pr-2 text-[9px] uppercase tracking-wider text-muted">{locale === 'zh' ? '模型' : 'Model'}</th>
                    <th className="py-1.5 pr-2 text-[9px] uppercase tracking-wider text-muted hidden sm:table-cell">{locale === 'zh' ? '厂商' : 'Org'}</th>
                    <th className="py-1.5 text-right text-[9px] uppercase tracking-wider text-muted">{locale === 'zh' ? '成绩' : 'Score'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(showAll ? board.entries : board.entries.slice(0, 12)).map(e => {
                    const checked = compare.has(e.model)
                    const hl = highlight === e.model
                    return (
                    <tr key={`${board.dimension}-${e.rank}-${e.model}`} className={`border-b border-edge-40 ${checked || hl ? 'bg-accent-bg-30' : ''}`}>
                      <td className="py-1.5 pr-1">
                        {hl && <span className="text-[10px] text-accent mr-1">▶</span>}
                        <button onClick={() => toggleCompare(e.model)}
                          className={`text-[12px] leading-none ${checked ? 'text-accent' : 'text-dim hover:text-ink-2'}`}
                          title={locale === 'zh' ? '加入对比' : 'Compare'}>
                          {checked ? '☑' : '☐'}
                        </button>
                      </td>
                      <td className={`py-1.5 pr-2 font-mono ${e.rank <= 3 ? 'text-accent font-bold' : 'text-muted'}`}>{e.rank}</td>
                      <td className="py-1.5 pr-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => { toggleFavorite(favKey(e.model)); setFavVer(v => v + 1) }}
                            className={`text-[13px] leading-none shrink-0 ${isFavorite(favKey(e.model)) ? 'text-warning' : 'text-dim hover:text-warning'}`}
                            title={locale === 'zh' ? '关注' : 'Follow'}>
                            {isFavorite(favKey(e.model)) ? '★' : '☆'}
                          </button>
                          <span className="text-ink font-medium truncate max-w-[150px]">{e.model}</span>
                        </div>
                        {e.note && <div className="text-[9px] text-muted">{e.note}</div>}
                      </td>
                      <td className="py-1.5 pr-2 text-ink-2 hidden sm:table-cell">{e.organization}</td>
                      <td className="py-1.5 text-right font-mono text-accent font-semibold whitespace-nowrap">{e.score}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            )}
          </div>

          {/* 展开 / 收起（仅当超过 12 名时显示） */}
          {board && board.entries.length > 12 && (
            <div className="px-3 py-1.5 border-t border-edge shrink-0 flex items-center justify-center">
              <button
                onClick={() => setShowAll(v => !v)}
                className="text-[10px] px-2.5 py-1 rounded border border-edge-light text-muted hover:text-accent hover:border-accent-40 transition-colors"
              >
                {showAll
                  ? (locale === 'zh' ? '收起（仅显示前 12 名）' : 'Collapse (top 12 only)')
                  : (locale === 'zh' ? `显示全部 ${board.entries.length} 名` : `Show all ${board.entries.length} models`)}
              </button>
            </div>
          )}

          {/* 维度速览：9 维第一（填满剩余高度） */}
          {allBoards.length > 0 && (
            <div className="border-t border-edge px-3 py-2 shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-muted mb-1.5">{locale === 'zh' ? '各维度领先' : 'Dimension leaders'}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {allBoards.map(b => {
                  const top = b.entries[0]
                  if (!top) return null
                  return (
                    <div key={b.dimension} className="bg-card rounded-md px-2 py-1.5 min-w-0">
                      <div className="text-[9px] text-muted truncate">{locale === 'zh' ? b.dimension : (DIMENSION_EN[b.dimension] || b.dimension)}</div>
                      <div className="text-[10px] text-ink font-medium truncate" title={top.model}>{top.model}</div>
                      <div className="text-[9px] font-mono text-accent truncate">{top.score}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </PanelBase>
  )
}

const DIMENSION_EN: Record<string, string> = {
  '综合能力': 'Overall', '编程能力': 'Coding', 'Agent 工具调用': 'Agent Tools', '推理能力': 'Reasoning',
  '长上下文': 'Long Context', '推理速度': 'Speed', 'API 成本': 'API Cost', '本地部署友好度': 'Local Deploy',
}
