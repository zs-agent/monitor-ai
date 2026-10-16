'use client'

import { useParams, useRouter } from 'next/navigation'
import { LEADERBOARD_INTL, LEADERBOARD_CN, type LeaderboardEntry } from '@/data/leaderboard'
import { useRemoteData } from '@/lib/use-remote-data'
import type { Signal } from '@/types/signal'
import { useState, useEffect, useMemo } from 'react'
import { getLocale, type Locale } from '@/lib/i18n'

function findModel(name: string): LeaderboardEntry | undefined {
  // useParams already decodes route segments; decoding again can throw on '%'.
  const decoded = name
  return LEADERBOARD_INTL.find(m => m.model === decoded) || LEADERBOARD_CN.find(m => m.model === decoded)
}

export default function ModelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [locale, setLocale] = useState<Locale>('en')
  const name = typeof params.name === 'string' ? params.name : ''
  const { data: signalData } = useRemoteData<{ signals?: Signal[] }>(`/api/signals?locale=${locale}&category=all`)

  useEffect(() => {
    setLocale(getLocale())
  }, [])

  const model = findModel(name)
  const relatedSignals = useMemo(() => {
    if (!model) return []
    const keywords = model.model.toLowerCase().split(/[\s()]/).filter(Boolean)
    return (signalData?.signals || [])
      .filter(s => {
        const text = `${s.title} ${s.summary} ${s.tags.join(' ')}`.toLowerCase()
        return keywords.some(kw => kw.length > 2 && text.includes(kw))
      })
      .slice(0, 5)
  }, [model, signalData])
  if (!model) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center text-muted">
        <div className="text-center">
          <div className="text-2xl mb-3">◇</div>
          <p className="text-sm">Model not found</p>
          <button onClick={() => router.push('/')} className="mt-4 text-[11px] text-accent hover:underline">
            ← Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base flex flex-col">
      {/* Top bar */}
      <nav className="h-11 flex items-center px-4 border-b border-edge bg-sidebar">
        <button onClick={() => router.push('/')} className="flex items-center gap-2 text-[11px] text-muted hover:text-ink-2 transition-colors">
          <span>←</span>
          <span className="text-sm font-bold">
            <span className="text-accent">monitor</span><span className="text-ink">.ai</span>
          </span>
        </button>
        <span className="ml-auto text-[10px] text-muted">{locale === 'zh' ? '模型详情' : 'Model Detail'}</span>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full p-6 space-y-6">
        <p className="text-[11px] text-muted">{locale === 'zh' ? '模型档案与指标为预置资料快照；关联动态来自当前监测资料，不代表实时模型测评。' : 'Model metrics are reference snapshots; related signals come from current monitoring, not a live model evaluation.'}</p>
        {/* Hero */}
        <div className="bg-card border border-edge rounded-xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-[#f59e0b]">#{model.rank}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${model.country === 'CN' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                <span className="text-[10px] text-muted">{model.country}</span>
              </div>
              <h1 className="text-lg font-bold text-ink">{model.model}</h1>
              <p className="text-sm text-accent mt-1">{model.organization}</p>
            </div>
            <a href={model.url} target="_blank" rel="noopener noreferrer" className="text-[10px] px-3 py-1.5 rounded-lg bg-[#06b6d4]/10 text-accent border border-[#06b6d4]/20 hover:bg-[#06b6d4]/20 transition-colors">
              {locale === 'zh' ? '官网 →' : 'Website →'}
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <div className="bg-sidebar rounded-lg p-3">
              <div className="text-[9px] text-muted mb-1">Arena Score</div>
              <div className="text-lg font-bold text-accent">{model.arenaScore ?? '—'}</div>
            </div>
            <div className="bg-sidebar rounded-lg p-3">
              <div className="text-[9px] text-muted mb-1">MMLU</div>
              <div className="text-lg font-bold text-ink">{model.mmlu ?? '—'}</div>
            </div>
            <div className="bg-sidebar rounded-lg p-3">
              <div className="text-[9px] text-muted mb-1">SuperCLUE</div>
              <div className="text-lg font-bold text-ink">{model.superClue ?? '—'}</div>
            </div>
            <div className="bg-sidebar rounded-lg p-3">
              <div className="text-[9px] text-muted mb-1">C-Eval</div>
              <div className="text-lg font-bold text-ink">{model.cEval ?? '—'}</div>
            </div>
          </div>
        </div>

        {/* Detailed info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card border border-edge rounded-xl p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-2 mb-3">{locale === 'zh' ? '基本信息' : 'Basic Info'}</h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between"><span className="text-muted">{locale === 'zh' ? '发布日期' : 'Release'}</span><span className="text-ink">{model.releaseDate}</span></div>
              <div className="flex justify-between"><span className="text-muted">{locale === 'zh' ? '参数量' : 'Params'}</span><span className="text-ink">{model.params}</span></div>
              <div className="flex justify-between"><span className="text-muted">{locale === 'zh' ? '机构' : 'Organization'}</span><span className="text-ink">{model.organization}</span></div>
              <div className="flex justify-between"><span className="text-muted">{locale === 'zh' ? '国家/地区' : 'Country'}</span><span className="text-ink">{model.country === 'CN' ? 'China' : 'United States'}</span></div>
            </div>
          </div>

          <div className="bg-card border border-edge rounded-xl p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-2 mb-3">{locale === 'zh' ? '性能概览' : 'Performance'}</h3>
            {model.arenaScore != null && (
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1"><span className="text-muted">Arena Score</span><span className="text-accent font-mono">{model.arenaScore}</span></div>
                <div className="h-2 bg-hover rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#06b6d4]/60 to-[#06b6d4] rounded-full" style={{ width: `${(model.arenaScore / 65) * 100}%` }} />
                </div>
              </div>
            )}
            {model.superClue != null && (
              <div className="mb-3">
                <div className="flex justify-between text-[10px] mb-1"><span className="text-muted">SuperCLUE</span><span className="text-ink font-mono">{model.superClue}</span></div>
                <div className="h-2 bg-hover rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#f59e0b]/60 to-[#f59e0b] rounded-full" style={{ width: `${model.superClue}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Signals */}
        <div className="bg-card border border-edge rounded-xl p-5">
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-2 mb-3">
            {locale === 'zh' ? '相关信号' : 'Related Signals'}
          </h3>
          {relatedSignals.length === 0 ? (
            <p className="text-[11px] text-muted">{locale === 'zh' ? '暂无相关信号' : 'No related signals'}</p>
          ) : (
            <div className="space-y-2">
              {relatedSignals.map(s => (
                <div key={s.id} className="border border-edge rounded-lg px-3 py-2 hover:border-[#06b6d4]/20 transition-colors">
                  <div className="flex items-start gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${s.language === 'zh' ? 'bg-amber-400' : 'bg-cyan-400'}`} />
                    <div className="min-w-0">
                      <p className="text-[11px] text-ink">{s.title}</p>
                      <p className="text-[9px] text-muted mt-0.5">{s.source} · {s.category} · {s.importance}/5</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="h-7 flex items-center justify-between px-4 border-t border-edge bg-sidebar text-[10px] text-muted">
        <span className="font-mono">monitor.ai v0.1.0</span>
        <span>{locale === 'zh' ? '数据来源' : 'Source'}: Artificial Analysis · {new Date().toISOString().slice(0, 10)}</span>
      </footer>
    </div>
  )
}
