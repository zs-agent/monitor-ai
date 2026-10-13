// 协作事件 → 智能体角色。事件名来自上游两个来源：
//   1. multi_agents/agents/*（主编/研究员/评审/事实核查/可视化/发布）
//   2. gpt_researcher 核心（规划子问题、抓取、子查询检索等）
// 未收录的事件一律回退显示原始事件名，不做猜测。

export type AgentTone = 'chief' | 'researcher' | 'reviewer' | 'writer' | 'fact' | 'visual' | 'publisher' | 'system'

interface AgentMeta {
  tone: AgentTone
  zh: string
  en: string
}

const AGENTS: Record<string, AgentMeta> = {
  starting_research: { tone: 'chief', zh: '主编 · 启动', en: 'Chief Editor · start' },
  planning_research: { tone: 'chief', zh: '主编 · 拆解子问题', en: 'Chief Editor · planning' },
  parallel_research: { tone: 'chief', zh: '主编 · 并行分派章节', en: 'Chief Editor · dispatch' },
  initial_research: { tone: 'researcher', zh: '研究员 · 初步检索', en: 'Researcher · initial' },
  depth_research: { tone: 'researcher', zh: '研究员 · 章节深研', en: 'Researcher · deep dive' },
  running_subquery_research: { tone: 'researcher', zh: '研究员 · 子问题检索', en: 'Researcher · subquery' },
  research_step_finalized: { tone: 'researcher', zh: '研究员 · 检索完成', en: 'Researcher · finalized' },
  scraping_urls: { tone: 'researcher', zh: '抓取 · 正文', en: 'Scraper · fetch' },
  agent_generated: { tone: 'researcher', zh: '研究员 · 选型', en: 'Researcher · agent' },
  review_feedback: { tone: 'reviewer', zh: '评审 · 打回意见', en: 'Reviewer · feedback' },
  fact_checking: { tone: 'fact', zh: '事实核查', en: 'Fact checker' },
  visualizing: { tone: 'visual', zh: '可视化 · 生成图示', en: 'Visualizer' },
  publishing: { tone: 'publisher', zh: '发布 · 成稿', en: 'Publisher' },
  started: { tone: 'system', zh: '系统 · 任务创建', en: 'System · created' },
  finished: { tone: 'system', zh: '系统 · 运行结束', en: 'System · finished' },
  failed: { tone: 'system', zh: '系统 · 运行失败', en: 'System · failed' },
  human_feedback: { tone: 'system', zh: '等待人工反馈', en: 'Human feedback' },
}

const TONE_CLASS: Record<AgentTone, string> = {
  chief: 'text-accent',
  researcher: 'text-emerald-400',
  reviewer: 'text-amber-400',
  writer: 'text-violet-400',
  fact: 'text-sky-400',
  visual: 'text-fuchsia-400',
  publisher: 'text-teal-300',
  system: 'text-muted',
}

const TONE_DOT: Record<AgentTone, string> = {
  chief: 'bg-accent',
  researcher: 'bg-emerald-400',
  reviewer: 'bg-amber-400',
  writer: 'bg-violet-400',
  fact: 'bg-sky-400',
  visual: 'bg-fuchsia-400',
  publisher: 'bg-teal-300',
  system: 'bg-muted',
}

/** 关键节点：只看阶段推进，过滤掉逐条抓取/子查询噪声 */
export const KEY_EVENTS: Record<string, true> = {
  started: true,
  starting_research: true,
  planning_research: true,
  parallel_research: true,
  depth_research: true,
  review_feedback: true,
  fact_checking: true,
  visualizing: true,
  publishing: true,
  finished: true,
  failed: true,
}

export function agentOf(event?: string): { meta: AgentMeta; label: (zh: boolean) => string; className: string; dotClass: string } {
  const known = (event && AGENTS[event]) || null
  const meta: AgentMeta = known ?? { tone: 'system', zh: event || '事件', en: event || 'event' }
  return {
    meta,
    label: (zh: boolean) => (zh ? meta.zh : meta.en),
    className: TONE_CLASS[meta.tone],
    dotClass: TONE_DOT[meta.tone],
  }
}
