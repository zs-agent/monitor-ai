'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')
  const themeRef = useRef<Theme>('dark')

  // 挂载时恢复用户保存的主题（只读 localStorage，不写，避免用初始值覆盖用户偏好）
  useEffect(() => {
    const saved = localStorage.getItem('monitor-ai-theme') as Theme | null
    if (saved === 'light' || saved === 'dark') {
      themeRef.current = saved
      setThemeState(saved)
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  // 唯一写路径：用户主动切换时才持久化 + 同步 DOM
  const apply = useCallback((next: Theme) => {
    themeRef.current = next
    setThemeState(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('monitor-ai-theme', next)
  }, [])

  const toggle = useCallback(() => {
    apply(themeRef.current === 'dark' ? 'light' : 'dark')
  }, [apply])

  const setTheme = useCallback((t: Theme) => apply(t), [apply])

  return <ThemeContext.Provider value={{ theme, toggle, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
