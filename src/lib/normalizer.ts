import type { Signal } from '@/types/signal'
import type { RawItem } from './hn'
import type { HFPaper } from './huggingface'

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  models: ['model', 'gpt', 'claude', 'llama', 'release', 'open source', 'gemini', 'opus', 'sonnet', 'mistral', 'llm', '参数', '发布', '开源'],
  products: ['product', 'app', 'launch', 'tool', 'chatgpt', 'copilot', 'voice', 'desktop', '更新', '上线', '应用'],
  industry: ['policy', 'regulation', 'ban', 'law', 'government', 'lawsuit', 'patent', 'market', 'funding', '政策', '监管', '融资', '投资'],
  papers: ['paper', 'research', 'benchmark', 'arxiv', 'study', '论文', '研究', '前沿'],
  tips: ['tutorial', 'guide', 'how to', 'build', 'engineering', 'prompt', '教程', '实战', '工程'],
}

function classifyCategory(title: string, source: string): Signal['category'] {
  const lower = `${title} ${source}`.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat as Signal['category']
  }
  return 'models'
}

function computeImportance(score: number, hasMultipleSources: boolean): number {
  let base = 1
  if (score >= 500) base = 5
  else if (score >= 200) base = 4
  else if (score >= 100) base = 3
  else if (score >= 50) base = 2
  if (hasMultipleSources) base = Math.min(base + 1, 5)
  return base
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') }
  catch { return 'unknown' }
}

export function normalizeHNSignal(item: RawItem, locale: 'zh' | 'en'): Signal {
  const title = item.title
  const category = classifyCategory(title, 'hackernews')
  return {
    id: `hn-${item.id}`,
    title: title,
    summary: `${item.score} points · ${item.descendants || 0} comments`,
    source: 'Hacker News',
    sourceUrl: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    publishedAt: new Date(item.time * 1000).toISOString(),
    category,
    tags: [extractDomain(item.url || '')],
    importance: computeImportance(item.score, false),
    sourcesCount: Math.min(Math.ceil(item.score / 100) + 1, 10),
    language: locale,
  }
}

export function normalizeHFPaper(paper: HFPaper, locale: 'zh' | 'en'): Signal {
  const prefix = locale === 'zh' ? '' : ''
  return {
    id: paper.id,
    title: `${prefix}${paper.title}`,
    summary: `${paper.upvotes} upvotes on HuggingFace · Daily Papers`,
    source: 'HuggingFace',
    sourceUrl: paper.url,
    publishedAt: paper.createdAt,
    category: 'papers',
    tags: ['hf-paper'],
    importance: computeImportance(paper.upvotes, false),
    sourcesCount: Math.min(Math.ceil(paper.upvotes / 50) + 1, 8),
    language: locale,
  }
}
