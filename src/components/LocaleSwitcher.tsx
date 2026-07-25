'use client'
import { useCallback, useState, useEffect } from 'react'
import { getLocale, setLocale, type Locale } from '@/lib/i18n'
interface Props { onChange?: (locale: Locale) => void }
export default function LocaleSwitcher({ onChange }: Props) {
  const [locale, setLocal] = useState<Locale>('en')
  useEffect(() => { setLocal(getLocale()) }, [])
  const toggle = useCallback(() => {
    const next: Locale = locale === 'zh' ? 'en' : 'zh'
    setLocal(next); setLocale(next); onChange?.(next)
  }, [locale, onChange])
  return (
    <button onClick={toggle}
      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-[#1e1e2e] bg-[#12121a] text-[#8b8ba0] hover:text-[#e5e5e5] hover:border-[#06b6d4] transition-colors duration-200"
    >{locale === 'zh' ? 'EN' : '中'}</button>
  )
}
