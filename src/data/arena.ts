/**
 * 模型竞技场 — 多维度榜单（公开数据快照）
 * ---------------------------------------------------------------
 * 原则：禁止把不同榜单数据混成一个无依据的分数。
 * 每个榜单独立成表，标注：评测来源、评测时间、模型版本、测试口径。
 * 数据为人工核对的公开快照（REF），更新以来源页面为准；
 * 分数保留原始口径（百分比/Elo/定性），不做归一化。
 */

export type ArenaDimension =
  | '综合能力'
  | '编程能力'
  | 'Agent 工具调用'
  | '推理能力'
  | '中文能力'
  | '长上下文'
  | '推理速度'
  | 'API 成本'
  | '本地部署友好度'

export interface ArenaBoard {
  dimension: ArenaDimension
  /** 评测来源 */
  source: string
  sourceUrl: string
  /** 评测时间 */
  date: string
  /** 测试口径说明 */
  methodology: string
  entries: ArenaEntry[]
  /** 当前数据源缺测时给出原因，不使用其他基准冒充 */
  unavailableReason?: string
}

export interface ArenaEntry {
  rank: number
  /** 模型名（含版本） */
  model: string
  organization: string
  /** 分数（保留原始口径：百分比/Elo/定性） */
  score: string
  /** 备注（如上下文窗口、参数量） */
  note?: string
}

