'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import PanelBase from './PanelBase'
import { type ArenaBoard } from '@/data/arena'

interface Props {
  locale: Locale
}

interface ArenaResponse {
  state?: string
  fetchedAt?: string
  boards?: ArenaBoard[]
  staticBoards?: ArenaBoard[]
  note?: string
}

export default function ArenaPanel({ locale }: Props) {
  const [boards, setBoards] = useState<ArenaBoard[]>([])
  const [staticBoards, setStaticBoards] = useState<ArenaBoard[]>([])
  const [state, setState] = useState('static')
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dimension, setDimension] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const load = () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true); setError(null)
    fetch('/api/arena', { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<ArenaResponse> })
      .then(d => {
        if (ctrl.signal.aborted) return
        setBoards(d.boards || [])
        setStaticBoards(d.staticBoards || [])
        setState(d.state || 'static')
        setFetchedAt(d.fetchedAt || null)
        setLoading(false)
      })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
  }

  useEffect(() => { load(); return () => abortRef.current?.abort() }, [])

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
      onRetry={load}
      className="flex flex-col h-full"
    >
      {!error && (
        <div className="flex flex-col min-h-0 flex-1">
          {/* 维度切换 */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1.5 border-b border-[var(--border)] overflow-x-auto">
            {allBoards.map(b => {
              const t = sourceTag(b)
              return (
                <button
                  key={b.dimension}
                  onClick={() => setDimension(b.dimension)}
                  className={`px-2 py-1 text-[11px] rounded-md whitespace-nowrap transition-colors flex items-center gap-1 ${
                    dimension === b.dimension ? 'bg-[var(--accent-bg)] text-[var(--accent)] font-medium' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--hover-overlay)]'
                  }`}
                >
                  {locale === 'zh' ? b.dimension : DIMENSION_EN[b.dimension] || b.dimension}
                  <span className={`text-[8px] px-1 rounded ${t === 'AA' ? 'bg-[var(--accent-bg)] text-[var(--accent)]' : t === 'HF' ? 'bg-[#34d399]/10 text-[#34d399]' : t === 'PENDING' ? 'bg-[var(--bg-hover)] text-[var(--text-dim)]' : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'}`}>{t}</span>
                </button>
              )
            })}
          </div>

          {/* 口径说明 */}
          <div className="px-4 py-2 border-b border-[var(--border)]/60 bg-[var(--bg-card-2)]/50">
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--text-secondary)] font-medium">{locale === 'zh' ? '评测来源' : 'Source'}: {board?.source}</span>
              <span className="w-px h-3 bg-[var(--border)]" />
              <span>{locale === 'zh' ? '时间' : 'Date'}: {board?.date}</span>
              <span className="w-px h-3 bg-[var(--border)]" />
              <span className={tag === 'AA' || tag === 'HF' ? 'text-[var(--accent)]' : tag === 'PENDING' ? 'text-[var(--text-dim)]' : ''}>{tag === 'AA' || tag === 'HF' ? '动态' : tag === 'PENDING' ? (locale === 'zh' ? '待接入' : 'pending') : 'REF'}</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{locale === 'zh' ? '口径' : 'Method'}: {board?.methodology}</p>
          </div>

          {/* 榜单 */}
          <div className="p-3 overflow-y-auto min-h-0 flex-1">
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-7 bg-[var(--bg-hover)] rounded animate-pulse" />)}</div>
            ) : !board || board.entries.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <span className="text-2xl mb-2 opacity-30">◇</span>
                <p className="text-[12px] text-[var(--text-muted)]">{locale === 'zh' ? '当前维度暂无数据' : 'No data for this dimension'}</p>
              </div>
            ) : (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    <th className="py-1.5 pr-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] w-8">#</th>
                    <th className="py-1.5 pr-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)]">{locale === 'zh' ? '模型' : 'Model'}</th>
                    <th className="py-1.5 pr-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] hidden sm:table-cell">{locale === 'zh' ? '厂商' : 'Org'}</th>
                    <th className="py-1.5 text-right text-[9px] uppercase tracking-wider text-[var(--text-muted)]">{locale === 'zh' ? '成绩' : 'Score'}</th>
                  </tr>
                </thead>
                <tbody>
                  {board.entries.slice(0, 12).map(e => (
                    <tr key={`${board.dimension}-${e.rank}-${e.model}`} className="border-b border-[var(--border)]/40">
                      <td className="py-1.5 pr-2 font-mono text-[var(--text-muted)]">{e.rank}</td>
                      <td className="py-1.5 pr-2">
                        <div className="text-[var(--text-primary)] font-medium truncate max-w-[180px]">{e.model}</div>
                        {e.note && <div className="text-[9px] text-[var(--text-muted)]">{e.note}</div>}
                      </td>
                      <td className="py-1.5 pr-2 text-[var(--text-secondary)] hidden sm:table-cell">{e.organization}</td>
                      <td className="py-1.5 text-right font-mono text-[var(--accent)] font-semibold whitespace-nowrap">{e.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 维度速览：9 维第一（填满剩余高度） */}
          {allBoards.length > 0 && (
            <div className="border-t border-[var(--border)] px-3 py-2 shrink-0">
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{locale === 'zh' ? '各维度领先' : 'Dimension leaders'}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {allBoards.map(b => {
                  const top = b.entries[0]
                  if (!top) return null
                  return (
                    <div key={b.dimension} className="bg-[var(--bg-card)] rounded-md px-2 py-1.5 min-w-0">
                      <div className="text-[9px] text-[var(--text-muted)] truncate">{locale === 'zh' ? b.dimension : (DIMENSION_EN[b.dimension] || b.dimension)}</div>
                      <div className="text-[10px] text-[var(--text-primary)] font-medium truncate" title={top.model}>{top.model}</div>
                      <div className="text-[9px] font-mono text-[var(--accent)] truncate">{top.score}</div>
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
