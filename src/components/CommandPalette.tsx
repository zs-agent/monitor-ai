'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { NAV_ITEMS, type PageSlug } from '@/lib/nav'
import type { Locale } from '@/lib/i18n'

interface SearchItem {
  id: string
  label: string
  sublabel: string
  icon: string
  action: () => void
  category: string
}

export default function CommandPalette({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Toggle on Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setActiveIdx(0)
    }
  }, [open])

  const allItems = useMemo((): SearchItem[] => {
    const items: SearchItem[] = []

    // Pages
    NAV_ITEMS.forEach(item => {
      items.push({
        id: `page-${item.slug}`,
        label: `${item.en} — ${item.zh}`,
        sublabel: locale === 'zh' ? item.desc.zh : item.desc.en,
        icon: '◈',
        category: locale === 'zh' ? '页面' : 'Pages',
        action: () => { router.push(`/${item.slug}`); setOpen(false) },
      })
    })

    // AI entities (hardcoded common ones for search)
    // 实体入口已移除：原实现点击全部跳 /pulse（无目标死入口），且与综合搜索（nexus 顶栏）功能重叠
    // 如需按实体定位，应接入 nexus 地图/详情联动后再恢复

    return items
  }, [locale, router])

  // Filter by query
  const results = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 10)
    const q = query.toLowerCase()
    const filtered = allItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.sublabel.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    )
    return filtered.slice(0, 20)
  }, [query, allItems])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[activeIdx]) { results[activeIdx].action() }
  }, [results, activeIdx])

  if (!open) return null

  // Group results by category
  const grouped = results.reduce<Record<string, SearchItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
      <div className="relative w-[560px] max-w-[90vw] bg-card border border-edge rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-edge">
          <span className="text-muted text-sm">⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder={locale === 'zh' ? '搜索页面或实体...' : 'Search pages or entities...'}
            className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder-dim"
          />
          <kbd className="text-[10px] text-dim bg-hover px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="px-4 pt-3 pb-1 text-[9px] text-muted uppercase tracking-wider font-medium">
                {category}
              </div>
              {items.map((item, i) => {
                const globalIdx = results.indexOf(item)
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                    className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                      globalIdx === activeIdx
                        ? 'bg-accent-bg'
                        : 'hover:bg-overlay'
                    }`}
                  >
                    <span className="text-muted text-sm shrink-0">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink font-medium truncate">{item.label}</div>
                      <div className="text-[10px] text-muted truncate">{item.sublabel}</div>
                    </div>
                    {globalIdx === activeIdx && (
                      <span className="text-[9px] text-accent shrink-0">↵</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          {results.length === 0 && (
            <div className="flex flex-col items-center py-8 text-muted">
              <span className="text-2xl mb-2 opacity-30">◇</span>
              <p className="text-[12px]">{locale === 'zh' ? '无匹配结果' : 'No results'}</p>
              <p className="text-[10px] mt-1">{locale === 'zh' ? '尝试其他关键词' : 'Try different keywords'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
