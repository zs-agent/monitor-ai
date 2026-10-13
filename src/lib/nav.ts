export type PageSlug = 'nexus' | 'ops'

export const NAV_ITEMS: { slug: PageSlug; en: string; zh: string; desc: { en: string; zh: string } }[] = [
  { slug: 'nexus', en: 'NEXUS', zh: '观测中枢', desc: { en: 'Intelligence workbench — signal stream, monitoring dashboard and multi-agent research in one entry', zh: '情报工作台 — 信号流、监测看板与多智能体研究统一入口' } },
  { slug: 'ops', en: 'OPS', zh: '源网监控', desc: { en: 'Data source health and system status (admin)', zh: '数据源健康度与系统状态（管理员）' } },
]
