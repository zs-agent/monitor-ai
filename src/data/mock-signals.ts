import { Signal } from '@/types/signal'

export const mockSignals: Signal[] = [
  {
    id: 's1', title: 'Anthropic 发布 Claude Opus 5',
    summary: '智能水平接近 Claude Fable 5 但价格减半，Frontier-Bench 性能翻倍',
    source: 'Anthropic Newsroom', sourceUrl: 'https://anthropic.com',
    publishedAt: '2026-07-25T01:24:00Z', category: 'models',
    tags: ['Anthropic', 'Claude'], importance: 5, sourcesCount: 22, language: 'zh'
  },
  {
    id: 's2', title: 'Claude 语音模式支持 Opus/Sonnet 及工具调用与多语言',
    summary: 'Claude 语音模式在 Opus、Sonnet 和 Haiku 上运行，支持连接 Gmail、Slack 等工具',
    source: 'Claude Blog', sourceUrl: 'https://claude.ai/blog',
    publishedAt: '2026-07-25T03:53:00Z', category: 'products',
    tags: ['Anthropic', '语音'], importance: 4, sourcesCount: 6, language: 'zh'
  },
  {
    id: 's3', title: '蚂蚁百灵发布 Ling-3.0-flash 原生混合推理模型',
    summary: '124B 总参数、仅 5.1B 激活参数，对标旗舰 Ring-2.6-1T 性能，开源并免费提供 API',
    source: '蚂蚁百灵', sourceUrl: 'https://antling.com',
    publishedAt: '2026-07-24T22:00:00Z', category: 'models',
    tags: ['蚂蚁百灵', '国产模型'], importance: 4, sourcesCount: 3, language: 'zh'
  },
  {
    id: 's4', title: '北京发布智能体新政，Token 经济首次写入政策文件',
    summary: '十条措施首次将 Harness Engineering、Token 经济、OPC 等写入正式政策，推动 TaaS/AaaS 模式',
    source: '数字生命卡兹克', sourceUrl: 'https://mp.weixin.qq.com',
    publishedAt: '2026-07-24T13:20:00Z', category: 'industry',
    tags: ['政策', '智能体', '北京'], importance: 4, sourcesCount: 5, language: 'zh'
  },
  {
    id: 's5', title: 'AREX：面向深度研究的递归自改进智能体',
    summary: '内层研究循环收集证据，外层自改进循环审计答案，显著超越同规模基线模型',
    source: 'HuggingFace Daily Papers', sourceUrl: 'https://huggingface.co/papers',
    publishedAt: '2026-07-24T11:50:00Z', category: 'papers',
    tags: ['论文', '深度研究'], importance: 3, sourcesCount: 2, language: 'zh'
  },
  {
    id: 's6', title: 'Claude Code 系统提示词精简超 80%',
    summary: 'Anthropic 为新一代模型移除了 Claude Code 超 80% 系统提示词，编码评测无显著损失',
    source: 'Claude Blog', sourceUrl: 'https://claude.ai/blog',
    publishedAt: '2026-07-25T01:25:00Z', category: 'tips',
    tags: ['Claude Code', '提示工程'], importance: 3, sourcesCount: 3, language: 'zh'
  },
  {
    id: 's7', title: 'Anthropic Releases Claude Opus 5',
    summary: 'Approaches Claude Fable 5 intelligence at half the price. Frontier-Bench scores more than double.',
    source: 'Anthropic Newsroom', sourceUrl: 'https://anthropic.com',
    publishedAt: '2026-07-25T01:24:00Z', category: 'models',
    tags: ['Anthropic', 'Claude'], importance: 5, sourcesCount: 22, language: 'en'
  },
  {
    id: 's8', title: 'Claude Voice Mode Now Supports Opus, Sonnet, Tools & Multilingual',
    summary: 'Voice mode runs on Opus, Sonnet, and Haiku with Gmail, Slack connections and multilingual.',
    source: 'Claude Blog', sourceUrl: 'https://claude.ai/blog',
    publishedAt: '2026-07-25T03:53:00Z', category: 'products',
    tags: ['Anthropic', 'voice'], importance: 4, sourcesCount: 6, language: 'en'
  },
  {
    id: 's9', title: 'Ant Group Releases Ling-3.0-flash Hybrid Reasoning Model',
    summary: '124B total params with only 5.1B activated. Matches flagship Ring-2.6-1T performance. Open source, free API.',
    source: 'Ant Ling', sourceUrl: 'https://antling.com',
    publishedAt: '2026-07-24T22:00:00Z', category: 'models',
    tags: ['Ant Group', 'Ling'], importance: 4, sourcesCount: 3, language: 'en'
  },
  {
    id: 's10', title: 'Beijing Issues Agent Policy with Token Economy',
    summary: '10-point policy introduces Harness Engineering, Token Economy, OPC into formal regulation.',
    source: 'Digital Life Kazik', sourceUrl: 'https://mp.weixin.qq.com',
    publishedAt: '2026-07-24T13:20:00Z', category: 'industry',
    tags: ['policy', 'agent'], importance: 4, sourcesCount: 5, language: 'en'
  },
  {
    id: 's11', title: 'AREX: Recursive Self-Improving Agents for Deep Research',
    summary: 'Inner research loops for evidence collection and outer self-improvement loops for constraint auditing.',
    source: 'HuggingFace Daily Papers', sourceUrl: 'https://huggingface.co/papers',
    publishedAt: '2026-07-24T11:50:00Z', category: 'papers',
    tags: ['research', 'deep research'], importance: 3, sourcesCount: 2, language: 'en'
  },
  {
    id: 's12', title: 'Claude Code System Prompt Reduced by 80%+',
    summary: 'Anthropic removes 80%+ of Claude Code system prompts for Opus 5 era models with no significant regression.',
    source: 'Claude Blog', sourceUrl: 'https://claude.ai/blog',
    publishedAt: '2026-07-25T01:25:00Z', category: 'tips',
    tags: ['Claude Code', 'prompt engineering'], importance: 3, sourcesCount: 3, language: 'en'
  }
]
