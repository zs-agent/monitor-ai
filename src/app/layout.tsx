import type { Metadata } from 'next'
import '@/app/globals.css'
import AnalyticsInit from './analytics-init'

export const metadata: Metadata = {
  title: 'monitor.ai - AI Global Intelligence',
  description: 'Real-time AI intelligence signal stream. Global AI news, bilingual.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
        <AnalyticsInit />
      </body>
    </html>
  )
}
