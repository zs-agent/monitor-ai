// /api/model-reports — 模型技术报告与论文：动态追踪 + 静态基准
// 动态源（真实接口）：
//   1. HuggingFace Daily Papers（最新 AI 论文）
//   2. HuggingFace Models（按厂商关键词搜最新开源权重）
// 静态基准：src/data/model-reports.ts（人工核实的 2025 快照，标注 REF）
// 降级链：live → cached（15min）→ partial（单接口失败）→ static（全失败，仅快照）
import { NextResponse } from 'next/server'
import { MODEL_REPORTS, type ModelReportItem, type ModelReportType } from '@/data/model-reports'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

const TIMEOUT = 10000
const CACHE_TTL = 15 * 60 * 1000

interface CacheEntry {
  live: ModelReportItem[]
  fetchedAt: number
  partialSources: string[]
}
let modelReportsCache: CacheEntry | null = null

/** 厂商关键词 → 展示名（用于标题/模型 id 推断与厂商搜索） */
const VENDOR_KEYWORDS: [string, string][] = [
  ['deepseek', 'DeepSeek'], ['qwen', 'Qwen'], ['kimi', 'Kimi'], ['moonshot', 'Kimi'],
  ['minimax', 'MiniMax'], ['glm', '智谱'], ['doubao', '豆包'], ['seed', '豆包'],
  ['openai', 'OpenAI'], ['gpt', 'OpenAI'], ['claude', 'Anthropic'], ['anthropic', 'Anthropic'],
  ['gemini', 'Google'], ['gemma', 'Google'], ['google', 'Google'], ['llama', 'Meta'],
  ['mistral', 'Mistral'], ['phi', 'Microsoft'], ['grok', 'xAI'], ['qwen3', 'Qwen'],
]

function inferVendor(text: string): string {
  const t = text.toLowerCase()
  for (const [kw, vendor] of VENDOR_KEYWORDS) {
    if (t.includes(kw)) return vendor
  }
  return '—'
}

function inferType(text: string): ModelReportType {
  const t = text.toLowerCase()
  if (t.includes('technical report')) return 'Technical Report'
  if (t.includes('model card')) return 'Model Card'
  if (t.includes('survey') || t.includes('benchmark') || t.includes('evaluation')) return '论文'
  return '论文'
}

interface HfPaper {
  id: string
  title: string
  summary?: string | null
  publishedAt?: string
  projectPage?: string | null
  githubRepo?: string | null
}

interface HfModel {
  id: string
  lastModified?: string
}

function hfPaperToItem(p: HfPaper): ModelReportItem {
  const title = (p.title || '').trim()
  return {
    id: `hf-${p.id}`,
    vendor: inferVendor(title),
    name: title.length > 80 ? title.slice(0, 80) + '…' : title,
    type: inferType(title),
    date: (p.publishedAt || '').slice(0, 7),
    sourceUrl: p.projectPage || p.githubRepo || `https://huggingface.co/papers/${p.id}`,
    keyChange: (p.summary || '').replace(/\s+/g, ' ').trim().slice(0, 140),
    usageImpact: '',
  }
}

function hfModelToItem(m: HfModel, vendor: string): ModelReportItem {
  const shortName = m.id.split('/').pop() || m.id
  return {
    id: `hm-${m.id}`,
    vendor,
    name: shortName,
    type: '开源权重',
    date: (m.lastModified || '').slice(0, 7),
    sourceUrl: `https://huggingface.co/${m.id}`,
    keyChange: `HuggingFace 最新权重更新：${m.id}`,
    usageImpact: '',
  }
}

/** 拉取 HF Daily Papers */
async function fetchHfPapers(): Promise<HfPaper[]> {
  const res = await fetchWithTimeout(
    'https://huggingface.co/api/papers?limit=8',
    { headers: { 'User-Agent': 'monitor-ai/1.0' } },
    TIMEOUT,
  )
  if (!res.ok) throw new Error(`HF papers HTTP ${res.status}`)
  const body = await res.json()
  if (!Array.isArray(body)) throw new Error('HF papers: unexpected shape')
  return body as HfPaper[]
}

/** 按厂商关键词搜索最新开源权重（并行） */
async function fetchHfVendorModels(): Promise<ModelReportItem[]> {
  const keywords = ['deepseek', 'qwen', 'glm', 'kimi', 'minimax', 'doubao', 'llama', 'gemma', 'mistral', 'phi', 'grok']
  const results = await Promise.allSettled(keywords.map(async kw => {
    const res = await fetchWithTimeout(
      `https://huggingface.co/api/models?search=${encodeURIComponent(kw)}&sort=lastModified&direction=-1&limit=2`,
      { headers: { 'User-Agent': 'monitor-ai/1.0' } },
      TIMEOUT,
    )
    if (!res.ok) return []
    const body = await res.json()
    if (!Array.isArray(body)) return []
    const vendor = inferVendor(kw)
    return (body as HfModel[])
      .filter(m => typeof m.id === 'string')
      .map(m => hfModelToItem(m, vendor))
  }))
  return results
    .filter((r): r is PromiseFulfilledResult<ModelReportItem[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
}

export async function GET() {
  const now = Date.now()

  if (modelReportsCache && now - modelReportsCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({
      state: 'cached',
      fetchedAt: new Date(modelReportsCache.fetchedAt).toISOString(),
      live: modelReportsCache.live,
      curated: MODEL_REPORTS,
      partialSources: modelReportsCache.partialSources,
      note: '动态数据来自 HuggingFace（Daily Papers + 厂商模型）；静态基准为人工核实快照（REF）',
    })
  }

  const [papersRes, modelsRes] = await Promise.allSettled([fetchHfPapers(), fetchHfVendorModels()])
  const partialSources: string[] = []
  const live: ModelReportItem[] = []

  if (papersRes.status === 'fulfilled') {
    live.push(...papersRes.value.map(hfPaperToItem))
  } else {
    partialSources.push('huggingface-papers')
  }
  if (modelsRes.status === 'fulfilled') {
    live.push(...modelsRes.value)
  } else {
    partialSources.push('huggingface-models')
  }

  // 全部失败 → 仅静态快照
  if (live.length === 0) {
    return NextResponse.json({
      state: 'static',
      fetchedAt: new Date(now).toISOString(),
      live: [],
      curated: MODEL_REPORTS,
      partialSources,
      note: 'HuggingFace 暂不可达，当前仅显示静态快照（REF）',
    })
  }

  // 去重 + 排序（按日期倒序，无日期排后）
  const seen = new Set<string>()
  const dedup = live.filter(i => {
    const key = i.name.toLowerCase().slice(0, 60)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))

  const state = partialSources.length === 0 ? 'live' : 'partial'
  modelReportsCache = { live: dedup.slice(0, 30), fetchedAt: now, partialSources }

  return NextResponse.json({
    state,
    fetchedAt: new Date(now).toISOString(),
    live: dedup.slice(0, 30),
    curated: MODEL_REPORTS,
    partialSources,
    note: '动态数据来自 HuggingFace（Daily Papers + 厂商模型）；静态基准为人工核实快照（REF）',
  })
}
