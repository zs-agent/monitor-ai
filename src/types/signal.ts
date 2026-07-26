export interface Signal {
  id: string
  title: string
  summary: string
  source: string
  sourceUrl: string
  publishedAt: string
  category: 'models' | 'products' | 'industry' | 'papers' | 'tips'
  tags: string[]
  importance: number
  sourcesCount: number
  language: 'zh' | 'en'
}

export type CardSignal = Signal | import('@/lib/clustering').ClusteredSignal
