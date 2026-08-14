export type PageSlug = 'nexus' | 'pulse' | 'mirror' | 'ops'

export const NAV_ITEMS: { slug: PageSlug; en: string; zh: string; desc: { en: string; zh: string } }[] = [
  { slug: 'nexus', en: 'NEXUS', zh: '观测中枢', desc: { en: 'Intelligence command center — key signals, trends, and cross-domain summary', zh: '情报指挥中枢 — 关键信号、趋势概览与跨域摘要' } },
  { slug: 'pulse', en: 'PULSE', zh: '情报脉冲', desc: { en: 'Real-time AI signal stream — news, papers, repos, models', zh: '实时 AI 信号流 — 新闻、论文、开源、模型动态' } },
  { slug: 'mirror', en: 'MIRROR', zh: '中美镜像', desc: { en: 'US–China macro mirror — indicators, comparison, benchmarks', zh: '中美宏观镜像 — 指标对比、基准数据、趋势分析' } },
  { slug: 'ops', en: 'OPS', zh: '源网监控', desc: { en: 'Data source health and system status (admin)', zh: '数据源健康度与系统状态（管理员）' } },
]
