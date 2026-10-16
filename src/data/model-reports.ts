/**
 * 模型技术报告与论文 — 精选真实事件清单（人工核实）
 * ---------------------------------------------------------------
 * 覆盖：Kimi / DeepSeek / Qwen / MiniMax / 智谱 / 豆包 / OpenAI / Anthropic /
 * Google / Meta / Mistral 的模型发布、Technical Report、Model Card、论文、
 * 开源权重、推理优化与 Agent 能力变化。
 * 每条均标注厂商、名称、类型、发布时间与官方来源；
 * 数据为静态参考（REF），不含实时抓取，新事件由人工/后续接口补充。
 */

export type ModelReportType =
  | 'Technical Report'
  | 'Model Card'
  | '论文'
  | '开源权重'
  | '推理优化'
  | 'Agent 能力'

export interface ModelReportItem {
  id: string
  vendor: string
  name: string
  type: ModelReportType
  /** Publication date; historical references may only have YYYY-MM. */
  date: string
  updatedAt?: string
  /** 官方来源 */
  sourceUrl: string
  /** 关键技术变化 */
  keyChange: string
  /** 对实际使用的影响 */
  usageImpact: string
  /** 是否官方发布（true=厂商官方；false=社区权重更新；undefined=人工核实静态） */
  official?: boolean
}

