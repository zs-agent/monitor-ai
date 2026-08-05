'use client'

import { useTheme } from '@/lib/theme'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      className="text-[14px] text-[#5c5c72] hover:text-[#8b8ba0] transition-colors px-1 py-0.5 rounded"
      aria-label="Toggle theme"
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  )
}
