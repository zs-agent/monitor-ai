// 数据源展示元数据（单一来源）。
// 客户端组件与服务端 /api 共用这份清单，避免各处硬编码导致漂移（如 ops 页漏列 rsshub）。
// 注意：这是纯数据模块，禁止 import 任何 Node-only 库，否则会把服务端代码带进客户端 bundle。

export interface SourceMeta {
  /** 与 SignalProvider.id 一致的数据源唯一标识 */
  id: string
  /** 展示名 */
  name: string
  /** 缩写（WorkspaceHeader 状态点用） */
  short: string
  /** 来源类型（ops 页用） */
  type: string
  /** 一句话说明（ops 页用） */
  desc: string
}

export const SOURCE_META: SourceMeta[] = [
  { id: 'hackernews', name: 'Hacker News', short: 'HN', type: 'Community', desc: 'Top AI-related stories' },
  { id: 'huggingface', name: 'HuggingFace Papers', short: 'HF', type: 'Academic', desc: 'Daily AI papers' },
  { id: 'huggingface-models', name: 'Hugging Face Models', short: 'HF-M', type: 'Models', desc: 'Public model revisions, tasks and repository metadata' },
  { id: 'github', name: 'GitHub Trending', short: 'GH', type: 'Open Source', desc: 'Trending AI repos' },
  { id: 'semanticscholar', name: 'Semantic Scholar', short: 'S2', type: 'Academic', desc: 'AI research papers' },
  { id: 'rsshub', name: 'RSSHub', short: 'RSS', type: 'News', desc: 'Curated RSS feeds (arXiv, v2ex, zhihu, bilibili)' },
]

export const sourceMetaMap: Record<string, SourceMeta> = Object.fromEntries(
  SOURCE_META.map(s => [s.id, s]),
)
