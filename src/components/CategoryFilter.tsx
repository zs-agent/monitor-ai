'use client'
import { t, type Locale } from '@/lib/i18n'
const CATEGORIES = ['all', 'models', 'products', 'industry', 'papers', 'tips'] as const
export type Category = (typeof CATEGORIES)[number]
interface Props { active: Category; locale: Locale; onChange: (cat: Category) => void }
export default function CategoryFilter({ active, locale, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {CATEGORIES.map((cat) => (
        <button key={cat} onClick={() => onChange(cat)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
            active === cat
              ? 'bg-[#06b6d4] text-black shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              : 'bg-[#12121a] text-[#8b8ba0] border border-[#1e1e2e] hover:text-[#e5e5e5] hover:border-[#06b6d4]'
          }`}
        >{t(`filter.${cat}`, locale)}</button>
      ))}
    </div>
  )
}
