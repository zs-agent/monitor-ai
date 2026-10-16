/** 厂商维度：名单与统计（从 CompanyRadar 抽出，供情报浏览器与面板共用同一套口径）。 */
import type { Signal } from '@/types/signal'
import { matchedKeywords } from '@/lib/text-match'

export interface VendorDef {
  id: string
  name: string
  nameZh: string
  keys: string[]
  color: string
}

/** Vendors tracked in the vendor dimension. `keys` are lowercase match tokens. */
export const VENDORS: VendorDef[] = [
  { id: 'openai', name: 'OpenAI', nameZh: 'OpenAI', keys: ['openai', 'gpt-', 'gpt4', 'gpt5', 'chatgpt', 'sora', 'o3', 'o4'], color: '#06b6d4' },
  { id: 'anthropic', name: 'Anthropic', nameZh: 'Anthropic', keys: ['anthropic', 'claude'], color: '#f59e0b' },
  { id: 'google', name: 'Google', nameZh: '谷歌', keys: ['google', 'deepmind', 'gemini', 'gemma'], color: '#34d399' },
  { id: 'meta', name: 'Meta', nameZh: 'Meta', keys: ['meta ai', 'meta platforms', 'llama', 'facebook'], color: '#a78bfa' },
  { id: 'nvidia', name: 'NVIDIA', nameZh: '英伟达', keys: ['nvidia', 'blackwell', 'cuda', 'h100', 'h200', 'gb200'], color: '#84cc16' },
  { id: 'microsoft', name: 'Microsoft', nameZh: '微软', keys: ['microsoft', 'copilot', 'azure'], color: '#38bdf8' },
  { id: 'deepseek', name: 'DeepSeek', nameZh: '深度求索', keys: ['deepseek'], color: '#f472b6' },
  { id: 'alibaba', name: 'Alibaba', nameZh: '阿里', keys: ['alibaba', 'qwen', 'tongyi', '通义', '阿里'], color: '#fb923c' },
  { id: 'bytedance', name: 'ByteDance', nameZh: '字节', keys: ['bytedance', 'doubao', '豆包', '字节'], color: '#22d3ee' },
  { id: 'moonshot', name: 'Moonshot', nameZh: '月之暗面', keys: ['moonshot', 'kimi', '月之暗面'], color: '#c084fc' },
  { id: 'zhipu', name: 'Zhipu', nameZh: '智谱', keys: ['zhipu', 'glm', '智谱'], color: '#2dd4bf' },
  { id: 'mistral', name: 'Mistral', nameZh: 'Mistral', keys: ['mistral', 'mixtral'], color: '#facc15' },
  { id: 'xai', name: 'xAI', nameZh: 'xAI', keys: ['xai', 'grok'], color: '#94a3b8' },
  { id: 'apple', name: 'Apple', nameZh: '苹果', keys: ['apple', 'apple intelligence'], color: '#e879f9' },
  { id: 'amazon', name: 'Amazon', nameZh: '亚马逊', keys: ['amazon', 'aws', 'bedrock', 'nova'], color: '#fdba74' },
]

export interface VendorRow extends VendorDef {
  count: number
  peakImportance: number
  topTitle: string
  /** 命中最多的关键词：下钻时用它过滤信号（展示名常不是信号里的词，如阿里 → qwen） */
  bestKey: string
  signals: Signal[]
}

export interface VendorStats {
  rows: VendorRow[]
  /** 窗口内的信号总数 */
  inWindow: number
  /** 有提及的厂商数 */
  matchedVendors: number
}

/** 统计近 N 日内各厂商的提及情况（按提及数排序）。 */
export function computeVendorRows(signals: Signal[], days = 7): VendorStats {
  const now = Date.now()
  const cutoff = now - days * 86400000
  const recent = signals.filter(s => { const t = Date.parse(s.publishedAt); return t >= cutoff && t <= now })

  const rows: VendorRow[] = VENDORS.map(v => {
    const hits: Signal[] = []
    let peakImportance = 0
    let topTitle = ''
    const keyHits = new Map<string, number>()

    for (const s of recent) {
      const text = `${s.title ?? ''} ${s.summary ?? ''}`.toLowerCase()
      const hitKeys = matchedKeywords(text, v.keys)
      if (hitKeys.length === 0) continue
      hits.push(s)
      for (const key of hitKeys) keyHits.set(key, (keyHits.get(key) ?? 0) + 1)
      if (s.importance > peakImportance) {
        peakImportance = s.importance
        topTitle = s.title
      }
    }

    return {
      ...v,
      count: hits.length,
      peakImportance,
      topTitle,
      bestKey: Array.from(keyHits.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? v.keys[0],
      signals: hits,
    }
  })

  const matched = rows.filter(r => r.count > 0).sort((a, b) => b.count - a.count || b.peakImportance - a.peakImportance)
  return { rows: matched, inWindow: recent.length, matchedVendors: matched.length }
}
