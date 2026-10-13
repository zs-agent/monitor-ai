// 「今日 AI 洞察」模块两个视图之间的契约：研判视图展示检索规模、并可下钻到检索视图。
// 放在 lib 里，避免面板组件之间互相 import。

/** 检索规模：三个维度各有多少可挖 */
export interface BrowseCounts {
  signals: number
  vendors: number
  models: number
}

/** 研判下钻指令：切维度 / 打上分类筛选（每次下发新对象即应用，重复点同一分类也生效） */
export interface BrowsePreset {
  dimension?: 'signals' | 'vendors' | 'models'
  category?: string
}
