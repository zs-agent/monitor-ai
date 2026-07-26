'use client'

import { useState, useEffect } from 'react'
import type { Signal } from '@/types/signal'
import { type Locale } from '@/lib/i18n'

export default function BreakingNewsBanner({ signals, locale }: { signals: Signal[]; locale: Locale }) {
  const [visible, setVisible] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)

  const breaking = signals.filter(s => s.importance >= 4 && s.language === locale)

  useEffect(() => {
    if (breaking.length <= 1) return
    const interval = setInterval(() => {
      setCurrentIndex(i => (i + 1) % breaking.length)
    }, 8000)
    return () => clearInterval(interval)
  }, [breaking.length])

  if (!visible || breaking.length === 0) return null

  const item = breaking[currentIndex]

  return (
    <div className="bg-gradient-to-r from-[#ff2020] to-[#cc0000] text-white px-4 py-1.5 flex items-center justify-between animate-slide-in">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[9px] font-bold uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded shrink-0">
          {locale === 'zh' ? '突发' : 'BREAKING'}
        </span>
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs truncate hover:underline"
        >
          {item.title}
        </a>
        <span className="text-[9px] opacity-60 shrink-0 hidden sm:inline">
          {locale === 'zh' ? `${item.sourcesCount} 源 · ${item.source}` : `${item.sourcesCount} src · ${item.source}`}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        {breaking.length > 1 && (
          <span className="text-[9px] opacity-60">{currentIndex + 1}/{breaking.length}</span>
        )}
        <button
          className="text-white/80 hover:text-white text-sm leading-none px-1"
          onClick={() => setVisible(false)}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
