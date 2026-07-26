'use client'

import { useParams, useRouter } from 'next/navigation'
import { LEADERBOARD_INTL, LEADERBOARD_CN, type LeaderboardEntry } from '@/data/leaderboard'
import { mockSignals } from '@/data/mock-signals'
import { useState, useEffect, useMemo } from 'react'
import { getLocale, type Locale } from '@/lib/i18n'

function findModel(name: string): LeaderboardEntry | undefined {
  const decoded = decodeURIComponent(name)
  return LEADERBOARD_INTL.find(m => m.model === decoded) || LEADERBOARD_CN.find(m => m.model === decoded)
}

export default function ModelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>('en')
  const name = typeof params.name === 'string' ? params.name : ''

  useEffect(() => {
    setLocale(getLocale())
  }, [])

  const model = findModel(name)
  const relatedSignals = useMemo(() => {
    if (!model) return []
    const keywords = model.model.toLowerCase().split(/[\s()]/).filter(Boolean)
    return mockSignals
      .filter(s => {
        const text = `${s.title} ${s.summary} ${s.tags.join(' ')}`.toLowerCase()
        return keywords.some(kw => kw.length > 2 && text.includes(kw))
      })
      .slice(0, 5)
  }, [model])
  if (!model) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-[#5c5c72]">
        <div className="text-center">
          <div className="text-2xl mb-3">◇</div>
          <p className="text-sm">Model not found</p>
          <button onClick={() => router.push('/')} className="mt-4 text-[11px] text-[#06b6d4] hover:underline">
            ← Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Top bar */}
      <nav className="h-11 flex items-center px-4 border-b border-[#1e1e2e] bg-[#0c0c14]">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-[11px] text-[#5c5c72] hover:text-[#8b8ba0] transition-colors">
          <span>←</span>
          <span className="text-sm font-bold">
            <span className="text-[#06b6d4]">monitor</span><span className="text-[#e5e5e5]">.ai</span>
          </span>
        </button>
        <span className="ml-auto text-[10px] text-[#5c5c72]">{locale === 'zh' ? '模型详情' : 'Model Detail'}</span>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full p-6 space-y-6">
        {/* Hero */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-[#f59e0b]">#{model.rank}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${model.country === 'CN' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                <span className="text-[10px] text-[#5c5c72]">{model.country}</span>
              </div>
              <h1 className="text-lg font-bold text-[#e5e5e5]">{model.model}</h1>
              <p className="text-sm text-[#06b6d4] mt-1">{model.organization}</p>
            </div>
            <a href={model.url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-3 py-1.5 rounded-lg bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20 hover:bg-[#06b6d4]/20 transition-colors">
              {locale === 'zh' ? '官网 →' : 'Website →'}
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-[#0c0c14] rounded-lg p-3">
              <div className="text-[9px] text-[#5c5c72] mb-1">Arena Score</div>
              <div className="text-lg font-bold text-[#06b6d4]">{model.arenaScore ?? '—'}</div>
            </div>
            <div className="bg-[#0c0c14] rounded-lg p-3">
              <div className="text-[9px] text-[#5c5c72] mb-1">MMLU</div>
              <div className="text-lg font-bold text-[#e5e5e5]">{model.mmlu ?? '—'}</div>
            </div>
            <div className="bg-[#0c0c14] rounded-lg p-3">
              <div className="text-[9px] text-[#5c5c72] mb-1">SuperCLUE</div>
              <div className="text-lg font-bold text-[#e5e5e5]">{model.superClue ?? '—'}</div>
            </div>
            <div className="bg-[#0c0c14] rounded-lg p-3">
              <div className="text-[9px] text-[#5c5c72] mb-1">C-Eval</div>
              <div className="text-lg font-bold text-[#e5e5e5]">{model.cEval ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* Detailed info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b8ba0] mb-3">{locale === 'zh' ? '基本信息' : 'Basic Info'}</h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between"><span className="text-[#5c5c72]">{locale === 'zh' ? '发布日期' : 'Release'}</span><span className="text-[#e5e5e5]">{model.releaseDate}</span></div>
              <div className="flex justify-between"><span className="text-[#5c5c72]">{locale === 'zh' ? '参数量' : 'Params'}</span><span className="text-[#e5e5e5]">{model.params}</span></div>
              <div className="flex justify-between"><span className="text-[#5c5c72]">{locale === 'zh' ? '研发机构' : 'Organization'}</span><span className="text-[#e5e5e5]">{model.organization}</span></div>
              <div className="flex justify-between"><span className="text-[#5c5c72]">{locale === 'zh' ? '国家/地区' : 'Country'}</span><span className="text-[#e5e5e5]">{model.country === 'CN' ? 'China' : 'United States'}</span></div>
            </div>
          </div>

          <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b8ba0] mb-3">{locale === 'zh' ? '性能概览' : 'Performance'}</h3>
            {model.arenaScore != null && (
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1"><span className="text-[#5c5c72]">Arena Score</span><span className="text-[#06b6d4] font-mono">{model.arenaScore}</span></div>
                <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#06b6d4]/60 to-[#06b6d4] rounded-full" style={{ width: `${(model.arenaScore / 65) * 100}%` }} />
                </div>
              </div>
            )}
            {model.superClue != null && (
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1"><span className="text-[#5c5c72]">SuperCLUE</span><span className="text-[#e5e5e5] font-mono">{model.superClue}</span></div>
                <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#f59e0b]/60 to-[#f59e0b] rounded-full" style={{ width: `${model.superClue}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Signals */}
        <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b8ba0] mb-3">
            {locale === 'zh' ? '相关信号' : 'Related Signals'}
          </h3>
          {relatedSignals.length === 0 ? (
            <p className="text-[11px] text-[#5c5c72]">{locale === 'zh' ? '暂无相关信号' : 'No related signals'}</p>
          ) : (
            <div className="space-y-2">
              {relatedSignals.map(s => (
                <div key={s.id} className="border border-[#1e1e2e] rounded-lg px-3 py-2 hover:border-[#06b6d4]/20 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${s.language === 'zh' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#e5e5e5]">{s.title}</p>
                      <p className="text-[9px] text-[#5c5c72] mt-0.5">{s.source} · {s.category} · {s.importance}/5</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="h-7 flex items-center justify-between px-4 border-t border-[#1e1e2e] bg-[#0c0c14] text-[10px] text-[#5c5c72]">
        <span className="font-mono">monitor.ai v0.1.0</span>
        <span>{locale === 'zh' ? '数据来源' : 'Source'}: Artificial Analysis · {new Date().toISOString().slice(0, 10)}</span>
      </footer>
    </div>
  )
}
