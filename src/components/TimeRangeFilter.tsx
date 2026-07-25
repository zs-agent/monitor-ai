'use client'

interface Props { locale: 'zh' | 'en'; active: string; onChange: (range: string) => void }

const RANGES = [
  { key: 'all', en: 'All Time', zh: '全部' },
  { key: '24h', en: '24h', zh: '今天' },
  { key: '7d', en: '7 Days', zh: '本周' },
  { key: '30d', en: '30 Days', zh: '本月' },
]

export default function TimeRangeFilter({ locale, active, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {RANGES.map(r => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={`px-2.5 py-1 text-[10px] font-medium rounded-md transition-all duration-200 ${
            active === r.key
              ? 'bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20'
              : 'text-[#5c5c72] hover:text-[#8b8ba0] border border-transparent hover:border-[#1e1e2e]'
          }`}
        >
          {locale === 'zh' ? r.zh : r.en}
        </button>
      ))}
    </div>
  )
}