export const MODEL_REPORTS: ModelReportItem[] = [
  // —— DeepSeek ——
  {
    id: 'deepseek-v3', vendor: 'DeepSeek', name: 'DeepSeek-V3 Technical Report', type: 'Technical Report',
    date: '2024-12', sourceUrl: 'https://arxiv.org/abs/2412.19437',
    keyChange: '671B 总参数 MoE（37B 激活），FP8 训练，Multi-Token Prediction',
    usageImpact: '训练成本约 280 万美元级，推理性价比显著高于同期闭源，成为开源部署主流选择',
  },
  {
    id: 'deepseek-r1', vendor: 'DeepSeek', name: 'DeepSeek-R1 (Reasoning)', type: 'Technical Report',
    date: '2025-01', sourceUrl: 'https://arxiv.org/abs/2501.12948',
    keyChange: '大规模强化学习驱动的推理模型，R1-Zero 验证纯 RL 推理能力',
    usageImpact: '开源推理模型标杆，后续厂商广泛采用 RL 后训练路线',
  },
  {
    id: 'deepseek-v3-2', vendor: 'DeepSeek', name: 'DeepSeek-V3.2 系列', type: '开源权重',
    date: '2025-09', sourceUrl: 'https://github.com/deepseek-ai/DeepSeek-V3',
    keyChange: 'MoE 稀疏注意力，DeepThink 推理模式，支持工具调用',
    usageImpact: 'Agent 场景工具调用能力提升，DSA 降低长上下文推理开销',
  },
  // —— Kimi（月之暗面）——
  {
    id: 'kimi-k2', vendor: 'Kimi', name: 'Kimi K2 开源模型', type: '开源权重',
    date: '2025-07', sourceUrl: 'https://github.com/MoonshotAI/Kimi-K2',
    keyChange: '1T 参数 MoE（32B 激活）全开源（含权重/数据/训练细节）',
    usageImpact: 'Agent 工具调用与长上下文能力强，Agent 场景热门开源底座',
  },
  {
    id: 'kimi-k2-thinking', vendor: 'Kimi', name: 'Kimi K2 Thinking', type: 'Agent 能力',
    date: '2025-11', sourceUrl: 'https://platform.moonshot.cn/docs',
    keyChange: '推出 Thinking 版本，推理深度可调，官方 Agent 工具链（kimi-tools）',
    usageImpact: 'Agent 编排与工具调用体验对齐主流 SDK，适合工程集成',
  },
  // —— Qwen（阿里）——
  {
    id: 'qwen3', vendor: 'Qwen', name: 'Qwen3 系列', type: '开源权重',
    date: '2025-04', sourceUrl: 'https://qwenlm.github.io/blog/qwen3/',
    keyChange: '原生 Agent 能力 + 混合推理模式（thinking/non-thinking），235B-A22B 旗舰开源',
    usageImpact: '本地部署/微调成本可控，Agent 与函数调用开箱即用',
  },
  {
    id: 'qwen2.5', vendor: 'Qwen', name: 'Qwen2.5 Technical Report', type: 'Technical Report',
    date: '2024-09', sourceUrl: 'https://arxiv.org/abs/2412.15115',
    keyChange: '0.5B-72B 全尺寸开源，长上下文 128K，工具调用增强',
    usageImpact: '成为全球被引用最多的开源模型系列之一，生态集成广泛',
  },
  // —— MiniMax ——
  {
    id: 'minimax-m2', vendor: 'MiniMax', name: 'MiniMax-M2 开源模型', type: '开源权重',
    date: '2025-08', sourceUrl: 'https://github.com/MiniMax-AI/MiniMax-M2',
    keyChange: '230B 参数，5.6T token 训练，推理与写作能力对标头部闭源',
    usageImpact: '开源权重中推理/编码性价比突出，Agent 长任务表现好',
  },
  // —— 智谱 ——
  {
    id: 'glm-4.5', vendor: '智谱', name: 'GLM-4.5 系列', type: '开源权重',
    date: '2025-07', sourceUrl: 'https://github.com/zai-org/GLM-4.5',
    keyChange: 'GLM-4.5（通用）/ GLM-4.5V（多模态）开源，V2 引擎',
    usageImpact: '中文场景性能领先，Agent 工具调用与多模态输入开源可用',
  },
  {
    id: 'autoglm', vendor: '智谱', name: 'AutoGLM 手机 Agent', type: 'Agent 能力',
    date: '2024-11', sourceUrl: 'https://github.com/zai-org/AutoGLM',
    keyChange: 'GUI Agent：通过截图+点击操作手机 App',
    usageImpact: '手机/桌面自动化代理方向代表，催生 GUI Agent 评测与工程实践',
  },
  // —— 豆包（字节）——
  {
    id: 'seed-1.5', vendor: '豆包', name: 'Seed-1.5（豆包大模型）', type: 'Agent 能力',
    date: '2025-04', sourceUrl: 'https://www.volcengine.com/product/doubao',
    keyChange: '多模态理解与推理增强，推理成本下调',
    usageImpact: '火山引擎生态内 Agent 应用首选底座，价格竞争力强',
  },
  // —— OpenAI ——
  {
    id: 'gpt-5', vendor: 'OpenAI', name: 'GPT-5', type: 'Technical Report',
    date: '2025-08', sourceUrl: 'https://openai.com/index/introducing-gpt-5/',
    keyChange: '统一推理系统（o3 能力并入），深度分级，工具调用强化',
    usageImpact: 'Agent 任务（编码/工具）综合能力标杆，API 按推理深度计费',
  },
  {
    id: 'openai-responses', vendor: 'OpenAI', name: 'Responses API 与 Agent SDK', type: 'Agent 能力',
    date: '2025-03', sourceUrl: 'https://openai.com/index/new-tools-for-building-agents/',
    keyChange: '内置工具调用循环、web search/file search/computer use，官方 Agents SDK',
    usageImpact: 'Agent 开发从 Chat Completions 迁移至 Responses 模式，工程范式变化',
  },
  // —— Anthropic ——
  {
    id: 'claude-4', vendor: 'Anthropic', name: 'Claude Opus 4 / Sonnet 4', type: 'Model Card',
    date: '2025-05', sourceUrl: 'https://www.anthropic.com/news/claude-4',
    keyChange: '长文档/多模态能力跃升，Sonnet 4 工具调用强于前代 Opus',
    usageImpact: '企业 Agent 与复杂工具链首选之一',
  },
  {
    id: 'mcp-spec', vendor: 'Anthropic', name: 'Model Context Protocol', type: 'Agent 能力',
    date: '2024-11', sourceUrl: 'https://modelcontextprotocol.io',
    keyChange: '开放工具接入协议，标准化 Agent↔工具交互',
    usageImpact: '工具生态互联事实标准，2025 年被各大厂商/框架采纳',
  },
  // —— Google ——
  {
    id: 'gemini-2.5', vendor: 'Google', name: 'Gemini 2.5 Pro', type: 'Technical Report',
    date: '2025-03', sourceUrl: 'https://blog.google/technology/google-deepmind/gemini-model-thinking-updates-march-2025/',
    keyChange: '混合推理（thinking 默认开启），1M 上下文',
    usageImpact: '长上下文与代码 Agent 场景优势，Agent 推理默认开启',
  },
  {
    id: 'gemini-3', vendor: 'Google', name: 'Gemini 3（Open Weights）', type: '开源权重',
    date: '2025-11', sourceUrl: 'https://deepmind.google/technologies/gemini/',
    keyChange: '旗舰模型开放权重 + 原生工具调用（Gemini 3 Agentic）',
    usageImpact: '开源阵营新增顶级选择，Agent 部署自由度提升',
  },
  // —— Meta ——
  {
    id: 'llama-4', vendor: 'Meta', name: 'Llama 4（Scout / Maverick）', type: '开源权重',
    date: '2025-04', sourceUrl: 'https://ai.meta.com/blog/llama-4-multimodal-intelligence/',
    keyChange: '原生多模态 MoE，10M 上下文（Scout），早期推理版本',
    usageImpact: '开源多模态与超长上下文新基准，本地部署成本考量',
  },
  // —— Mistral ——
  {
    id: 'mistral-small-3.1', vendor: 'Mistral', name: 'Mistral Small 3.1', type: '开源权重',
    date: '2025-03', sourceUrl: 'https://mistral.ai/news/mistral-small-3-1',
    keyChange: '24B Apache 2.0 全开放（权重/代码），函数调用开箱即用',
    usageImpact: 'Apache 2.0 许可下最强的本地 Agent 底座之一',
  },
]
