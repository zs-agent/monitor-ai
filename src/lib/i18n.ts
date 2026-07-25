import zh from '@/locales/zh.json'
import en from '@/locales/en.json'

const dicts = { zh, en } as const
export type Locale = keyof typeof dicts
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

export function getTranslations(locale: Locale): typeof zh {
  return dicts[locale]
}

export function t(key: string, locale: Locale): string {
  const dict = getTranslations(locale)
  const keys = key.split('.')
  let result: any = dict
  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) result = result[k]
    else return key
  }
  return typeof result === 'string' ? result : key
}
