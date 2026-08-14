import type { Signal } from '@/types/signal'

export interface RawHNItem {
  id: number
  title: string
  url: string
  by: string
  score: number
  descendants: number
  time: number
}

export interface RawHFPaper {
  id: string
  title: string
  url: string
  upvotes: number
  createdAt: string
}

export interface RawGitHubRepo {
  id: number
  name: string
  description: string | null
  url: string
  stars: number
  language: string | null
  avatar: string | null
  pushedAt?: string
}

export interface RawS2Paper {
  id: string
  title: string
  url: string
  date: string
  citations: number
  authors: string[]
  summary: string | null
}

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

/** 从文本推断国家/地区（极简启发式），默认 'UN' */
export function inferCountry(text: string): string {
  const t = text.toLowerCase()
  if (/[\u4e00-\u9fff]/.test(text)) return 'CN'
  if (t.includes('china') || t.includes('beijing') || t.includes('shanghai') || t.includes('hangzhou') || t.includes('shenzhen')) return 'CN'
  if (t.includes('anthropic') || t.includes('openai') || t.includes('google') || t.includes('meta ') || t.includes('microsoft') || t.includes('nvidia')) return 'US'
  return 'UN'
}

/** 数据源权威度 1-5（用于 credibility 字段） */
export function sourceCredibility(sourceId: string): number {
  switch (sourceId) {
    case 'hackernews': return 3
    case 'huggingface': return 4
    case 'github': return 3
    case 'semanticscholar': return 4
    default: return 2
  }
}

export function normalizeHNSignal(item: RawHNItem, locale: 'zh' | 'en'): Signal {
  const title = item.title
  const category = classifyCategory(title, 'hackernews')
  return {
    id: `hn-${item.id}`,
    title,
    summary: `${item.score} points · ${item.descendants || 0} comments`,
    source: 'Hacker News',
    sourceUrl: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    publishedAt: new Date(item.time * 1000).toISOString(),
    category,
    country: inferCountry(title),
    credibility: sourceCredibility('hackernews'),
    tags: [extractDomain(item.url || '')],
    importance: computeImportance(item.score, false),
    sourcesCount: Math.min(Math.ceil(item.score / 100) + 1, 10),
    language: locale,
    providerId: 'hackernews',
  }
}

export function normalizeHFPaper(paper: RawHFPaper, locale: 'zh' | 'en'): Signal {
  return {
    id: paper.id,
    title: paper.title,
    summary: `${paper.upvotes} upvotes on HuggingFace · Daily Papers`,
    source: 'HuggingFace',
    sourceUrl: paper.url,
    publishedAt: paper.createdAt,
    category: 'papers',
    country: inferCountry(paper.title),
    credibility: sourceCredibility('huggingface'),
    tags: ['hf-paper'],
    importance: computeImportance(paper.upvotes, false),
    sourcesCount: Math.min(Math.ceil(paper.upvotes / 50) + 1, 8),
    language: locale,
    providerId: 'huggingface',
  }
}

export function normalizeGitHubRepo(repo: RawGitHubRepo, locale: 'zh' | 'en', starsDelta7d?: number | null): Signal {
  const category = classifyCategory(`${repo.name} ${repo.description || ''}`, 'github')
  return {
    id: `gh-${repo.id}`,
    title: repo.name,
    summary: repo.description || `${repo.stars} stars on GitHub`,
    source: 'GitHub',
    sourceUrl: repo.url,
    publishedAt: repo.pushedAt || new Date().toISOString(),
    category,
    country: 'UN',
    credibility: sourceCredibility('github'),
    tags: repo.language ? [repo.language] : ['github'],
    importance: computeImportance(repo.stars / 100, false),
    sourcesCount: 1,
    starsDelta7d,
    language: locale,
    providerId: 'github',
  }
}

export function normalizeS2Paper(paper: RawS2Paper, locale: 'zh' | 'en'): Signal {
  return {
    id: `s2-${paper.id}`,
    title: paper.title,
    summary: paper.summary || `${paper.citations} citations · Semantic Scholar`,
    source: 'Semantic Scholar',
    sourceUrl: paper.url,
    publishedAt: paper.date ? new Date(paper.date).toISOString() : new Date().toISOString(),
    category: 'papers',
    country: inferCountry(paper.title),
    credibility: sourceCredibility('semanticscholar'),
    tags: paper.authors.slice(0, 2),
    importance: computeImportance(paper.citations / 10, false),
    sourcesCount: 1,
    language: locale,
    providerId: 'semanticscholar',
  }
}
