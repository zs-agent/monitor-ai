import type { Metadata } from 'next'
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
    <html lang="en" className="dark" data-theme="dark">
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
