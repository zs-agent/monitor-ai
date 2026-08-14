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
  const currentSlug = pathname === '/' ? '' : (pathname.split('/')[1] || 'nexus')
  const [mobileOpen, setMobileOpen] = useState(false)

  const nav = (slug: PageSlug | '/') => {
    router.push(slug === '/' ? '/' : `/${slug}`)
    setMobileOpen(false)
  }

  const sidebarContent = (
    <>
      {/* Logo — 点击回首页 */}
      <div className="h-12 flex items-center px-5 border-b border-edge shrink-0">
        <button onClick={() => nav('/')} className="text-base font-bold tracking-tight hover:opacity-80 transition-opacity" aria-label="Home">
          <span className="text-accent">monitor</span><span className="text-ink">.ai</span>
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 pt-4 pb-2 overflow-y-auto">
        <div className="text-[9px] text-muted uppercase tracking-[0.12em] font-medium mb-2 px-3">
          {locale === 'zh' ? '导航' : 'NAVIGATION'}
        </div>
        <div className="space-y-0.5">
          {/* Home */}
          <div className="relative">
            {currentSlug === '' && <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent rounded-r" />}
            <button
              onClick={() => nav('/')}
              className={`w-full text-left pl-4 pr-3 py-2.5 rounded-lg transition-colors ${
                currentSlug === ''
                  ? 'bg-accent-bg text-accent'
                  : 'text-muted hover:text-ink hover:bg-overlay'
              }`}
            >
              <span className="text-[14px] font-medium tracking-wide">{locale === 'zh' ? '首页' : 'HOME'}</span>
            </button>
          </div>
          {NAV_ITEMS.filter(item => item.slug !== 'ops').map(item => {
            const isActive = currentSlug === item.slug
            return (
              <div key={item.slug} className="relative">
                {isActive && <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent rounded-r" />}
                <button
                  onClick={() => nav(item.slug)}
                  className={`w-full text-left pl-4 pr-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-accent-bg text-accent'
                      : 'text-muted hover:text-ink hover:bg-overlay'
                  }`}
                >
                  <span className="text-[14px] font-medium tracking-wide">{locale === 'zh' ? item.zh : item.en}</span>
                </button>
              </div>
            )
          })}
        </div>
      </nav>

      {/* OPS */}
      <div className="px-3 py-2 border-t border-edge">
        <button
          onClick={() => nav('ops')}
          className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
            currentSlug === 'ops'
              ? 'bg-accent-bg text-accent'
              : 'text-muted hover:text-ink hover:bg-overlay'
          }`}
        >
          <span className="text-[14px] font-medium tracking-wide">{locale === 'zh' ? '源网监控' : 'OPS'}</span>
        </button>
      </div>

      {/* Bottom status */}
      <div className="h-10 flex items-center justify-between px-4 border-t border-edge shrink-0 bg-base-50">
        <span className="text-[11px] text-muted font-mono">monitor.ai</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onLocaleChange(locale === 'zh' ? 'en' : 'zh')}
            className="text-[11px] text-muted hover:text-ink-2 transition-colors px-1.5 py-0.5 rounded">
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
        className="fixed top-3 left-3 z-[60] lg:hidden w-8 h-8 flex items-center justify-center bg-sidebar border border-edge rounded"
        aria-label="Toggle sidebar"
      >
        <span className="text-ink text-lg">{mobileOpen ? '\u2715' : '\u2630'}</span>
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[240px] shrink-0 bg-sidebar border-r border-edge flex-col h-screen overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-[260px] h-full bg-sidebar border-r border-edge flex flex-col overflow-hidden">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  )
}
