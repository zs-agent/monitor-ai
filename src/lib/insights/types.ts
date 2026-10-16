import type { Signal } from '@/types/signal'

export interface CategoryInsight {
  category: Signal['category']
  /** LLM 生成的中文综述，如"今日 models 类三大看点…" */
  text: string
  /** 生成时基于的信号 id 集合，用于增量判断 */
  basedOnSignalIds: string[]
  inputFingerprint?: string
  stale?: boolean
  generatedAt: string
  /** 生成时覆盖的信号数（用于前端展示"基于 N 条信号"） */
  coveredCount: number
  /** text 为空时的信号标题概览（无 LLM key/生成失败时前端展示，避免面板空白） */
  signalTitles?: string[]
  signalIds?: string[]
  summarizedCount?: number
}

export interface InsightsSnapshot {
  insights: CategoryInsight[]
  /** 最近一次生成完成的时间戳 */
  generatedAt: number
  /** 有 LLM 结果（无 key/失败时为 false，前端显示原文摘要） */
  hasLlm: boolean
  inputFingerprint?: string
  scope?: string
  query?: string
  sourceState?: 'sample' | 'stale' | 'current'
}
