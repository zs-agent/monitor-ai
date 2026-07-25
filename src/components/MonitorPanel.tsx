'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { Signal } from '@/types/signal'
import { type Locale } from '@/lib/i18n'
import PanelBase from './PanelBase'

const MONITOR_COLORS = ['#06b6d4', '#f59e0b', '#a78bfa', '#34d399', '#f472b6', '#818cf8']

interface Monitor {
  id: string
  keywords: string[]
  color: string
}

function loadMonitors(): Monitor[] {
  try {
    const raw = localStorage.getItem('monitor-ai-keywords')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveMonitors(monitors: Monitor[]): void {
  try { localStorage.setItem('monitor-ai-keywords', JSON.stringify(monitors)) } catch {}
}

export default function MonitorPanel({ signals, locale }: { signals: Signal[]; locale: Locale }) {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [input, setInput] = useState('')

  useEffect(() => {
    setMonitors(loadMonitors())
  }, [])

  const addMonitor = useCallback(() => {
    const kw = input.trim()
    if (!kw) return
    const keywords = kw.split(',').map(k => k.trim().toLowerCase()).filter(Boolean)
    if (keywords.length === 0) return
    const newMonitor: Monitor = {
      id: Date.now().toString(),
      keywords,
      color: MONITOR_COLORS[monitors.length % MONITOR_COLORS.length],
    }
    const next = [...monitors, newMonitor]
    setMonitors(next)
    saveMonitors(next)
    setInput('')
  }, [input, monitors])

  const removeMonitor = useCallback((id: string) => {
    const next = monitors.filter(m => m.id !== id)
    setMonitors(next)
    saveMonitors(next)
  }, [monitors])

  const matches = useMemo(() => {
    const langSignals = signals.filter(s => s.language === locale)
    if (monitors.length === 0) return []

    const matched: Array<{ signal: Signal; color: string; monitorId: string }> = []
    const seen = new Set<string>()

    for (const signal of langSignals) {
      if (seen.has(signal.id)) continue
      for (const monitor of monitors) {
        const text = `${signal.title} ${signal.summary}`.toLowerCase()
        const hit = monitor.keywords.some(kw => text.includes(kw))
        if (hit && !seen.has(signal.id)) {
          seen.add(signal.id)
          matched.push({ signal, color: monitor.color, monitorId: monitor.id })
          break
        }
      }
    }
    return matched.slice(0, 20)
  }, [signals, monitors, locale])

  return (
    <PanelBase
      id="monitor"
      title={locale === 'zh' ? '关键词监控' : 'Keyword Monitor'}
      dataBadge="live"
      count={matches.length}
      collapsible
    >
      <div className="p-3">
        <div className="flex gap-1 mb-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addMonitor() }}
            placeholder={locale === 'zh' ? '输入关键词, 以逗号分隔...' : 'Keywords, comma-separated...'}
            className="flex-1 bg-[#1e1e2e] border border-[#2a2a3e] rounded px-2 py-1 text-[11px] text-[#e5e5e5] placeholder-[#5c5c72] outline-none focus:border-[#06b6d4]/40"
          />
          <button
            onClick={addMonitor}
            className="px-2 py-1 text-[10px] bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20 rounded hover:bg-[#06b6d4]/20 transition-colors"
          >
            {locale === 'zh' ? '添加' : 'Add'}
          </button>
        </div>

        {/* Monitor tags */}
        {monitors.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {monitors.map(m => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
                style={{ background: m.color + '18', color: m.color, border: `1px solid ${m.color}30` }}
              >
                {m.keywords.join(', ')}
                <button onClick={() => removeMonitor(m.id)} className="opacity-60 hover:opacity-100">×</button>
              </span>
            ))}
          </div>
        )}

        {/* Matched signals */}
        {matches.length > 0 ? (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {matches.map(({ signal, color }) => (
              <div key={signal.id} className="flex items-start gap-2 text-[10px]">
                <span className="w-1 h-4 mt-0.5 rounded-sm shrink-0" style={{ background: color }} />
                <div className="min-w-0 flex-1">
                  <a
                    href={signal.sourceUrl}
                    target="_blank"
                    rel="noopener"
                    className="text-[#e5e5e5] hover:text-[#06b6d4] transition-colors line-clamp-1"
                  >
                    {signal.title}
                  </a>
                  <span className="text-[#5c5c72]">{signal.source}</span>
                </div>
              </div>
            ))}
          </div>
        ) : monitors.length > 0 ? (
          <div className="text-[10px] text-[#5c5c72] py-4 text-center">
            {locale === 'zh' ? '暂无匹配信号' : 'No matching signals'}
          </div>
        ) : (
          <div className="py-2 space-y-2">
            <div className="text-[10px] text-[#5c5c72] text-center">
              {locale === 'zh' ? '热门关键词 · 点击快速添加' : 'Trending keywords · click to add'}
            </div>
            <div className="flex flex-wrap gap-1 justify-center">
              {['OpenAI', 'DeepSeek', 'Claude', 'GPT', 'Gemini', 'Llama', 'Kimi', 'Qwen', '开源', '融资'].map(kw => (
                <button
                  key={kw}
                  onClick={() => {
                    const next: Monitor = { id: Date.now().toString() + kw, keywords: [kw.toLowerCase()], color: MONITOR_COLORS[monitors.length % MONITOR_COLORS.length] }
                    const updated = [...monitors, next]
                    setMonitors(updated)
                    saveMonitors(updated)
                  }}
                  className="px-2 py-0.5 text-[9px] rounded border border-[#2a2a3e] text-[#8b8ba0] hover:text-[#06b6d4] hover:border-[#06b6d4]/30 transition-colors"
                >
                  + {kw}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </PanelBase>
  )
}
