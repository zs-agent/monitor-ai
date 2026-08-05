'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { NAV_ITEMS, type PageSlug } from '@/lib/nav'
import type { Locale } from '@/lib/i18n'
import ThemeToggle from './ThemeToggle'

interface Props {
  locale: Locale
  onLocaleChange: (l: Locale) => void
}

export default function Sidebar({ locale, onLocaleChange }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const currentSlug = pathname.split('/')[1] || 'nexus'
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = (slug: PageSlug) => {
    router.push(`/${slug}`)
    setMobileOpen(false)
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-12 flex items-center px-5 border-b border-[var(--border)] shrink-0">
        <span className="text-base font-bold tracking-tight">
          <span className="text-[#06b6d4]">monitor</span><span className="text-[var(--text-primary)]">.ai</span>
        </span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 pt-4 pb-2 overflow-y-auto">
        <div className="text-[9px] text-[var(--text-muted)] uppercase tracking-[0.12em] font-medium mb-1.5 px-2">
          {locale === 'zh' ? '导航' : 'NAVIGATION'}
        </div>
        {NAV_ITEMS.filter(item => item.slug !== 'ops').map(item => {
          const isActive = currentSlug === item.slug
          return (
            <div key={item.slug} className="relative">
              {isActive && <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-[var(--accent)] rounded-r" />}
              <button
                onClick={() => nav(item.slug)}
                className={`w-full text-left pl-4 pr-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]'
                }`}
              >
                <span className="text-[14px] font-semibold tracking-wide">{item.en}</span>
                <span className="ml-2 text-[13px] text-inherit opacity-80">{item.zh}</span>
              </button>
            </div>
          )
        })}
      </nav>

      {/* OPS */}
      <div className="px-3 py-2 border-t border-[var(--border)]">
        <button
          onClick={() => nav('ops')}
          className={`w-full text-left px-3 py-1.5 text-[13px] rounded-md transition-colors ${
            currentSlug === 'ops'
              ? 'bg-[var(--accent-bg)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-overlay)]'
          }`}
        >
          OPS <span className="text-[11px] text-inherit opacity-60">{locale === 'zh' ? '管理' : 'admin'}</span>
        </button>
      </div>

      {/* Bottom status */}
      <div className="h-10 flex items-center justify-between px-4 border-t border-[var(--border)] shrink-0 bg-[var(--bg-primary)]/50">
        <span className="text-[11px] text-[var(--text-muted)] font-mono">monitor.ai</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onLocaleChange(locale === 'zh' ? 'en' : 'zh')}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors px-1.5 py-0.5 rounded">
            {locale === 'zh' ? 'EN' : '\u4e2d\u6587'}
          </button>
          <ThemeToggle />
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-3 left-3 z-[60] lg:hidden w-8 h-8 flex items-center justify-center bg-[var(--bg-sidebar)] border border-[var(--border)] rounded"
        aria-label="Toggle sidebar"
      >
        <span className="text-[var(--text-primary)] text-lg">{mobileOpen ? '\u2715' : '\u2630'}</span>
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[240px] shrink-0 bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex-col h-screen overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-[260px] h-full bg-[var(--bg-sidebar)] border-r border-[var(--border)] flex flex-col overflow-hidden">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
