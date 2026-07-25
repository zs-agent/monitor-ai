'use client'

import { useState, useRef, useEffect } from 'react'
import type { Signal } from '@/types/signal'
import { type Locale } from '@/lib/i18n'
import PanelBase from './PanelBase'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatAnalystPanel({ signals, locale }: { signals: Signal[]; locale: Locale }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const generateResponse = (query: string): string => {
    const q = query.toLowerCase()
    const langSignals = signals.filter(s => s.language === locale)

    if (q.includes('总结') || q.includes('summary') || q.includes('今天') || q.includes('today')) {
      const top = langSignals.slice(0, 8)
      if (top.length === 0) return locale === 'zh' ? '暂无数据' : 'No data yet'
      const items = top.map(s => `- ${s.title} (${s.source}, importance: ${s.importance}/5)`).join('\n')
      return `${locale === 'zh' ? '最近信号摘要' : 'Recent signals'}:\n${items}`
    }

    if (q.includes('热点') || q.includes('trending') || q.includes('hot')) {
      const hot = langSignals.filter(s => s.importance >= 4).slice(0, 5)
      if (hot.length === 0) return locale === 'zh' ? '暂无热点' : 'No trending items'
      return hot.map(s => `→ ${s.title}`).join('\n')
    }

    if (q.includes('源') || q.includes('source')) {
      const srcArr: string[] = []
      const seenSrc = new Set<string>()
      for (let i = 0; i < langSignals.length; i++) {
        const s = langSignals[i]
        if (!seenSrc.has(s.source) && srcArr.length < 10) {
          seenSrc.add(s.source)
          srcArr.push(s.source)
        }
      }
      return `${locale === 'zh' ? '活跃信源' : 'Active sources'} (${srcArr.length}): ${srcArr.join(', ')}`
    }

    return `${locale === 'zh' ? '收到。你可以问我：\n- "今天有什么 "\n- "热点" \n- "有哪些信源"' : 'Got it. Try:\n- "summary"\n- "trending"\n- "sources"'}\n\n${locale === 'zh' ? '当前信号总量' : 'Total signals'}: ${langSignals.length}`
  }

  const send = () => {
    const q = input.trim()
    if (!q) return
    const userMsg: Message = { role: 'user', content: q }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    setTimeout(() => {
      const answer = generateResponse(q)
      setMessages(prev => [...prev, { role: 'assistant', content: answer }])
      setLoading(false)
    }, 400)
  }

  return (
    <PanelBase
      id="chat"
      title={locale === 'zh' ? 'AI 分析师' : 'AI Analyst'}
      dataBadge="live"
      collapsible
    >
      <div className="flex flex-col h-72">
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <div className="text-[10px] text-[#5c5c72] text-center py-6">
              {locale === 'zh' ? '问我关于当前信号的问题...' : 'Ask me about current signals...'}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#06b6d4]/15 text-[#e5e5e5] border border-[#06b6d4]/20'
                  : 'bg-[#1e1e2e] text-[#8b8ba0] border border-[#2a2a3e]'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#1e1e2e] border border-[#2a2a3e] rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="flex gap-1 p-2 border-t border-[#1e1e2e]">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={locale === 'zh' ? '问一个问题...' : 'Ask a question...'}
            className="flex-1 bg-[#1e1e2e] border border-[#2a2a3e] rounded px-2 py-1 text-[11px] text-[#e5e5e5] placeholder-[#5c5c72] outline-none focus:border-[#06b6d4]/40"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-2 py-1 text-[10px] bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20 rounded hover:bg-[#06b6d4]/20 disabled:opacity-30 transition-colors"
          >
            →
          </button>
        </div>
      </div>
    </PanelBase>
  )
}
