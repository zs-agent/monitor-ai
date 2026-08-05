'use client'

import { useState, useEffect } from 'react'
import { getLocale, type Locale } from '@/lib/i18n'
import Sidebar from './Sidebar'
import CommandPalette from '@/components/CommandPalette'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => {
    setLocale(getLocale())
    // 同步 <html lang>，避免 layout 中 lang 硬编码
    document.documentElement.lang = getLocale() === 'zh' ? 'zh-CN' : 'en'
  }, [])

  const handleLocaleChange = (l: Locale) => {
    setLocale(l)
    if (typeof window !== 'undefined') localStorage.setItem('monitor-ai-locale', l)
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
    window.location.reload()
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar locale={locale} onLocaleChange={handleLocaleChange} />
      <main className="flex-1 overflow-y-auto bg-[var(--bg-primary)] main-content">{children}</main>
      <CommandPalette locale={locale} />
    </div>
  )
}
