'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getLocale, type Locale } from '@/lib/i18n'
import TopNav from './TopNav'
import CommandPalette from '@/components/CommandPalette'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en')
  const pathname = usePathname()

  useEffect(() => {
    setLocale(getLocale())
    // 同步 <html lang>，避免 layout 中 lang 硬编码
    document.documentElement.lang = getLocale() === 'zh' ? 'zh-CN' : 'en'
  }, [])

  // 根路径 / 是独立系统首页（landing），不套仪表盘侧边栏
  if (pathname === '/') return <>{children}</>

  const handleLocaleChange = (l: Locale) => {
    setLocale(l)
    if (typeof window !== 'undefined') localStorage.setItem('monitor-ai-locale', l)
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
    window.location.reload()
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNav locale={locale} onLocaleChange={handleLocaleChange} />
      <main className="flex-1 overflow-y-auto bg-base main-content">{children}</main>
      <CommandPalette locale={locale} />
    </div>
  )
}
