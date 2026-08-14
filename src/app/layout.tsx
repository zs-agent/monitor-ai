import type { Metadata } from 'next'
import Script from 'next/script'
import '@/app/globals.css'
import AnalyticsInit from './analytics-init'
import AppShell from '@/components/layout/AppShell'
import { ThemeProvider } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'monitor.ai - AI Global Intelligence',
  description: 'Real-time AI intelligence signal stream. Global AI news, bilingual.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* 首帧前同步主题，避免保存浅色主题的用户每次刷新闪一下深色（FOUC） */}
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function () {
            try {
              var t = localStorage.getItem('monitor-ai-theme')
              if (t === 'light') {
                document.documentElement.setAttribute('data-theme', 'light')
                document.documentElement.classList.remove('dark')
                document.documentElement.classList.add('light')
              }
            } catch (e) {}
          })()
        `}</Script>
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AppShell>
            {children}
          </AppShell>
        </ThemeProvider>
        <AnalyticsInit />
      </body>
    </html>
  )
}
