'use client'

import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n'

// 看板分组标头：面板保持平铺，但按类别分段，扫的时候有骨架。
// 与 PanelBase 的标题风格一致（小号大写字距 + 细分隔线），但不占面板容器。
interface Props {
  locale: Locale
  zh: string
  en: string
  /** 一句用途说明 */
  hint: string
  hintEn: string
  count?: number
  /** 右端操作区（如分组内视图切换），在计数之后 */
  actions?: ReactNode
}

export default function SectionHeading({ locale, zh, en, hint, hintEn, count, actions }: Props) {
  const isZh = locale === 'zh'
  return (
    <div className="flex items-center gap-3 px-5 pt-7 pb-0.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2 whitespace-nowrap">
        {isZh ? zh : en}
      </h2>
      <span className="text-[10px] text-muted truncate">{isZh ? hint : hintEn}</span>
      <span className="flex-1 h-px bg-edge min-w-[24px]" />
      {typeof count === 'number' && (
        <span className="text-[10px] font-mono text-muted tabular-nums">{count}</span>
      )}
      {actions}
    </div>
  )
}
