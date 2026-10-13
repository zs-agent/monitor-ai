'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import PanelBase from './PanelBase'
import type { BrowseCounts } from '@/lib/browse-view'
import type { InsightsSnapshot } from '@/lib/insights/types'

interface Props {
  locale: Locale
  /** 供精选标题点击时匹配完整信号对象（复用页面已有的详情抽屉） */
  signals?: Signal[]
  onSignalClick?: (s: Signal) => void
  /** 模块标头已承担标题与控件时用：整块面板头去掉（避免留一条只有圆点的空栏） */
  bare?: boolean
  /** 模块标头的 ⟳：外层递一个自增数字触发重新生成（首帧不触发） */
  refreshNonce?: number
  /** 上报生成中状态，供模块标头的 ⟳ 显示进行中 */
  onRefreshingChange?: (refreshing: boolean) => void
  /** 分类下钻：把该分类的支撑信号交给「情报检索」视图看（结论 → 证据链） */
  onDrillDown?: (category: string) => void
  /** 检索规模：三个维度各有多少可挖，展示为「证据链」入口 */
  evidence?: BrowseCounts | null
  onOpenRetrieval?: () => void
}

const CATEGORY_LABEL: Record<string, [en: string, zh: string]> = {
  models: ['Models', '模型'],
  products: ['Products', '产品'],
  industry: ['Industry', '行业'],
  papers: ['Papers', '论文'],
  tips: ['Tips', '实战'],
}

const CATEGORY_COLOR: Record<string, string> = {
  models: '#06b6d4',
  products: '#34d399',
  industry: '#f59e0b',
  papers: '#a78bfa',
  tips: '#f472b6',
}

