'use client'

// 情报浏览器（阶段一）：把"信号流模块"升级为 FM 式的多维列表 + 主从视图。
//   · 维度切换：信号 / 厂商 / 模型（可继续扩展仓库、论文）
//   · 每个维度都可排序；列表在左、选中实体的档案在右（FM 的 list + profile 布局）
//   · 下钻收敛在面板内部：厂商 → 用命中关键词过滤信号；模型 → 竞技场分数 + 相关信号
// 阶段二/三已接：行尾 ☆ 进关注清单、⇄ 厂商对比、保存视图（localStorage）；「完整档案 →」跳 /entity/<kind>/<slug>
// 时间窗不在这里——由看板顶部的「信号时间窗」统一控制（避免两个时间控件并存）。
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { type Locale } from '@/lib/i18n'
import { useRemoteData } from '@/lib/use-remote-data'
import type { Signal } from '@/types/signal'
import type { ModelReportItem } from '@/data/model-reports'
import PanelBase from '@/components/PanelBase'
import SignalCard from '@/components/SignalCard'
import { computeVendorRows, type VendorRow } from '@/lib/vendor-radar'
import { entityTokens, matchesKeyword, sameEntity } from '@/lib/text-match'
import { shortlistKey, useLocalStore } from '@/lib/local-store'
import type { BrowseCounts, BrowsePreset } from '@/lib/browse-view'

type Dimension = 'signals' | 'vendors' | 'models'
type SortDir = 'asc' | 'desc'

const DIMENSIONS: { id: Dimension; zh: string; en: string }[] = [
  { id: 'signals', zh: '信号', en: 'Signals' },
  { id: 'vendors', zh: '厂商', en: 'Vendors' },
  { id: 'models', zh: '模型', en: 'Models' },
]

const CATEGORIES = [
  { key: 'all', zh: '全部', en: 'All' },
  { key: 'models', zh: '模型', en: 'Models' },
  { key: 'products', zh: '产品', en: 'Products' },
  { key: 'industry', zh: '产业', en: 'Industry' },
  { key: 'papers', zh: '论文', en: 'Papers' },
  { key: 'tips', zh: '经验', en: 'Tips' },
]

interface ArenaEntry { model: string; organization: string; score: string }
interface ArenaBoard { dimension: string; source: string; sourceUrl: string; date: string; methodology: string; entries: ArenaEntry[] }
interface ArenaResponse { state?: string; fetchedAt?: string; boards?: ArenaBoard[]; note?: string }
interface ReportsResponse { state?: string; fetchedAt?: string; live?: ModelReportItem[]; curated?: ModelReportItem[]; note?: string }

interface Props {
  locale: Locale
  signals: Signal[]
  loading: boolean
  error: string | null
  /** 顶栏全局搜索：作用于信号维度 */
  searchQuery?: string
  onSelectSignal: (signal: Signal) => void
  /** 关注清单（短名单）由看板统一持有，这里只负责读写 */
  shortlist?: string[]
  onToggleShortlist?: (key: string) => void
  /** 作为「今日 AI 洞察」模块的检索视图时，标题由模块承担，面板自身不再重复显示 */
  hideTitle?: boolean
  /** 研判视图下钻：切维度 / 打上分类筛选（每次下发新对象即应用） */
  preset?: BrowsePreset | null
  /** 上报三个维度的行数，供模块标头与研判视图展示检索规模 */
  onCounts?: (counts: BrowseCounts) => void
}

interface SavedView {
  id: string
  name: string
  dimension: Dimension
  category: string
  languageFilter: 'all' | 'zh' | 'en'
  activeTags: string[]
  signalSort: 'time' | 'importance' | 'credibility'
  vendorDays: number
}

