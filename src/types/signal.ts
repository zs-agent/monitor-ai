export interface Signal {
  id: string
  title: string
  summary: string
  source: string
  sourceUrl: string
  publishedAt: string
  category: 'models' | 'products' | 'industry' | 'papers' | 'tips'
  /** ISO 3166-1 alpha-2，未知时为 'UN' */
  country: string
  /** 1-5，数据源权威度评估 */
  credibility: number
  tags: string[]
  importance: number
  sourcesCount: number
  language: 'zh' | 'en'
}

export type CardSignal = Signal | import('@/lib/clustering').ClusteredSignal
