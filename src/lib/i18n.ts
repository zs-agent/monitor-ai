// 仅保留运行时 locale 状态（读取/写入）。
// 文案统一使用组件内联 `locale === 'zh' ? ... : ...`，故移除原字典（t/getTranslations/tOrFallback）
// 与 zh.json/en.json，消除双轨 i18n 导致的死代码与维护漂移。

export type Locale = 'zh' | 'en'

const DEFAULT_LOCALE: Locale = 'en'

export function getLocale(): Locale {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('monitor-ai-locale')
      if (saved === 'zh' || saved === 'en') return saved
    } catch {}
    const navLang = navigator.language || ''
    if (navLang.startsWith('zh')) return 'zh'
  }
  return DEFAULT_LOCALE
}

export function setLocale(locale: Locale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('monitor-ai-locale', locale)
  }
}
