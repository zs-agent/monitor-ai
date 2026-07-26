'use client'

import type { CardSignal } from '@/types/signal'
import { t, type Locale } from '@/lib/i18n'

interface Props { signal: CardSignal; locale: Locale; onClick?: () => void }

const CATEGORY_ACCENTS: Record<string, { bar: string; dot: string; label: string }> = {
  models: { bar: 'bg-violet-500', dot: 'bg-violet-400', label: 'violet' },
  products: { bar: 'bg-cyan-500', dot: 'bg-cyan-400', label: 'cyan' },
  industry: { bar: 'bg-amber-500', dot: 'bg-amber-400', label: 'amber' },
  papers: { bar: 'bg-emerald-500', dot: 'bg-emerald-400', label: 'emerald' },
  tips: { bar: 'bg-rose-500', dot: 'bg-rose-400', label: 'rose' },
}

const CATEGORY_TEXT: Record<string, string> = {
  models: 'text-violet-400/70',
  products: 'text-cyan-400/70',
  industry: 'text-amber-400/70',
  papers: 'text-emerald-400/70',
  tips: 'text-rose-400/70',
}

function sourceLabel(signal: CardSignal): string {
  try {
    const host = new URL(signal.sourceUrl).hostname.replace('www.', '')
    return host.split('.')[0]
  } catch {
    return signal.source.split('/')[0].slice(0, 12)
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function SignalCard({ signal, locale, onClick }: Props) {
  const accent = CATEGORY_ACCENTS[signal.category] || CATEGORY_ACCENTS.models
  const isHigh = signal.importance >= 4
  const isCluster = 'isCluster' in signal && signal.isCluster
  const displaySourceCount = 'sourceCount' in signal ? signal.sourceCount : signal.sourcesCount

  return (
      <div className={`h-full flex flex-col group relative bg-[#12121a] border border-[#1e1e2e] rounded-lg transition-all duration-200 hover:bg-[#16162a] hover:border-[#06b6d4]/20 hover:shadow-[0_0_15px_rgba(6,182,212,0.06)] ${onClick ? 'cursor-pointer' : 'cursor-default'} ${isHigh ? 'ring-1 ring-[#06b6d4]/5' : ''}`}
        onClick={onClick}>
      {/* Category bar */}
      <div className={`absolute top-0 left-0 w-full h-0.5 rounded-t-lg ${accent.bar} ${isHigh ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'} transition-opacity`} />

      {/* Header */}
      <div className="p-3.5 pb-0 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className={`text-sm font-medium leading-snug ${isHigh ? 'text-[#e5e5e5]' : 'text-[#c8c8d0]'} group-hover:text-[#06b6d4] transition-colors line-clamp-2`}>
            {signal.title}
          </h3>
          {isCluster && (
            <span className="shrink-0 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider rounded bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/20">
              +{displaySourceCount - 1}
            </span>
          )}
          {isHigh && !isCluster && (
            <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/15 animate-pulse-slow">
              {t('signal.new', locale)}
            </span>
          )}
        </div>

        <p className="text-xs text-[#6c6c82] leading-relaxed line-clamp-2 mb-2.5">
          {signal.summary}
        </p>
      </div>

      {/* Meta row */}
      <div className="px-3.5 pb-3.5">
        <div className="flex items-center gap-2 flex-wrap text-[10px] text-[#5c5c72]">
          {/* Source */}
          <span className="font-medium text-[#06b6d4]/60">{sourceLabel(signal)}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-[#1e1e2e]" />
          {/* Time */}
          <span className="font-mono">{timeAgo(signal.publishedAt)}</span>
          <span className="w-0.5 h-0.5 rounded-full bg-[#1e1e2e]" />
          {/* Category tag */}
          <span className={CATEGORY_TEXT[signal.category] || 'text-gray-400/70'}>{t(`filter.${signal.category}`, locale)}</span>

          <span className="flex-1" />

          {/* Sources count badge */}
          {displaySourceCount > 1 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#06b6d4]/5 text-[#06b6d4]/80 text-[9px] font-medium border border-[#06b6d4]/10">
              <span>{displaySourceCount}</span>
              <span>{t('signal.sourcesCount', locale)}</span>
            </span>
          )}
        </div>

        {/* Importance bar */}
        <div className="flex gap-0.5 mt-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`h-[2px] flex-1 rounded-full transition-all duration-300 ${
                i < signal.importance
                  ? signal.importance >= 4
                    ? 'bg-gradient-to-r from-[#06b6d4] to-[#0891b2]'
                    : 'bg-[#06b6d4]/40'
                  : 'bg-[#1e1e2e]'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
