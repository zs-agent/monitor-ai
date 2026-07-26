'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { type Locale } from '@/lib/i18n'
import { LEADERBOARD_INTL, LEADERBOARD_CN, BENCHMARK_SOURCE_INTL, BENCHMARK_SOURCE_CN, BENCHMARK_LATEST, type LeaderboardEntry } from '@/data/leaderboard'
import PanelBase from './PanelBase'

type View = 'intl' | 'cn'

function ScoreBar({ value, max }: { value: number | null; max: number }) {
  if (value === null) return <span className="text-[9px] text-[#3c3c52]">—</span>
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-10 h-1 bg-[#1e1e2e] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-[#06b6d4]' : pct > 80 ? 'bg-[#0891b2]' : 'bg-[#0e7490]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-[#8b8ba0] font-mono w-8 text-right">{value}</span>
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: 'bg-[#f59e0b] text-black',
    2: 'bg-[#8b8ba0] text-black',
    3: 'bg-[#a16207] text-white',
  }
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${colors[rank] || 'bg-[#1e1e2e] text-[#5c5c72]'}`}>
      {rank}
    </span>
  )
}

export default function LeaderboardPanel({ locale }: { locale: Locale }) {
  const [view, setView] = useState<View>('intl')
  const router = useRouter()
  const data = view === 'intl' ? LEADERBOARD_INTL : LEADERBOARD_CN
  const source = view === 'intl' ? BENCHMARK_SOURCE_INTL : BENCHMARK_SOURCE_CN
  const maxArena = Math.max(...data.map(d => d.arenaScore || 0))

  return (
    <PanelBase
      id="leaderboard"
      title={locale === 'zh' ? '大模型排行' : 'LLM Leaderboard'}
      dataBadge="static"
      dataBadgeDetail={BENCHMARK_LATEST}
      collapsible
    >
      {/* View tabs */}
      <div className="flex border-b border-[#1e1e2e]">
        <button
          onClick={() => setView('intl')}
          className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            view === 'intl' ? 'text-[#06b6d4] border-b border-[#06b6d4]' : 'text-[#5c5c72] hover:text-[#8b8ba0]'
          }`}
        >
          {locale === 'zh' ? '国际排行' : 'Global'}
        </button>
        <button
          onClick={() => setView('cn')}
          className={`flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
            view === 'cn' ? 'text-[#06b6d4] border-b border-[#06b6d4]' : 'text-[#5c5c72] hover:text-[#8b8ba0]'
          }`}
        >
          {locale === 'zh' ? '国内排行' : 'China'}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e1e2e] text-[#5c5c72]" style={{ position: 'sticky', top: 0, zIndex: 1, background: '#12121a' }}>
              <th className="w-8 py-1.5 text-center font-normal">#</th>
              <th className="text-left py-1.5 font-normal">{locale === 'zh' ? '模型' : 'Model'}</th>
              <th className="text-left py-1.5 font-normal hidden sm:table-cell">{locale === 'zh' ? '机构' : 'Org'}</th>
              <th className="text-right py-1.5 font-normal px-2">Arena</th>
              {view === 'cn' && (
                <>
                  <th className="text-right py-1.5 font-normal px-2 hidden md:table-cell">SCLUE</th>
                  <th className="text-right py-1.5 font-normal px-2 hidden md:table-cell">C-Eval</th>
                </>
              )}
              {view === 'intl' && (() => {
                const hasAnySCLUE = data.some(d => d.superClue !== null)
                return hasAnySCLUE ? <th className="text-right py-1.5 font-normal px-2 hidden md:table-cell">SCLUE</th> : null
              })()}
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.model} className="border-b border-[#1e1e2e]/50 hover:bg-[#16162a] transition-colors">
                <td className="py-1.5 text-center">
                  <RankBadge rank={entry.rank} />
                </td>
                <td className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1 h-1 rounded-full shrink-0 ${entry.country === 'CN' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                    <button
                      onClick={() => router.push(`/model/${encodeURIComponent(entry.model)}`)}
                      className="text-[#e5e5e5] hover:text-[#06b6d4] transition-colors truncate max-w-[140px] block text-left cursor-pointer"
                    >
                      {entry.model}
                    </button>
                  </div>
                  <div className="sm:hidden text-[9px] text-[#5c5c72]">{entry.organization} · {entry.params}</div>
                </td>
                <td className="py-1.5 text-[#5c5c72] hidden sm:table-cell">{entry.organization}</td>
                <td className="py-1.5 px-2 text-right">
                  <div className="inline-flex">
                    <ScoreBar value={entry.arenaScore} max={maxArena} />
                  </div>
                </td>
                {view === 'cn' && (
                  <>
                    <td className="py-1.5 px-2 text-right hidden md:table-cell">
                      <div className="inline-flex"><ScoreBar value={entry.superClue} max={100} /></div>
                    </td>
                    <td className="py-1.5 px-2 text-right hidden md:table-cell">
                      <div className="inline-flex"><ScoreBar value={entry.cEval} max={100} /></div>
                    </td>
                  </>
                )}
                {view === 'intl' && entry.superClue !== null && (
                  <td className="py-1.5 px-2 text-right hidden md:table-cell">
                    <div className="inline-flex"><ScoreBar value={entry.superClue} max={100} /></div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Source footer */}
      <div className="px-3 py-1.5 border-t border-[#1e1e2e] flex items-center justify-between text-[9px] text-[#5c5c72]">
        <span>{locale === 'zh' ? '数据来源' : 'Source'}: {source}</span>
        <span>{data.length} models</span>
      </div>
    </PanelBase>
  )
}
