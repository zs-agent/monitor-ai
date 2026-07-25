'use client'

import { useState, useRef, useEffect } from 'react'
import type { Signal } from '@/types/signal'
import { type Locale } from '@/lib/i18n'

export default function FloatingChat({ signals, locale }: { signals: Signal[]; locale: Locale }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const generate = (q: string): string => {
    const langSignals = signals.filter(s => s.language === locale)
    const lower = q.toLowerCase()
    if (lower.includes('总结') || lower.includes('summary') || lower.includes('今天') || lower.includes('today')) {
      const top = langSignals.slice(0, 5)
      if (top.length === 0) return locale === 'zh' ? '暂无数据' : 'No data yet'
      return top.map(s => `▸ ${s.title} (${s.source}, ${s.importance}/5)`).join('\n')
    }
    if (lower.includes('热点') || lower.includes('trending')) {
      const hot = langSignals.filter(s => s.importance >= 4).slice(0, 5)
      return hot.length === 0 ? (locale === 'zh' ? '暂无热点' : 'No trending items') : hot.map(s => `→ ${s.title}`).join('\n')
    }
    const srcs: string[] = []
    const seen = new Set<string>()
    for (const s of langSignals) { if (!seen.has(s.source) && srcs.length < 10) { seen.add(s.source); srcs.push(s.source) } }
    return `${locale === 'zh' ? '收到。当前' : 'Got it.'} ${langSignals.length} ${locale === 'zh' ? '条信号。源: ' : 'signals. Sources: '} ${srcs.join(', ')}`
  }

  const send = () => {
    const q = input.trim()
    if (!q) return
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setInput('')
    setLoading(true)
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', content: generate(q) }])
      setLoading(false)
    }, 300)
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-11 h-11 rounded-full bg-[#06b6d4] text-black flex items-center justify-center shadow-lg shadow-[#06b6d4]/20 hover:bg-[#0891b2] transition-all hover:scale-105"
          title={locale === 'zh' ? 'AI 分析' : 'AI Analyst'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-80 h-[420px] bg-[#12121a] border border-[#1e1e2e] rounded-xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e2e]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse-slow" />
              <span className="text-[11px] font-semibold text-[#8b8ba0]">{locale === 'zh' ? 'AI 分析师' : 'AI Analyst'}</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-[#5c5c72] hover:text-[#8b8ba0] text-sm">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-[10px] text-[#5c5c72] text-center py-6">
                {locale === 'zh' ? '问我关于当前 AI 局势的问题...' : 'Ask me about the current AI landscape...'}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user' ? 'bg-[#06b6d4]/15 text-[#e5e5e5]' : 'bg-[#1e1e2e] text-[#8b8ba0]'
                }`}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-1 justify-start"><span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse"/><span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse" style={{animationDelay:'150ms'}}/><span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse" style={{animationDelay:'300ms'}}/></div>
            )}
            <div ref={endRef} />
          </div>
          <div className="flex gap-1 p-2 border-t border-[#1e1e2e]">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }} placeholder={locale === 'zh' ? '问个问题...' : 'Ask...'} className="flex-1 bg-[#1e1e2e] rounded px-2 py-1 text-[11px] text-[#e5e5e5] placeholder-[#5c5c72] outline-none" />
            <button onClick={send} disabled={loading || !input.trim()} className="px-3 py-1 text-[10px] bg-[#06b6d4]/10 text-[#06b6d4] rounded hover:bg-[#06b6d4]/20 disabled:opacity-30">→</button>
          </div>
        </div>
      )}
    </>
  )
}
