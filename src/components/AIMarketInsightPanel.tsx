'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { type Locale } from '@/lib/i18n'
import type { Signal } from '@/types/signal'
import { AI_EVENT_IMPACTS } from '@/data/ai-stocks'
import PanelBase from './PanelBase'

interface Props { locale: Locale; signals: Signal[] }

/* ───────────────────────────────────────────────
 * Reusable auto-scroll list (continuous ticker)
 * ─────────────────────────────────────────────── */
function AutoScrollList({ items, renderItem, speed = 20 }: {
  items: { id: string }[]
  renderItem: (item: any, i: number) => React.ReactNode
  speed?: number
}) {
  const stripRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const offsetRef = useRef(0)
  const lastRef = useRef(0)
  const heightsRef = useRef<number[]>([])
  const itemsLenRef = useRef(items.length)
  itemsLenRef.current = items.length

  const measure = useCallback(() => {
    const el = stripRef.current
    if (!el) return
    heightsRef.current = Array.from(el.querySelectorAll('[data-as-item]'))
      .map(e => (e as HTMLElement).offsetHeight)
  }, [])

  useEffect(() => { requestAnimationFrame(measure) }, [items])

  useEffect(() => {
    let running = true
    const animate = (ts: number) => {
      if (!running) return
      if (itemsLenRef.current > 1) {
        if (!lastRef.current) lastRef.current = ts
        const dt = (ts - lastRef.current) / 1000
        lastRef.current = ts
        offsetRef.current += speed * dt

        const strip = stripRef.current
        const hh = heightsRef.current
        if (strip && hh.length > 0) {
          const half = Math.floor(hh.length / 2)
          const first = hh.slice(0, half)
          const total = first.reduce((a, b) => a + b, 0)
          if (total > 0) {
            if (offsetRef.current >= total) offsetRef.current -= total
            strip.style.transform = `translateY(-${offsetRef.current}px)`
          }
        }
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { running = false; cancelAnimationFrame(rafRef.current) }
  }, [speed])

  return (
    <div className="overflow-hidden" style={{ minHeight: 0 }}>
      <div ref={stripRef} className="will-change-transform" style={{ transform: 'translateY(0px)' }}>
        <div>{items.map((item, i) => <div key={item.id} data-as-item>{renderItem(item, i)}</div>)}</div>
        <div>{items.map((item, i) => <div key={`d-${item.id}`} data-as-item>{renderItem(item, i)}</div>)}</div>
      </div>
    </div>
  )
}

/* ───────────────────────────────────────────────
 * Card wrapper
 * ─────────────────────────────────────────────── */
function Card({ icon, title, subtitle, children, bodyClass = '' }: {
  icon: string; title: string; subtitle: string; children: React.ReactNode; bodyClass?: string
}) {
  return (
    <div className="bg-[#0c0c14] border border-[#1e1e2e] rounded-lg overflow-hidden flex flex-col">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-[#1e1e2e]/50 shrink-0">
        <span className="text-[11px]">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8b8ba0]">{title}</span>
        <span className="text-[8px] text-[#5c5c72] ml-auto">{subtitle}</span>
      </div>
      <div className={`flex-1 min-h-0 px-2.5 py-1.5 ${bodyClass}`}>
        {children}
      </div>
    </div>
  )
}

/* ───────────────────────────────────────────────
 * Card 1: GitHub AI trending
 * ─────────────────────────────────────────────── */
interface Repo { id: number; name: string; description: string | null; url: string; stars: number; language: string | null }

/** Simple bilingual description map for common GitHub repos */
function repoDescription(repo: Repo, locale: Locale): string {
  if (locale === 'zh') {
    // Chinese descriptions for well-known AI repos
    const zhMap: Record<string, string> = {
      'langchain': '构建LLM应用的开发框架，解决大语言模型集成与编排问题',
      'langchain-ai': '构建LLM应用的开发框架，解决大语言模型集成与编排问题',
      'candle': '用Rust实现的轻量级ML推理框架，适合边缘设备部署',
      'huggingface': '开源模型与数据集社区平台，提供Transformers等核心库',
      'transformers': 'HuggingFace开源的Transformer模型库，支持BERT/GPT等预训练模型',
      'ollama': '本地运行大语言模型的工具，解决私有化部署与隐私保护问题',
      'openai': 'OpenAI官方工具和SDK，简化GPT/Whisper等API集成开发',
      'pytorch': 'Meta开源的深度学习框架，提供动态计算图和自动求导',
      'tensorflow': 'Google开源的机器学习框架，支持生产级模型部署',
      'vllm': '高性能LLM推理引擎，通过PagedAttention优化显存和吞吐',
      'llama': 'Meta开源的大语言模型系列，推动AI民主化和私有化部署',
      'llama.cpp': '在本地CPU/GPU上运行LLM的C++实现，解决大模型本地推理问题',
      'autogpt': '基于GPT的自主Agent框架，让AI自动完成复杂任务',
      'copilot': 'AI编程助手，帮助开发者自动生成和补全代码',
      'stable-diffusion': '开源文生图模型，推动AI图像生成技术普及',
      'comfyui': '基于节点工作流的Stable Diffusion GUI，简化AI图像生成流程',
      'xinference': '分布式LLM推理平台，支持多种模型的统一部署和管理',
      'fastchat': '大语言模型训练/服务/评估平台，支持多种开源模型的快速部署',
    }
    for (const [key, zh] of Object.entries(zhMap)) {
      if (repo.name.toLowerCase().includes(key)) return zh
    }
  }
  return repo.description || (locale === 'zh' ? '暂无简介' : 'No description')
}

function GitHubCard({ locale }: { locale: Locale }) {
  const [repos, setRepos] = useState<Repo[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/github-trending')
      .then(r => r.json())
      .then(d => { if (!cancelled && Array.isArray(d)) setRepos(d) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [])

  const langIcon = (l: string | null) => {
    if (l === 'Python') return '🐍'; if (l === 'Rust') return '🦀'
    if (l === 'TypeScript') return '🔷'; if (l === 'Jupyter Notebook') return '📓'
    if (l === 'Go') return '🔵'; if (l === 'C++') return '⚡'
    return '📦'
  }

  return (
    <Card icon="⭐" title={locale === 'zh' ? 'GitHub 趋势' : 'GitHub Trending'}
      subtitle={locale === 'zh' ? '最火 + 最新' : 'hottest · latest'} bodyClass="max-h-[152px]">
      {error ? (
        <div className="text-[10px] text-[#5c5c72] text-center py-4">{locale === 'zh' ? '加载失败' : 'Failed to load'}</div>
      ) : !repos ? (
        <div className="space-y-1">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-[#1e1e2e] rounded animate-pulse-slow" />)}</div>
      ) : repos.length === 0 ? (
        <div className="text-[10px] text-[#5c5c72] text-center py-4">{locale === 'zh' ? '暂无数据' : 'No data'}</div>
      ) : (
        <AutoScrollList items={repos} speed={16} renderItem={(r: Repo) => (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="block py-1 px-1 rounded hover:bg-[#16162a] transition-colors group -mx-0.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] shrink-0">{langIcon(r.language)}</span>
              <span className="text-[10px] text-[#e5e5e5] truncate group-hover:text-[#06b6d4] transition-colors">{r.name}</span>
              <span className="text-[9px] font-mono text-[#f59e0b] shrink-0 ml-auto">★{r.stars >= 1000 ? `${(r.stars / 1000).toFixed(1)}k` : r.stars}</span>
            </div>
            <div className="text-[8px] text-[#5c5c72] leading-snug truncate mt-0.5">
              {repoDescription(r, locale)}
            </div>
          </a>
        )} />
      )}
    </Card>
  )
}

/* ───────────────────────────────────────────────
 * Card 2: AI papers from signal stream
 * ─────────────────────────────────────────────── */
function PapersCard({ signals, locale }: { signals: Signal[]; locale: Locale }) {
  const threeMonthsAgo = Date.now() - 90 * 86400000
  // Dedup by normalized title (remove punctuation, collapse spaces)
  const seen = new Set<string>()
  const papers = signals
    .filter(s => s.category === 'papers' && new Date(s.publishedAt).getTime() > threeMonthsAgo)
    .filter(s => {
      const key = s.title.toLowerCase().replace(/[:\-–—,.\/\\()\[\]{}《》「」『』【】、，。！？；：""''【】]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 7)

  return (
    <Card icon="📄" title={locale === 'zh' ? 'AI 论文' : 'AI Papers'}
      subtitle={locale === 'zh' ? '信号流' : 'signal stream'} bodyClass="max-h-[152px]">
      {papers.length === 0 ? (
        <div className="text-[10px] text-[#5c5c72] text-center py-4">{locale === 'zh' ? '暂无论文信号' : 'No papers yet'}</div>
      ) : (
        <AutoScrollList items={papers} speed={14} renderItem={(s: Signal) => (
          <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="block py-1 px-1 rounded hover:bg-[#16162a] transition-colors group -mx-0.5">
            <div className="text-[10px] text-[#e5e5e5] leading-snug truncate group-hover:text-[#06b6d4] transition-colors">
              {s.title}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[8px] text-[#5c5c72] truncate max-w-[80px]">{s.source}</span>
              <span className="text-[7px] text-[#3c3c52]">·</span>
              <span className="text-[8px] font-mono text-[#5c5c72]">{new Date(s.publishedAt).toISOString().slice(0, 10)}</span>
              {s.summary && (
                <span className="text-[8px] text-[#8b8ba0] truncate flex-1">{s.summary}</span>
              )}
            </div>
          </a>
        )} />
      )}
    </Card>
  )
}

/* ───────────────────────────────────────────────
 * Card 3: Events
 * ─────────────────────────────────────────────── */
function EventsCard({ locale }: { locale: Locale }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const displayEvents = showAll ? AI_EVENT_IMPACTS : AI_EVENT_IMPACTS.slice(0, 2)

  return (
    <Card icon="📊" title={locale === 'zh' ? '市场影响' : 'Market Impact'}
      subtitle={locale === 'zh' ? '事件分析' : 'event intelligence'}>
      <div className="space-y-1">
        {displayEvents.map(event => {
          const isExpanded = expanded === event.id
          const impactColor = event.impact === 'positive' ? 'text-emerald-400' : event.impact === 'negative' ? 'text-rose-400' : 'text-[#8b8ba0]'
          const impactLabel = event.impact === 'positive' ? (locale === 'zh' ? '利好' : 'Bullish') : event.impact === 'negative' ? (locale === 'zh' ? '利空' : 'Bearish') : (locale === 'zh' ? '中性' : 'Neutral')
          return (
            <div key={event.id} className="border border-[#1e1e2e] rounded-md px-2 py-1 hover:border-[#2a2a3e] transition-colors cursor-pointer"
              onClick={() => setExpanded(isExpanded ? null : event.id)}>
              <div className="flex items-start gap-1.5">
                <span className={`text-[10px] mt-0.5 shrink-0 ${impactColor}`}>{event.impact === 'positive' ? '▲' : event.impact === 'negative' ? '▼' : '◆'}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-[#e5e5e5] truncate">{locale === 'zh' ? event.titleZh : event.title}</div>
                  {isExpanded && <div className="mt-0.5 text-[9px] text-[#8b8ba0] leading-relaxed">{locale === 'zh' ? event.summaryZh : event.summary}</div>}
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    <span className={`text-[8px] font-semibold ${impactColor}`}>{impactLabel}</span>
                    <span className="text-[7px] text-[#5c5c72]">·</span>
                    <span className="text-[8px] text-[#5c5c72]">{event.affectedStocks.join(', ')}</span>
                    <span className="text-[7px] text-[#5c5c72]">·</span>
                    <span className="text-[8px] text-[#5c5c72]">{event.date}</span>
                  </div>
                </div>
                <span className="shrink-0 px-1 py-0.5 text-[7px] font-semibold uppercase tracking-wider rounded bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20">HOT</span>
              </div>
            </div>
          )
        })}
      </div>
      {AI_EVENT_IMPACTS.length > 2 && (
        <button onClick={() => setShowAll(!showAll)}
          className="w-full text-[9px] text-[#06b6d4]/60 hover:text-[#06b6d4] transition-colors py-0.5 mt-0.5">
          {showAll ? (locale === 'zh' ? '收起' : 'Show less') : (locale === 'zh' ? `查看全部 ${AI_EVENT_IMPACTS.length} 条 →` : `View all ${AI_EVENT_IMPACTS.length} →`)}
        </button>
      )}
    </Card>
  )
}

/* ───────────────────────────────────────────────
 * Panel assembly
 * ─────────────────────────────────────────────── */
export default function AIMarketInsightPanel({ locale, signals }: Props) {
  return (
    <PanelBase id="ai-market-insight" title={locale === 'zh' ? 'AI 实时洞察' : 'AI Live Insights'} dataBadge="live" collapsible>
      <div className="p-2.5 space-y-2 overflow-y-auto" style={{ maxHeight: '100%' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <GitHubCard locale={locale} />
          <PapersCard signals={signals} locale={locale} />
        </div>
        <EventsCard locale={locale} />
      </div>
    </PanelBase>
  )
}
