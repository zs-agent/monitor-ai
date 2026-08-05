/**
 * Agent紧箍咒 — 独立订阅源
 * ---------------------------------------------------------------
 * 抓取策略（稳定/可持续/合规优先）：
 *   1. 手动导入：编辑本文件（或替换为数据源 JSON），维护成本最低、最可控；
 *   2. RSS/授权接口：后续可接官方 RSS 或授权 API（如 X API v2 付费档）替换手动数据；
 *   3. 不采用不稳定的第三方网页抓取作为唯一生产方案。
 *
 * 本文件为手动导入的精选条目（真实公开来源），
 * 数据为空时页面显示清晰空状态，不显示虚假数字。
 */

export interface ShacklesItem {
  id: string
  title: string
  /** ISO 时间 */
  publishedAt: string
  summary: string
  keywords: string[]
  /** 关联模型/项目 */
  related: string[]
  url: string
  /** 是否值得优先阅读 */
  priority: boolean
  /** 导入方式 */
  source: 'manual' | 'rss'
}

export const AGENT_SHACKLES: ShacklesItem[] = [
  {
    id: 'shackles-mcp-launch',
    title: 'Anthropic 发布 Model Context Protocol：统一 Agent 工具接入',
    publishedAt: '2024-11-25T08:00:00Z',
    summary: 'MCP 将"工具调用"标准化为开放协议，使 Claude 通过统一接口连接数据源与应用，Agent 生态从各自为战走向互联。',
    keywords: ['MCP', '工具调用', '协议标准'],
    related: ['Anthropic', 'Claude', 'MCP'],
    url: 'https://www.anthropic.com/news/model-context-protocol',
    priority: true,
    source: 'manual',
  },
  {
    id: 'shackles-building-agents',
    title: 'Anthropic：Building Effective Agents（工程实践权威指南）',
    publishedAt: '2024-12-19T08:00:00Z',
    summary: '区分工作流（workflow）与智能体（agent）的经典论述，给出"最少智能"原则：能用简单编排解决就不用复杂 Agent。',
    keywords: ['Agent 设计', '工作流', '工程实践'],
    related: ['Anthropic', 'Claude'],
    url: 'https://www.anthropic.com/research/building-effective-agents',
    priority: true,
    source: 'manual',
  },
  {
    id: 'shackles-openai-agents',
    title: 'OpenAI 发布新工具构建 Agents：Responses API + Agents SDK',
    publishedAt: '2025-03-11T18:00:00Z',
    summary: 'Responses API 内置工具调用循环与托管 Agent 能力，官方 SDK 支持 handoffs 多智能体协作，开发者范式从 Chat 转向 Agent。',
    keywords: ['OpenAI', 'Responses API', 'Agents SDK', 'handoffs'],
    related: ['OpenAI', 'GPT', 'Agents SDK'],
    url: 'https://openai.com/index/new-tools-for-building-agents/',
    priority: true,
    source: 'manual',
  },
  {
    id: 'shackles-remote-mcp',
    title: 'MCP 2025 更新：远程 MCP 支持，从本地走向生产部署',
    publishedAt: '2025-07-15T12:00:00Z',
    summary: 'MCP 增加远程服务器能力（OAuth 鉴权 + 流式传输），补齐企业级部署短板，被主要框架与云厂商采纳。',
    keywords: ['MCP', '远程服务器', 'OAuth', '生产部署'],
    related: ['Anthropic', 'MCP'],
    url: 'https://www.anthropic.com/news/model-context-protocol-2025',
    priority: true,
    source: 'manual',
  },
  {
    id: 'shackles-state-of-ai-agents',
    title: 'LangChain：State of AI Agents 调研报告',
    publishedAt: '2025-06-10T08:00:00Z',
    summary: '数千开发者调研：Agent 进入生产化的关键瓶颈是评测与可观测性，超过一半团队已部署或计划部署 Agent。',
    keywords: ['行业调研', '生产化', '评测', '可观测性'],
    related: ['LangChain', 'LangGraph', 'Langfuse'],
    url: 'https://www.langchain.com/stateofaiagents',
    priority: false,
    source: 'manual',
  },
  {
    id: 'shackles-swebench-leaderboard',
    title: 'SWE-bench 月度排行榜：编码 Agent 能力事实基线',
    publishedAt: '2025-05-01T08:00:00Z',
    summary: 'SWE-bench Verified 成为编码 Agent 最常被引用的评测基准，厂商与开源模型同场竞技。',
    keywords: ['SWE-bench', '评测基准', '编码 Agent'],
    related: ['SWE-bench', 'Claude', 'DeepSeek'],
    url: 'https://www.swebench.com',
    priority: false,
    source: 'manual',
  },
]