export default function InsightsPanel({ locale, signals, onSignalClick, bare = false, refreshNonce = 0, onRefreshingChange, onDrillDown, evidence = null, onOpenRetrieval }: Props) {
  const [snapshot, setSnapshot] = useState<InsightsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback((force = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    if (force) setRefreshing(true)
    else setLoading(true)
    setError(null)

    fetch(`/api/insights?locale=${locale}`, {
      method: force ? 'POST' : 'GET',
      signal: ctrl.signal,
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<InsightsSnapshot> })
      .then(d => {
        if (ctrl.signal.aborted) return
        setSnapshot(d)
        setLoading(false)
        setRefreshing(false)
      })
      .catch(e => {
        if (e.name === 'AbortError') return
        setError(e.message)
        setLoading(false)
        setRefreshing(false)
      })
  }, [locale])

  useEffect(() => { load(); return () => abortRef.current?.abort() }, [load])

  // 洞察自动刷新：页面可见期间每 5 分钟后台重拉（已有快照时不清 loading，不闪烁）
  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load(false) }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [load])

  // 模块标头的 ⟳：外层递自增数字触发重新生成（首帧不触发）
  const lastRefreshRef = useRef(refreshNonce)
  useEffect(() => {
    if (refreshNonce === lastRefreshRef.current) return
    lastRefreshRef.current = refreshNonce
    load(true)
  }, [refreshNonce, load])

  useEffect(() => { onRefreshingChange?.(refreshing) }, [refreshing, onRefreshingChange])

  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    return d.toLocaleTimeString(locale === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <PanelBase
      id="ai-insights"
      title={locale === 'zh' ? '今日 AI 洞察' : 'AI Insights'}
      severity="none"
      count={snapshot?.insights.filter(i => i.text).length}
      loading={loading && !snapshot}
      error={error}
      onRetry={() => load(false)}
      className="h-full"
      bare={bare}
      headerExtra={bare ? undefined : (
        <button
          className="panel-btn"
          onClick={() => load(true)}
          disabled={refreshing}
          title={locale === 'zh' ? '重新生成' : 'Regenerate'}
        >
          {refreshing ? '…' : '⟳'}
        </button>
      )}
    >
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!snapshot ? (
          <div className="flex flex-col items-center justify-center py-8 text-[10px] text-muted">
            <span className="text-[24px] mb-2 opacity-30">✧</span>
            <span>{locale === 'zh' ? '暂无洞察' : 'No insights yet'}</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {snapshot.insights.map(insight => {
              const label = CATEGORY_LABEL[insight.category]
              const color = CATEGORY_COLOR[insight.category]
              const hasText = insight.text.length > 0
              return (
                <div
                  key={insight.category}
                  className="px-3 py-2.5 border-b border-edge-50 hover:bg-hover transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    <span className="text-[10px] font-semibold" style={{ color }}>
                      {locale === 'zh' ? label[1] : label[0]}
                    </span>
                    <span className="text-[9px] text-muted">
                      {locale === 'zh' ? `基于 ${insight.coveredCount} 条信号` : `based on ${insight.coveredCount} signals`}
                    </span>
                    {onDrillDown && insight.coveredCount > 0 && (
                      <button
                        onClick={() => onDrillDown(insight.category)}
                        title={locale === 'zh' ? '在情报检索里按该分类看支撑信号' : 'See the supporting signals in retrieval'}
                        className="ml-auto text-[9px] text-accent hover:opacity-80 transition-opacity whitespace-nowrap"
                      >
                        {locale === 'zh' ? '支撑信号 ▸' : 'Signals ▸'}
                      </button>
                    )}
                  </div>
                  {hasText ? (
                    <p className="text-[11px] leading-relaxed text-ink">{insight.text}</p>
                  ) : insight.signalTitles && insight.signalTitles.length > 0 ? (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[8px] px-1 py-px rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
                          {locale === 'zh' ? '高价值精选' : 'High-value'}
                        </span>
                      </div>
                      <ul className="flex flex-col gap-0.5">
                        {insight.signalTitles.map((title, i) => {
                          const matched = signals?.find(s => s.title === title)
                          return (
                            <li key={i}>
                              <button
                                onClick={() => matched && onSignalClick?.(matched)}
                                disabled={!matched}
                                className={`text-[11px] w-full text-left truncate ${
                                  matched
                                    ? 'text-ink hover:text-accent transition-colors cursor-pointer'
                                    : 'text-muted cursor-default'
                                }`}
                                title={title}
                              >
                                <span className="text-dim mr-1.5">▸</span>{title}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ) : insight.coveredCount > 0 ? (
                    <p className="text-[11px] text-muted italic">
                      {locale === 'zh' ? '均为常规动态，全量见右侧时间轴' : 'Routine signals only — see timeline'}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted italic">
                      {locale === 'zh' ? '该类别暂无信号' : 'No signals in this category'}
                    </p>
                  )}
                </div>
              )
            })}
            {/* 证据链入口吸附在面板底部：列表再长也不会把它挤出视野 */}
            <div className="sticky bottom-0 bg-[var(--bg-card)] border-t border-edge-50">
              {evidence && onOpenRetrieval && (
                <button
                  onClick={onOpenRetrieval}
                  className="w-full group px-3 py-2 flex items-center gap-2 text-left hover:bg-hover transition-colors"
                >
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted">
                    {locale === 'zh' ? '证据链' : 'Evidence'}
                  </span>
                  <span className="text-[10px] font-mono text-ink-2 tabular-nums">
                    {evidence.signals}{locale === 'zh' ? ' 信号 · ' : ' signals · '}{evidence.vendors}{locale === 'zh' ? ' 厂商 · ' : ' vendors · '}{evidence.models}{locale === 'zh' ? ' 模型' : ' models'}
                  </span>
                  <span className="ml-auto text-[9px] text-accent opacity-80 group-hover:opacity-100 whitespace-nowrap">
                    {locale === 'zh' ? '打开情报检索 ▸' : 'Open retrieval ▸'}
                  </span>
                </button>
              )}
              <div className="px-3 py-1.5 text-[9px] text-dim">
                {snapshot.hasLlm
                  ? (locale === 'zh' ? `更新于 ${formatTime(snapshot.generatedAt)} · 每 30 分钟自动刷新` : `Updated ${formatTime(snapshot.generatedAt)} · refreshes every 30 min`)
                  : (locale === 'zh' ? '未配置 OPENAI_API_KEY，显示信号概览（配置后自动升级为 AI 洞察）' : 'OPENAI_API_KEY not set — showing signal overview')}
              </div>
            </div>
          </div>
        )}
      </div>
    </PanelBase>
  )
}