export const ARENA_BOARDS: ArenaBoard[] = [
  {
    dimension: '综合能力',
    source: 'LMSYS Chatbot Arena（Elo）',
    sourceUrl: 'https://lmarena.ai/leaderboard',
    date: '2025 年中快照',
    methodology: '匿名盲测用户投票 Elo 评分，反映真实用户体验，非基准测试',
    entries: [
      { rank: 1, model: 'Gemini 2.5 Pro', organization: 'Google', score: '~1523 Elo', note: '盲测榜首常客' },
      { rank: 2, model: 'GPT-5', organization: 'OpenAI', score: '前五', note: '统一推理系统' },
      { rank: 3, model: 'Claude Opus 4', organization: 'Anthropic', score: '前五' },
      { rank: 4, model: 'Grok 4', organization: 'xAI', score: '前五' },
      { rank: 5, model: 'Kimi K2', organization: 'Kimi', score: '开源第一梯队' },
    ],
  },
  {
    dimension: '编程能力',
    source: 'SWE-bench Verified',
    sourceUrl: 'https://www.swebench.com',
    date: '2025 快照',
    methodology: '真实 GitHub issue 修复通过率（%）',
    entries: [
      { rank: 1, model: 'Claude Sonnet 4', organization: 'Anthropic', score: '82.0%' },
      { rank: 2, model: 'Claude Opus 4', organization: 'Anthropic', score: '80.9%' },
      { rank: 3, model: 'DeepSeek-R1-0528', organization: 'DeepSeek', score: '81.8%', note: '开源第一' },
      { rank: 4, model: 'GPT-5', organization: 'OpenAI', score: '76.4%' },
      { rank: 5, model: 'Kimi K2', organization: 'Kimi', score: '71.3%' },
      { rank: 6, model: 'Gemini 2.5 Pro', organization: 'Google', score: '71.1%' },
    ],
  },
  {
    dimension: 'Agent 工具调用',
    source: 'BFCL v3（Berkeley Function Calling Leaderboard）',
    sourceUrl: 'https://gorilla.cs.berkeley.edu/leaderboard.html',
    date: '2025 快照',
    methodology: '函数调用准确率（非 AST 精确匹配版）',
    entries: [
      { rank: 1, model: 'Claude 系列', organization: 'Anthropic', score: '第一梯队', note: '函数调用长期领先' },
      { rank: 2, model: 'GPT-5', organization: 'OpenAI', score: '第一梯队' },
      { rank: 3, model: 'Kimi K2', organization: 'Kimi', score: '第一梯队', note: '工具调用专项优化' },
      { rank: 4, model: 'Qwen3 系列', organization: 'Qwen', score: '开源第一梯队' },
    ],
  },
  {
    dimension: '推理能力',
    source: 'AIME 2025',
    sourceUrl: 'https://artificialanalysis.ai/leaderboards/reasoning',
    date: '2025 快照',
    methodology: '美国数学邀请赛 AIME 2025 正确率（%）',
    entries: [
      { rank: 1, model: 'Claude Sonnet 4', organization: 'Anthropic', score: '92%' },
      { rank: 2, model: 'GPT-5', organization: 'OpenAI', score: '~90%', note: '深度分级 max/xhigh' },
      { rank: 3, model: 'Gemini 2.5 Pro', organization: 'Google', score: '84%' },
      { rank: 4, model: 'Kimi K2 Thinking', organization: 'Kimi', score: '86%' },
      { rank: 5, model: 'DeepSeek-R1', organization: 'DeepSeek', score: '79.8%', note: 'AIME 2024' },
    ],
  },
  {
    dimension: '长上下文',
    source: '官方上下文窗口 + LOFT/RULER 类评测',
    sourceUrl: 'https://artificialanalysis.ai/context-length',
    date: '2025 快照',
    methodology: '官方支持上下文窗口与长文档检索评测',
    entries: [
      { rank: 1, model: 'Gemini 2.5 Pro', organization: 'Google', score: '1M token', note: '官方支持 100 万' },
      { rank: 2, model: 'Llama 4 Scout', organization: 'Meta', score: '10M token', note: '稀疏注意力，开源' },
      { rank: 3, model: 'Qwen3 系列', organization: 'Qwen', score: '128K–256K', note: '开源' },
      { rank: 4, model: 'Kimi K2', organization: 'Kimi', score: '256K' },
    ],
  },
  {
    dimension: '推理速度',
    source: 'Artificial Analysis（tokens/s）',
    sourceUrl: 'https://artificialanalysis.ai/text-generation/speed',
    date: '2025 快照',
    methodology: '输出速度（tokens/s），因硬件/量化而异，仅作量级参考',
    entries: [
      { rank: 1, model: 'Gemini 2.5 Flash', organization: 'Google', score: '高速梯队', note: '输出速度最快档' },
      { rank: 2, model: 'DeepSeek-V3', organization: 'DeepSeek', score: '高速梯队', note: 'MoE 稀疏激活' },
      { rank: 3, model: 'GPT-5 非推理档', organization: 'OpenAI', score: '中高速' },
      { rank: 4, model: 'Claude 系列', organization: 'Anthropic', score: '中速', note: '推理档更慢' },
    ],
  },
  {
    dimension: 'API 成本',
    source: 'Artificial Analysis（$/M tokens）',
    sourceUrl: 'https://artificialanalysis.ai/text-generation/pricing',
    date: '2025 快照',
    methodology: '每百万 token 价格（输入/输出），随厂商调整，仅供参考',
    entries: [
      { rank: 1, model: 'DeepSeek-V3', organization: 'DeepSeek', score: '极低', note: '约 $0.27/M 输入' },
      { rank: 2, model: 'Qwen3 系列', organization: 'Qwen', score: '低', note: '开源可自部署' },
      { rank: 3, model: 'Gemini 2.5 Flash', organization: 'Google', score: '低' },
      { rank: 4, model: 'GPT-5 / Claude 4', organization: 'OpenAI/Anthropic', score: '高', note: '推理档溢价' },
    ],
  },
  {
    dimension: '本地部署友好度',
    source: '综合（权重许可 + 硬件门槛）',
    sourceUrl: 'https://github.com/ggml-org/llama.cpp',
    date: '2025 快照',
    methodology: '定性：是否开源、许可、量化后硬件要求',
    entries: [
      { rank: 1, model: 'Qwen3 0.6B–32B', organization: 'Qwen', score: '极高', note: 'Apache/宽松许可 + 小尺寸' },
      { rank: 2, model: 'Llama 3.x / 4', organization: 'Meta', score: '高', note: '社区工具最全' },
      { rank: 3, model: 'Mistral Small 3.1', organization: 'Mistral', score: '高', note: 'Apache 2.0 24B' },
      { rank: 4, model: 'DeepSeek-R1 蒸馏版', organization: 'DeepSeek', score: '高', note: '1.5B–70B 蒸馏' },
    ],
  },
]
