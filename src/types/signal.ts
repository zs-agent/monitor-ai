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
  /** 来源 provider 唯一标识（如 'hackernews'），用于后台分级轮询时合并快照 */
  providerId?: string
  /** GitHub 信号：近 7 日 star 增量（+N/week），无数据时为 null */
  starsDelta7d?: number | null
}

export type CardSignal = Signal | import('@/lib/clustering').ClusteredSignal
