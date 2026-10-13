'use client'

// 顶部导航：工作台收敛成单页多页签后，原先 240px 的侧栏只剩"去哪个页面"这一个作用，
// 于是在这里压成一条 44px 的细栏：logo · 页面 · ⌘K · 语言 · 主题。
// 主内容区因此多出 240px 宽度（地图、12 列栅格、研究三栏都受益）。
import { usePathname, useRouter } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/nav'
import type { Locale } from '@/lib/i18n'
import ThemeToggle from './ThemeToggle'

interface Props {
  locale: Locale
  onLocaleChange: (l: Locale) => void
}

// 命令面板没有对外 API，靠监听 Ctrl/⌘+K；这里派发同款事件让它打开（点 ⌘K 提示即用）
const openCommandPalette = () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
}

export default function TopNav({ locale, onLocaleChange }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const currentSlug = pathname === '/' ? '' : pathname.split('/')[1] || 'nexus'

  return (
    <header className="h-11 shrink-0 flex items-center gap-2 px-4 border-b border-edge bg-sidebar">
      <button
        onClick={() => router.push('/')}
        className="text-[14px] font-bold tracking-tight hover:opacity-80 transition-opacity mr-1"
        aria-label="Home"
      >
        <span className="text-accent">monitor</span><span className="text-ink">.ai</span>
      </button>

      <nav className="flex items-center gap-0.5">
        {NAV_ITEMS.map(item => (
          <button
            key={item.slug}
            onClick={() => router.push(`/${item.slug}`)}
            title={locale === 'zh' ? item.desc.zh : item.desc.en}
            className={`px-3 py-1.5 text-[12px] rounded-md transition-colors ${
              currentSlug === item.slug ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'
            }`}
          >
            {locale === 'zh' ? item.zh : item.en}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={openCommandPalette}
          className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-muted hover:text-ink-2 border border-edge rounded px-1.5 py-0.5 transition-colors"
          title={locale === 'zh' ? '搜索页面与实体' : 'Search pages and entities'}
        >
          ⌘K
        </button>
        <button
          onClick={() => onLocaleChange(locale === 'zh' ? 'en' : 'zh')}
          className="text-[11px] text-muted hover:text-ink-2 transition-colors px-1.5 py-0.5 rounded"
        >
          {locale === 'zh' ? 'EN' : '中文'}
        </button>
        <ThemeToggle />
      </div>
    </header>
  )
}
