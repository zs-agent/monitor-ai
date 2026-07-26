'use client'

import { useMemo, useState } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import PanelBase from './PanelBase'

interface Props { locale: Locale; signals: Signal[] }

/** Vendors tracked on the radar. `keys` are lowercase match tokens. */
const VENDORS: { id: string; name: string; nameZh: string; keys: string[]; color: string }[] = [
  { id: 'openai', name: 'OpenAI', nameZh: 'OpenAI', keys: ['openai', 'gpt-', 'gpt4', 'gpt5', 'chatgpt', 'sora', 'o3', 'o4'], color: '#06b6d4' },
  { id: 'anthropic', name: 'Anthropic', nameZh: 'Anthropic', keys: ['anthropic', 'claude'], color: '#f59e0b' },
  { id: 'google', name: 'Google', nameZh: '谷歌', keys: ['google', 'deepmind', 'gemini', 'gemma'], color: '#34d399' },
  { id: 'meta', name: 'Meta', nameZh: 'Meta', keys: ['meta ', 'llama', 'facebook'], color: '#a78bfa' },
  { id: 'nvidia', name: 'NVIDIA', nameZh: '英伟达', keys: ['nvidia', 'blackwell', 'cuda', 'h100', 'h200', 'gb200'], color: '#84cc16' },
  { id: 'microsoft', name: 'Microsoft', nameZh: '微软', keys: ['microsoft', 'copilot', 'azure'], color: '#38bdf8' },
  { id: 'deepseek', name: 'DeepSeek', nameZh: '深度求索', keys: ['deepseek'], color: '#f472b6' },
  { id: 'alibaba', name: 'Alibaba', nameZh: '阿里', keys: ['alibaba', 'qwen', 'tongyi', '通义', '阿里'], color: '#fb923c' },
  { id: 'bytedance', name: 'ByteDance', nameZh: '字节', keys: ['bytedance', 'doubao', '豆包', '字节'], color: '#22d3ee'},
  { id: 'moonshot', name: 'Moonshot', nameZh: '月之暗面', keys: ['moonshot', 'kimi', '月之暗面'], color: '#c084fc' },
  { id: 'zhipu', name: 'Zhipu', nameZh: '智谱', keys: ['zhipu', 'glm', '智谱'], color: '#2dd4bf' },
  { id: 'mistral', name: 'Mistral', nameZh: 'Mistral', keys: ['mistral', 'mixtral'], color: '#facc15' },
  { id: 'xai', name: 'xAI', nameZh: 'xAI', keys: ['xai', 'grok'], color: '#94a3b8' },
  { id: 'apple', name: 'Apple', nameZh: '苹果', keys: ['apple', 'apple intelligence'], color: '#e879f9' },
  { id: 'amazon', name: 'Amazon', nameZh: '亚马逊', keys: ['amazon', 'aws', 'bedrock', 'nova'], color: '#fdba74' },
]

const HALF_DAY = 43200000

export default function CompanyRadar({ locale, signals }: Props) {
  const isZh = locale === 'zh'
  const [showAllVendors, setShowAllVendors] = useState(false)

  const rows = useMemo(() => {
    const now = Date.now()
    const stats = VENDORS.map(v => {
      let total = 0
      let recent = 0
      let prev = 0
      let peakImportance = 0
      let topTitle = ''

      for (const s of signals) {
        const text = `${s.title ?? ''} ${s.summary ?? ''}`.toLowerCase()
        if (!v.keys.some(k => text.includes(k))) continue
        total += 1
        const age = now - new Date(s.publishedAt).getTime()
        if (age <= HALF_DAY) recent += 1
        else if (age <= HALF_DAY * 2) prev += 1
        if (s.importance > peakImportance) {
          peakImportance = s.importance
          topTitle = s.title
        }
      }

      return { ...v, total, recent, prev, peakImportance, topTitle, delta: recent - prev }
    })

    return stats
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total || b.peakImportance - a.peakImportance)
      .slice(0, showAllVendors ? undefined : 8)
  }, [signals])

  const max = rows.length > 0 ? Math.max(...rows.map(r => r.total)) : 0

  return (
    <PanelBase
      id="company-radar"
      title={isZh ? '厂商动向雷达' : 'Vendor Radar'}
      severity="medium"
      dataBadge="static"
      count={rows.length}
      collapsible
    >
      {rows.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <div className="text-2xl text-[#1e1e2e] mb-2">◇</div>
            <p className="text-[11px] text-[#5c5c72]">{isZh ? '暂无厂商信号' : 'No vendor signals'}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.length > 0 && VENDORS.length > 8 && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowAllVendors(!showAllVendors)}
                className="text-[10px] text-[#06b6d4]/60 hover:text-[#06b6d4] transition-colors"
              >
                {showAllVendors
                  ? (isZh ? '收起' : 'Show less')
                  : (isZh ? `查看全部 ${VENDORS.length} 家厂商 →` : `View all ${VENDORS.length} vendors →`)}
              </button>
            </div>
          )}
          {rows.map((r, i) => {
            const pct = max > 0 ? (r.total / max) * 100 : 0
            const trendUp = r.delta > 0
            const trendFlat = r.delta === 0
            return (
              <div key={r.id} className="flex items-center gap-2 group" title={r.topTitle}>
                <span className="text-[9px] font-mono w-3 text-center text-[#3c3c52]">{i + 1}</span>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.color }} />
                <span className="text-[10px] text-[#8b8ba0] w-[72px] truncate shrink-0 group-hover:text-[#e5e5e5] transition-colors">
                  {isZh ? r.nameZh : r.name}
                </span>
                <div className="flex-1 h-2 bg-[#1e1e2e] rounded-full overflow-hidden min-w-0">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${r.color}55, ${r.color})` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-[#e5e5e5] w-5 text-right shrink-0">{r.total}</span>
                <span
                  className={`text-[9px] font-mono w-8 text-right shrink-0 ${
                    trendFlat ? 'text-[#5c5c72]' : trendUp ? 'text-[#34d399]' : 'text-[#ff4444]'
                  }`}
                >
                  {trendFlat ? '—' : `${trendUp ? '▲' : '▼'}${Math.abs(r.delta)}`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#1e1e2e]/50 text-[10px] text-[#5c5c72]">
        <span>{isZh ? '按提及量排序' : 'Ranked by mentions'}</span>
        <span className="flex-1" />
        <span className="text-[#34d399]">▲</span>
        <span>{isZh ? '近12h上升' : '12h rising'}</span>
      </div>
    </PanelBase>
  )
}