export default function IntelligenceBrowser({ locale, signals, loading, error, searchQuery = '', onSelectSignal, shortlist = [], onToggleShortlist, hideTitle = false, preset = null, onCounts }: Props) {
  const zh = locale === 'zh'
  const [dimension, setDimension] = useState<Dimension>('signals')
  /** 保存的视图（筛选组合）：本机偏好，存 localStorage */
  const [views, setViews] = useLocalStore<SavedView[]>('monitor-ai-views', [])
  /** 厂商对比：最多两家，选中两家后在右栏并排比较 */
  const [compareIds, setCompareIds] = useState<string[]>([])

  // ——— 信号维度 ———
  const [category, setCategory] = useState('all')
  const [languageFilter, setLanguageFilter] = useState<'all' | 'zh' | 'en'>('all')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [signalSort, setSignalSort] = useState<'time' | 'importance' | 'credibility'>('time')
  /** 面板内部的下钻词（厂商 → 信号），与顶栏搜索独立，可单独清除 */
  const [drillQuery, setDrillQuery] = useState('')

  // ——— 厂商维度 ———
  const [vendorDays, setVendorDays] = useState(7)
  const [vendorSort, setVendorSort] = useState<{ key: 'count' | 'peak' | 'name'; dir: SortDir }>({ key: 'count', dir: 'desc' })
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)

  // ——— 模型维度 ———
  const { data: arena } = useRemoteData<ArenaResponse>('/api/arena', [], { refreshInterval: 10 * 60 * 1000 })
  const { data: reports } = useRemoteData<ReportsResponse>('/api/model-reports', [], { refreshInterval: 10 * 60 * 1000 })
  const [modelSort, setModelSort] = useState<{ key: 'date' | 'name' | 'vendor'; dir: SortDir }>({ key: 'date', dir: 'desc' })
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)

  const signalRows = useMemo(() => {
    let result = signals
    const query = [searchQuery, drillQuery].filter(Boolean).join(' ').trim().toLowerCase()
    if (query) {
      result = result.filter(s =>
        s.title.toLowerCase().includes(query) ||
        s.summary.toLowerCase().includes(query) ||
        s.tags?.some(t => t.toLowerCase().includes(query))
      )
    }
    if (category !== 'all') result = result.filter(s => s.category === category)
    if (languageFilter !== 'all') result = result.filter(s => s.language === languageFilter)
    if (activeTags.length > 0) result = result.filter(s => s.tags?.some(t => activeTags.includes(t)))
    return [...result].sort((a, b) => {
      if (signalSort === 'importance') return b.importance - a.importance || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      if (signalSort === 'credibility') return b.credibility - a.credibility || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })
  }, [signals, searchQuery, drillQuery, category, languageFilter, activeTags, signalSort])

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    signals.forEach(s => s.tags?.forEach(t => counts.set(t, (counts.get(t) || 0) + 1)))
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 18)
  }, [signals])

  const vendorStats = useMemo(() => computeVendorRows(signals, vendorDays), [signals, vendorDays])
  const vendorRows = useMemo(() => {
    const rows = [...vendorStats.rows]
    const { key, dir } = vendorSort
    rows.sort((a, b) => {
      const cmp = key === 'name'
        ? (zh ? a.nameZh.localeCompare(b.nameZh, 'zh') : a.name.localeCompare(b.name))
        : key === 'peak' ? a.peakImportance - b.peakImportance : a.count - b.count
      return dir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [vendorStats.rows, vendorSort, zh])
  const selectedVendor: VendorRow | null = vendorRows.find(v => v.id === selectedVendorId) ?? null

  const modelRows = useMemo(() => {
    const merged = [...(reports?.curated ?? []), ...(reports?.live ?? [])]
    const seen = new Set<string>()
    const rows = merged.filter(m => m.name && !seen.has(m.id) && seen.add(m.id))
    const { key, dir } = modelSort
    rows.sort((a, b) => {
      const cmp = key === 'name' ? a.name.localeCompare(b.name) : key === 'vendor' ? a.vendor.localeCompare(b.vendor) : a.date.localeCompare(b.date)
      return dir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [reports, modelSort])
  const selectedModel = modelRows.find(m => m.id === selectedModelId) ?? null

  // 模型 → 竞技场各维度分数（名字写法不同，用归一化实体名比对：'DeepSeek-V3.2 系列' vs 'DeepSeek V3.2'）
  const modelBoards = useMemo(() => {
    if (!selectedModel) return []
    return (arena?.boards ?? [])
      .map(b => ({ dimension: b.dimension, entry: b.entries.find(e => sameEntity(e.model, selectedModel.name)) }))
      .filter(x => x.entry)
  }, [arena, selectedModel])

  // 模型 → 相关信号：切词后要求词边界 + 丢掉短 token/停用词，避免 "pro" 命中 improve 这类假关联
  const modelSignals = useMemo(() => {
    if (!selectedModel) return []
    const tokens = entityTokens(selectedModel.name)
    if (tokens.length === 0) return []
    return signals.filter(s => {
      const text = `${s.title} ${s.summary ?? ''}`
      return tokens.some(t => matchesKeyword(text, t))
    }).slice(0, 8)
  }, [selectedModel, signals])

  const count = dimension === 'signals' ? signalRows.length : dimension === 'vendors' ? vendorRows.length : modelRows.length

  const currentViewName = `${zh ? DIMENSIONS.find(d => d.id === dimension)?.zh : DIMENSIONS.find(d => d.id === dimension)?.en}` +
    (dimension === 'signals' ? ` · ${category}` : dimension === 'vendors' ? ` · ${vendorDays}d` : '')

  const saveCurrentView = () => {
    const view: SavedView = {
      id: `${Date.now().toString(36)}`,
      name: currentViewName,
      dimension, category, languageFilter, activeTags, signalSort, vendorDays,
    }
    setViews(prev => [...prev.filter(v => v.name !== view.name), view].slice(-6))
  }

  const applyView = (view: SavedView) => {
    setDimension(view.dimension)
    setCategory(view.category)
    setLanguageFilter(view.languageFilter)
    setActiveTags(view.activeTags)
    setSignalSort(view.signalSort)
    setVendorDays(view.vendorDays)
  }

  // 研判视图下钻：按预设切到信号维度 + 分类筛选（preset 每次是新对象，重复点同一分类也生效）
  useEffect(() => {
    if (!preset) return
    if (preset.dimension) setDimension(preset.dimension)
    if (preset.category) setCategory(preset.category)
  }, [preset])

  // 向上报三个维度的规模：研判视图/模块标头据此展示"检索里有多少可挖"
  useEffect(() => {
    onCounts?.({ signals: signalRows.length, vendors: vendorRows.length, models: modelRows.length })
  }, [signalRows.length, vendorRows.length, modelRows.length, onCounts])

  const isStarred = (kind: 'vendor' | 'model', id: string) => shortlist.includes(shortlistKey(kind, id))
  const compareRows = compareIds.map(id => vendorRows.find(v => v.id === id)).filter(Boolean) as VendorRow[]
  const toggleCompare = (id: string) => setCompareIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-2)))

  // 对比用的四个指标（平均可信度按该厂商命中信号实算）
  const compareMetric = (v: VendorRow) => ({
    mentions: v.count,
    peak: v.peakImportance,
    key: v.bestKey,
    avgCred: v.signals.length > 0 ? (v.signals.reduce((sum, s) => sum + s.credibility, 0) / v.signals.length).toFixed(1) : '—',
  })

  const sortIndicator = (active: boolean, dir: SortDir) => (active ? (dir === 'asc' ? ' ▲' : ' ▼') : '')

  return (
    <PanelBase
      id="intelligence-browser"
      title={hideTitle ? '' : zh ? '情报浏览器' : 'Intelligence Browser'}
      dataBadge={error ? 'unavailable' : 'live'}
      count={count}
      collapsible
      className="flex flex-col h-full"
    >
      <div className="flex flex-col min-h-0 flex-1">
        {/* 维度切换 */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1.5 border-b border-edge">
          {DIMENSIONS.map(d => (
            <button
              key={d.id}
              onClick={() => setDimension(d.id)}
              className={`px-3 py-1 text-[11px] rounded-md transition-colors ${
                dimension === d.id ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'
              }`}
            >
              {zh ? d.zh : d.en}
            </button>
          ))}
          <button
            onClick={saveCurrentView}
            title={zh ? `保存当前筛选组合：${currentViewName}` : `Save current filters: ${currentViewName}`}
            className="ml-auto text-[10px] px-2 py-0.5 rounded border border-edge text-muted hover:text-accent hover:border-[#06b6d4]/30 transition-colors"
          >
            {zh ? '保存视图' : 'Save view'}
          </button>
          <span className="text-[10px] text-muted tabular-nums">
            {count} {zh ? '条' : 'rows'}
          </span>
        </div>

        {/* 已保存的视图：点名字套用，✕ 删除（存 localStorage，不落库） */}
        {views.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-b border-edge">
            <span className="text-[10px] text-dim">{zh ? '视图' : 'Views'}</span>
            {views.map(v => (
              <span key={v.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-edge text-muted">
                <button onClick={() => applyView(v)} className="hover:text-accent transition-colors">{v.name}</button>
                <button
                  onClick={() => setViews(prev => prev.filter(x => x.id !== v.id))}
                  className="text-dim hover:text-[var(--error)] transition-colors"
                  title={zh ? '删除视图' : 'Delete view'}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {/* ——— 信号维度：筛选 + 标签 + 卡片 ——— */}
        {dimension === 'signals' && (
          <>
            <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-edge">
              <div className="flex items-center gap-0.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-all ${category === cat.key ? 'bg-accent-bg text-accent font-medium' : 'text-muted hover:text-ink-2 hover:bg-overlay'}`}
                  >
                    {zh ? cat.zh : cat.en}
                  </button>
                ))}
              </div>
              <div className="w-px h-4 bg-edge" />
              <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value as 'all' | 'zh' | 'en')} className="text-[11px] bg-elevated border border-edge-light rounded px-2 py-1 text-ink outline-none">
                <option value="all">{zh ? '全部语言' : 'All Languages'}</option>
                <option value="en">English</option>
                <option value="zh">中文</option>
              </select>
              <select value={signalSort} onChange={e => setSignalSort(e.target.value as 'time' | 'importance' | 'credibility')} className="text-[11px] bg-elevated border border-edge-light rounded px-2 py-1 text-ink outline-none">
                <option value="time">{zh ? '按时间' : 'By time'}</option>
                <option value="importance">{zh ? '按重要度' : 'By importance'}</option>
                <option value="credibility">{zh ? '按可信度' : 'By credibility'}</option>
              </select>
              {drillQuery && (
                <button onClick={() => setDrillQuery('')} className="text-[10px] px-2 py-0.5 rounded-full bg-accent-bg border border-accent text-accent">
                  {zh ? `厂商命中词：${drillQuery}` : `vendor key: ${drillQuery}`} ×
                </button>
              )}
              {searchQuery && <span className="text-[10px] text-accent font-mono">{zh ? `搜索「${searchQuery}」` : `search "${searchQuery}"`}</span>}
            </div>

            {tagCounts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-edge">
                {activeTags.length > 0 && (
                  <button onClick={() => setActiveTags([])} className="text-[10px] text-muted hover:text-ink-2 mr-1">{zh ? '清除' : 'Clear'} ×</button>
                )}
                {tagCounts.map(([tag, n]) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))}
                    className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${activeTags.includes(tag) ? 'bg-accent-bg border-accent text-accent' : 'border-edge text-muted hover:border-edge-light hover:text-ink-2'}`}
                  >
                    #{tag} <span className="text-[10px] opacity-60">{n}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-24 bg-card rounded animate-pulse" />)}
                </div>
              ) : signalRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-muted">
                  <p className="text-[11px]">{zh ? '当前筛选条件下暂无信号' : 'No signals match current filters'}</p>
                  <p className="text-[10px] mt-1">{zh ? '试试切换分类、时间范围，或清空标签/搜索' : 'Try another category, time range, or clear tags/search'}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {signalRows.map(s => (
                    <button key={s.id} onClick={() => onSelectSignal(s)} className="text-left">
                      <SignalCard signal={s} locale={locale} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ——— 厂商维度：表 + 档案 ——— */}
        {dimension === 'vendors' && (
          <div className="flex flex-col md:flex-row flex-1 min-h-0">
            <div className="md:w-[46%] md:min-w-[330px] border-b md:border-b-0 md:border-r border-edge flex flex-col min-h-0">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-edge text-[10px]">
                <select value={vendorDays} onChange={e => setVendorDays(Number(e.target.value))} className="bg-elevated border border-edge-light rounded px-2 py-1 text-ink outline-none">
                  <option value={7}>{zh ? '近 7 日' : 'Last 7d'}</option>
                  <option value={30}>{zh ? '近 30 日' : 'Last 30d'}</option>
                </select>
                <button onClick={() => setVendorSort(s => ({ key: 'count', dir: s.key === 'count' && s.dir === 'desc' ? 'asc' : 'desc' }))} className={`px-1.5 py-0.5 rounded ${vendorSort.key === 'count' ? 'text-accent' : 'text-muted hover:text-ink-2'}`}>
                  {zh ? '提及' : 'Mentions'}{sortIndicator(vendorSort.key === 'count', vendorSort.dir)}
                </button>
                <button onClick={() => setVendorSort(s => ({ key: 'peak', dir: s.key === 'peak' && s.dir === 'desc' ? 'asc' : 'desc' }))} className={`px-1.5 py-0.5 rounded ${vendorSort.key === 'peak' ? 'text-accent' : 'text-muted hover:text-ink-2'}`}>
                  {zh ? '重要度' : 'Peak'}{sortIndicator(vendorSort.key === 'peak', vendorSort.dir)}
                </button>
                <button onClick={() => setVendorSort(s => ({ key: 'name', dir: s.key === 'name' && s.dir === 'asc' ? 'desc' : 'asc' }))} className={`px-1.5 py-0.5 rounded ${vendorSort.key === 'name' ? 'text-accent' : 'text-muted hover:text-ink-2'}`}>
                  {zh ? '名称' : 'Name'}{sortIndicator(vendorSort.key === 'name', vendorSort.dir)}
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {vendorRows.length === 0 ? (
                  <p className="px-3 py-6 text-[11px] text-muted">{zh ? `近 ${vendorDays} 日无厂商提及` : `No vendor mentions in ${vendorDays}d`}</p>
                ) : vendorRows.map((v, i) => {
                  const active = v.id === selectedVendorId
                  const max = vendorRows[0]?.count || 1
                  const starred = isStarred('vendor', v.id)
                  const compared = compareIds.includes(v.id)
                  return (
                    <div key={v.id} className={`flex items-center border-b border-edge-60 transition-colors ${active ? 'bg-accent-bg' : 'hover:bg-overlay'}`}>
                      <button onClick={() => setSelectedVendorId(v.id)} className="flex-1 flex items-center gap-2 px-3 py-2 text-left min-w-0">
                        <span className="text-[10px] font-mono w-4 text-right text-dim">{i + 1}</span>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: v.color }} />
                        <span className={`text-[11px] w-[80px] truncate shrink-0 ${active ? 'text-ink' : 'text-ink-2'}`}>{zh ? v.nameZh : v.name}</span>
                        <span className="flex-1 h-1.5 bg-hover rounded-full overflow-hidden">
                          <span className="block h-full rounded-full" style={{ width: `${Math.round((v.count / max) * 100)}%`, background: v.color }} />
                        </span>
                        <span className="text-[10px] font-mono text-ink tabular-nums">{v.count}</span>
                      </button>
                      <button
                        onClick={() => onToggleShortlist?.(shortlistKey('vendor', v.id))}
                        title={starred ? (zh ? '移出关注清单' : 'Remove from shortlist') : (zh ? '加入关注清单' : 'Add to shortlist')}
                        className={`px-0.5 text-[11px] transition-colors ${starred ? 'text-accent' : 'text-dim hover:text-ink-2'}`}
                      >
                        {starred ? '★' : '☆'}
                      </button>
                      <button
                        onClick={() => toggleCompare(v.id)}
                        title={zh ? '加入对比（最多两家）' : 'Compare (up to two)'}
                        className={`px-1.5 pr-3 text-[10px] transition-colors ${compared ? 'text-accent' : 'text-dim hover:text-ink-2'}`}
                      >
                        {compared ? '◉' : '⇄'}
                      </button>
                    </div>
                  )
                })}
              </div>
              <p className="px-3 py-1.5 border-t border-edge text-[10px] text-muted">
                {zh ? `${vendorStats.matchedVendors} 家有提及 / ${vendorStats.inWindow} 条信号` : `${vendorStats.matchedVendors} vendors / ${vendorStats.inWindow} signals`}
                {vendorStats.matchedVendors < 5 ? (zh ? ' · 样本偏少，仅供排序参考' : ' · small sample') : ''}
              </p>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              {/* 对比：勾两家就在这儿并排看四个指标 */}
              {compareRows.length === 2 && (
                <div className="mb-3 rounded-md border border-edge overflow-hidden">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-edge">
                    <span className="text-[10px] text-muted uppercase tracking-wider">{zh ? '厂商对比' : 'Vendor compare'}</span>
                    <button onClick={() => setCompareIds([])} className="text-[10px] text-dim hover:text-ink-2">{zh ? '清除' : 'Clear'}</button>
                  </div>
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="text-muted">
                        <th className="text-left font-normal px-2 py-1 w-[92px]">{zh ? '指标' : 'Metric'}</th>
                        {compareRows.map(v => (
                          <th key={v.id} className="text-left font-semibold text-ink px-2 py-1">
                            <span className="inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: v.color }} />
                              {zh ? v.nameZh : v.name}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="font-mono tabular-nums">
                      {([
                        [zh ? '提及' : 'mentions', (v: VendorRow) => compareMetric(v).mentions],
                        [zh ? '最高重要度' : 'peak', (v: VendorRow) => compareMetric(v).peak],
                        [zh ? '平均可信度' : 'avg credibility', (v: VendorRow) => compareMetric(v).avgCred],
                        [zh ? '命中词' : 'key', (v: VendorRow) => compareMetric(v).key],
                      ] as [string, (v: VendorRow) => string | number][]).map(([label, pick]) => (
                        <tr key={label} className="border-t border-edge-60">
                          <td className="px-2 py-1 text-muted font-sans">{label}</td>
                          {compareRows.map(v => (
                            <td key={v.id} className="px-2 py-1 text-ink-2">{pick(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!selectedVendor ? (
                <p className="text-[11px] text-muted">{zh ? '选择左侧厂商查看档案' : 'Select a vendor on the left'}</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: selectedVendor.color }} />
                      <h3 className="text-[13px] font-semibold text-ink">{zh ? selectedVendor.nameZh : selectedVendor.name}</h3>
                      <button
                        onClick={() => onToggleShortlist?.(shortlistKey('vendor', selectedVendor.id))}
                        title={zh ? '加入/移出关注清单' : 'Toggle shortlist'}
                        className={`text-[11px] transition-colors ${isStarred('vendor', selectedVendor.id) ? 'text-accent' : 'text-dim hover:text-ink-2'}`}
                      >
                        {isStarred('vendor', selectedVendor.id) ? '★' : '☆'}
                      </button>
                      <Link href={`/entity/vendor/${selectedVendor.id}`} className="ml-auto text-[10px] text-accent hover:underline shrink-0">
                        {zh ? '完整档案 →' : 'Full profile →'}
                      </Link>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-muted">
                      <span>{zh ? `近 ${vendorDays} 日提及` : `mentions/${vendorDays}d`} <span className="text-ink-2">{selectedVendor.count}</span></span>
                      <span>{zh ? '最高重要度' : 'peak'} <span className="text-ink-2">{selectedVendor.peakImportance}</span></span>
                      <span>{zh ? '命中词' : 'key'} <span className="text-ink-2">{selectedVendor.bestKey}</span></span>
                    </div>
                    <button
                      onClick={() => { setDrillQuery(selectedVendor.bestKey); setDimension('signals') }}
                      className="mt-2 text-[10px] px-2 py-1 rounded border border-edge text-muted hover:text-accent hover:border-[#06b6d4]/30 transition-colors"
                    >
                      {zh ? `在信号维度中只看这些（${selectedVendor.bestKey}）→` : `Show these signals (${selectedVendor.bestKey}) →`}
                    </button>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1.5">{zh ? '相关信号' : 'Signals'}</p>
                    <div className="space-y-1">
                      {selectedVendor.signals.map(s => (
                        <button key={s.id} onClick={() => onSelectSignal(s)} className="w-full text-left px-2 py-1.5 rounded hover:bg-overlay transition-colors">
                          <p className="text-[11px] text-ink-2 line-clamp-1">{s.title}</p>
                          <p className="text-[10px] text-dim">{s.source} · {s.category} · {'●'.repeat(s.importance)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ——— 模型维度：表 + 档案 ——— */}
        {dimension === 'models' && (
          <div className="flex flex-col md:flex-row flex-1 min-h-0">
            <div className="md:w-[46%] md:min-w-[330px] border-b md:border-b-0 md:border-r border-edge flex flex-col min-h-0">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-edge text-[10px]">
                <button onClick={() => setModelSort(s => ({ key: 'date', dir: s.key === 'date' && s.dir === 'desc' ? 'asc' : 'desc' }))} className={`px-1.5 py-0.5 rounded ${modelSort.key === 'date' ? 'text-accent' : 'text-muted hover:text-ink-2'}`}>
                  {zh ? '日期' : 'Date'}{sortIndicator(modelSort.key === 'date', modelSort.dir)}
                </button>
                <button onClick={() => setModelSort(s => ({ key: 'name', dir: s.key === 'name' && s.dir === 'asc' ? 'desc' : 'asc' }))} className={`px-1.5 py-0.5 rounded ${modelSort.key === 'name' ? 'text-accent' : 'text-muted hover:text-ink-2'}`}>
                  {zh ? '名称' : 'Name'}{sortIndicator(modelSort.key === 'name', modelSort.dir)}
                </button>
                <button onClick={() => setModelSort(s => ({ key: 'vendor', dir: s.key === 'vendor' && s.dir === 'asc' ? 'desc' : 'asc' }))} className={`px-1.5 py-0.5 rounded ${modelSort.key === 'vendor' ? 'text-accent' : 'text-muted hover:text-ink-2'}`}>
                  {zh ? '厂商' : 'Vendor'}{sortIndicator(modelSort.key === 'vendor', modelSort.dir)}
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {modelRows.length === 0 ? (
                  <p className="px-3 py-6 text-[11px] text-muted">{zh ? '模型数据加载中或不可用' : 'Model data loading or unavailable'}</p>
                ) : modelRows.map(m => {
                  const active = m.id === selectedModelId
                  const starred = isStarred('model', m.id)
                  return (
                    <div key={m.id} className={`flex items-center border-b border-edge-60 transition-colors ${active ? 'bg-accent-bg' : 'hover:bg-overlay'}`}>
                      <button onClick={() => setSelectedModelId(m.id)} className="flex-1 flex items-center gap-2 px-3 py-2 text-left min-w-0">
                        <span className={`text-[11px] flex-1 truncate ${active ? 'text-ink' : 'text-ink-2'}`}>{m.name}</span>
                        <span className="text-[10px] text-muted shrink-0">{m.vendor}</span>
                        <span className="text-[10px] font-mono text-dim shrink-0 tabular-nums">{m.date}</span>
                      </button>
                      <button
                        onClick={() => onToggleShortlist?.(shortlistKey('model', m.id))}
                        title={starred ? (zh ? '移出关注清单' : 'Remove from shortlist') : (zh ? '加入关注清单' : 'Add to shortlist')}
                        className={`px-2 pr-3 text-[11px] transition-colors ${starred ? 'text-accent' : 'text-dim hover:text-ink-2'}`}
                      >
                        {starred ? '★' : '☆'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              {!selectedModel ? (
                <p className="text-[11px] text-muted">{zh ? '选择左侧模型查看档案' : 'Select a model on the left'}</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[13px] font-semibold text-ink truncate">{selectedModel.name}</h3>
                      <button
                        onClick={() => onToggleShortlist?.(shortlistKey('model', selectedModel.id))}
                        title={zh ? '加入/移出关注清单' : 'Toggle shortlist'}
                        className={`text-[11px] transition-colors shrink-0 ${isStarred('model', selectedModel.id) ? 'text-accent' : 'text-dim hover:text-ink-2'}`}
                      >
                        {isStarred('model', selectedModel.id) ? '★' : '☆'}
                      </button>
                      <Link href={`/entity/model/${encodeURIComponent(selectedModel.id)}`} className="ml-auto text-[10px] text-accent hover:underline shrink-0">
                        {zh ? '完整档案 →' : 'Full profile →'}
                      </Link>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-muted">
                      <span>{zh ? '厂商' : 'vendor'} <span className="text-ink-2">{selectedModel.vendor}</span></span>
                      <span>{zh ? '类型' : 'type'} <span className="text-ink-2">{selectedModel.type}</span></span>
                      <span>{zh ? '日期' : 'date'} <span className="text-ink-2">{selectedModel.date}</span></span>
                    </div>
                    <a href={selectedModel.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[10px] text-accent hover:underline break-all">
                      {selectedModel.sourceUrl}
                    </a>
                  </div>

                  {selectedModel.keyChange && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{zh ? '关键变化' : 'Key change'}</p>
                      <p className="text-[11px] text-ink-2 leading-relaxed">{selectedModel.keyChange}</p>
                    </div>
                  )}
                  {selectedModel.usageImpact && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{zh ? '使用影响' : 'Impact'}</p>
                      <p className="text-[11px] text-ink-2 leading-relaxed">{selectedModel.usageImpact}</p>
                    </div>
                  )}

                  {modelBoards.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{zh ? '竞技场分数' : 'Arena scores'}</p>
                      <div className="space-y-1">
                        {modelBoards.map(b => (
                          <div key={b.dimension} className="flex items-center gap-2 text-[11px]">
                            <span className="text-muted w-[92px] truncate">{b.dimension}</span>
                            <span className="text-ink font-mono tabular-nums">{b.entry?.score}</span>
                            <span className="text-dim text-[10px] truncate">{b.entry?.organization}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{zh ? '相关信号' : 'Signals'}</p>
                    {modelSignals.length === 0 ? (
                      <p className="text-[10px] text-dim">{zh ? '近 7 日无匹配信号' : 'No matching signals'}</p>
                    ) : (
                      <div className="space-y-1">
                        {modelSignals.map(s => (
                          <button key={s.id} onClick={() => onSelectSignal(s)} className="w-full text-left px-2 py-1.5 rounded hover:bg-overlay transition-colors">
                            <p className="text-[11px] text-ink-2 line-clamp-1">{s.title}</p>
                            <p className="text-[10px] text-dim">{s.source} · {s.category}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PanelBase>
  )
}
