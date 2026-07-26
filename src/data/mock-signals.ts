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
  },
  // ── AI Papers (category: papers) ────────────────────────────────
  // s13-s18 中文论文
  {
    id: 's13', title: 'DeepSeek-R1：通过强化学习提升大语言模型推理能力',
    summary: 'DeepSeek-R1 采用强化学习训练，在数学推理和代码生成任务上达到 GPT-4 级别性能',
    source: 'DeepSeek', sourceUrl: 'https://arxiv.org/abs/2501.12948',
    publishedAt: '2026-07-23T08:30:00Z', category: 'papers',
    tags: ['论文', '推理', '强化学'], importance: 5, sourcesCount: 15, language: 'zh'
  },
  {
    id: 's14', title: 'Llama 3.1：Meta 开源 405B 参数大语言模型',
    summary: 'Meta 发布 Llama 3.1 系列最大 405B 参数模型，在多项基准测试中媲美闭源模型',
    source: 'Meta AI', sourceUrl: 'https://arxiv.org/abs/2407.21783',
    publishedAt: '2026-07-22T14:20:00Z', category: 'papers',
    tags: ['论文', '开源', '大模型'], importance: 5, sourcesCount: 28, language: 'zh'
  },
  {
    id: 's15', title: 'Qwen2.5：阿里通义千问大语言模型系列技术报告',
    summary: 'Qwen2.5 系列覆盖 0.5B 至 72B 参数，在编码、数学和多语言任务上显著提升',
    source: '阿里云', sourceUrl: 'https://arxiv.org/abs/2412.15115',
    publishedAt: '2026-07-21T10:15:00Z', category: 'papers',
    tags: ['论文', '国产模型', 'Qwen'], importance: 4, sourcesCount: 8, language: 'zh'
  },
  {
    id: 's16', title: 'Mamba-2：新一代状态空间模型在语言建模中的突破',
    summary: 'Mamba-2 在保持线性时间复杂度优势的同时，语言建模质量首次超越同等规模的 Transformer',
    source: 'arXiv', sourceUrl: 'https://arxiv.org/abs/2405.21060',
    publishedAt: '2026-07-20T16:40:00Z', category: 'papers',
    tags: ['论文', '架构', 'SSM'], importance: 4, sourcesCount: 12, language: 'zh'
  },
  {
    id: 's17', title: 'Gemini 2.0：Google 新一代多模态大模型技术报告',
    summary: 'Gemini 2.0 实现原生多模态理解和生成，在多项基准上达到业界领先水平',
    source: 'Google DeepMind', sourceUrl: 'https://arxiv.org/abs/2501.12950',
    publishedAt: '2026-07-19T09:50:00Z', category: 'papers',
    tags: ['论文', '多模态', 'Google'], importance: 5, sourcesCount: 20, language: 'zh'
  },
  {
    id: 's18', title: '视觉语言模型综述：架构、训练与评估方法',
    summary: '系统综述 100+ 视觉语言模型，从架构设计、训练范式到评估指标全面梳理研究进展',
    source: 'arXiv', sourceUrl: 'https://arxiv.org/abs/2501.12951',
    publishedAt: '2026-07-18T11:30:00Z', category: 'papers',
    tags: ['论文', '视觉', '综述'], importance: 3, sourcesCount: 4, language: 'zh'
  },
  // s19-s24 英文论文
  {
    id: 's19', title: 'DeepSeek-R1: Reinforcement Learning for LLM Reasoning',
    summary: 'DeepSeek-R1 achieves GPT-4 level performance on math reasoning and code generation via RL training.',
    source: 'DeepSeek', sourceUrl: 'https://arxiv.org/abs/2501.12948',
    publishedAt: '2026-07-23T08:30:00Z', category: 'papers',
    tags: ['paper', 'reasoning', 'RL'], importance: 5, sourcesCount: 15, language: 'en'
  },
  {
    id: 's20', title: 'Llama 3.1: Meta\'s Open-Source 405B Parameter LLM',
    summary: 'Meta releases Llama 3.1 with up to 405B parameters, rivaling closed-source models across benchmarks.',
    source: 'Meta AI', sourceUrl: 'https://arxiv.org/abs/2407.21783',
    publishedAt: '2026-07-22T14:20:00Z', category: 'papers',
    tags: ['paper', 'open-source', 'LLM'], importance: 5, sourcesCount: 28, language: 'en'
  },
  {
    id: 's21', title: 'Qwen2.5: Alibaba\'s LLM Family Technical Report',
    summary: 'Qwen2.5 series ranges from 0.5B to 72B parameters with significant improvements in coding, math, and multilingual tasks.',
    source: 'Alibaba Cloud', sourceUrl: 'https://arxiv.org/abs/2412.15115',
    publishedAt: '2026-07-21T10:15:00Z', category: 'papers',
    tags: ['paper', 'Qwen', 'LLM'], importance: 4, sourcesCount: 8, language: 'en'
  },
  {
    id: 's22', title: 'Mamba-2: State Space Models Break Through in Language Modeling',
    summary: 'Mamba-2 maintains linear-time complexity while surpassing Transformer quality in language modeling for the first time.',
    source: 'arXiv', sourceUrl: 'https://arxiv.org/abs/2405.21060',
    publishedAt: '2026-07-20T16:40:00Z', category: 'papers',
    tags: ['paper', 'architecture', 'SSM'], importance: 4, sourcesCount: 12, language: 'en'
  },
  {
    id: 's23', title: 'Gemini 2.0: Google\'s Next-Generation Multimodal Model',
    summary: 'Gemini 2.0 achieves native multimodal understanding and generation, leading benchmarks across modalities.',
    source: 'Google DeepMind', sourceUrl: 'https://arxiv.org/abs/2501.12950',
    publishedAt: '2026-07-19T09:50:00Z', category: 'papers',
    tags: ['paper', 'multimodal', 'Google'], importance: 5, sourcesCount: 20, language: 'en'
  },
  {
    id: 's24', title: 'A Survey of Vision-Language Models: Architectures, Training and Evaluation',
    summary: 'Systematic survey of 100+ vision-language models covering architecture design, training paradigms, and evaluation metrics.',
    source: 'arXiv', sourceUrl: 'https://arxiv.org/abs/2501.12951',
    publishedAt: '2026-07-18T11:30:00Z', category: 'papers',
    tags: ['paper', 'vision', 'survey'], importance: 3, sourcesCount: 4, language: 'en'
  }
]
