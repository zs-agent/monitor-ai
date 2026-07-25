export interface LeaderboardEntry {
  rank: number
  model: string
  organization: string
  arenaScore: number | null
  mmlu: number | null
  superClue: number | null
  cEval: number | null
  releaseDate: string
  params: string
  country: string
  url: string
}

export const LEADERBOARD_INTL: LeaderboardEntry[] = [
  { rank: 1, model: 'Claude Opus 5 (max)', organization: 'Anthropic', arenaScore: 61, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-06', params: '—', country: 'US', url: 'https://anthropic.com' },
  { rank: 2, model: 'Claude Opus 5 (xhigh)', organization: 'Anthropic', arenaScore: 60, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-06', params: '—', country: 'US', url: 'https://anthropic.com' },
  { rank: 3, model: 'Claude Fable 5 (fallback)', organization: 'Anthropic', arenaScore: 60, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-06', params: '—', country: 'US', url: 'https://anthropic.com' },
  { rank: 4, model: 'GPT-5.6 Sol (max)', organization: 'OpenAI', arenaScore: 59, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-07', params: '—', country: 'US', url: 'https://openai.com' },
  { rank: 5, model: 'Claude Opus 5 (high)', organization: 'Anthropic', arenaScore: 59, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-06', params: '—', country: 'US', url: 'https://anthropic.com' },
  { rank: 6, model: 'GPT-5.6 Sol (xhigh)', organization: 'OpenAI', arenaScore: 58, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-07', params: '—', country: 'US', url: 'https://openai.com' },
  { rank: 7, model: 'Kimi K3', organization: 'Kimi (Moonshot)', arenaScore: 57, mmlu: null, superClue: 93.5, cEval: 94.0, releaseDate: '2026-07', params: '—', country: 'CN', url: 'https://kimi.moonshot.cn' },
  { rank: 8, model: 'Claude Opus 5 (medium)', organization: 'Anthropic', arenaScore: 56, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-06', params: '—', country: 'US', url: 'https://anthropic.com' },
  { rank: 9, model: 'GPT-5.6 Sol (high)', organization: 'OpenAI', arenaScore: 56, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-07', params: '—', country: 'US', url: 'https://openai.com' },
  { rank: 10, model: 'Claude Opus 4.8 (max)', organization: 'Anthropic', arenaScore: 56, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-03', params: '—', country: 'US', url: 'https://anthropic.com' },
  { rank: 11, model: 'GPT-5.6 Terra (max)', organization: 'OpenAI', arenaScore: 55, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-07', params: '—', country: 'US', url: 'https://openai.com' },
  { rank: 12, model: 'Grok 4.5 (high)', organization: 'SpaceXAI', arenaScore: 54, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-06', params: '—', country: 'US', url: 'https://x.ai' },
  { rank: 13, model: 'Claude Sonnet 5 (max)', organization: 'Anthropic', arenaScore: 53, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-06', params: '—', country: 'US', url: 'https://anthropic.com' },
  { rank: 14, model: 'GPT-5.6 Terra (xhigh)', organization: 'OpenAI', arenaScore: 52, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-07', params: '—', country: 'US', url: 'https://openai.com' },
  { rank: 15, model: 'GPT-5.6 Luna (max)', organization: 'OpenAI', arenaScore: 51, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-07', params: '—', country: 'US', url: 'https://openai.com' },
  { rank: 16, model: 'GLM-5.2 (max)', organization: 'Zhipu AI', arenaScore: 51, mmlu: null, superClue: 92.8, cEval: 93.5, releaseDate: '2026-06', params: '—', country: 'CN', url: 'https://zhipuai.cn' },
  { rank: 17, model: 'Muse Spark 1.1 (xhigh)', organization: 'Meta', arenaScore: 51, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-06', params: '—', country: 'US', url: 'https://meta.com' },
  { rank: 18, model: 'Claude Opus 5 (low)', organization: 'Anthropic', arenaScore: 51, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-06', params: '—', country: 'US', url: 'https://anthropic.com' },
  { rank: 19, model: 'Gemini 3.5 Flash', organization: 'Google', arenaScore: 50, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-05', params: '—', country: 'US', url: 'https://deepmind.google' },
  { rank: 20, model: 'Gemini 3.6 Flash', organization: 'Google', arenaScore: 50, mmlu: null, superClue: null, cEval: null, releaseDate: '2026-07', params: '—', country: 'US', url: 'https://deepmind.google' },
]

export const LEADERBOARD_CN: LeaderboardEntry[] = [
  { rank: 1, model: 'Kimi K3', organization: '月之暗面', arenaScore: 57, mmlu: null, superClue: 93.5, cEval: 94.0, releaseDate: '2026-07', params: '—', country: 'CN', url: 'https://kimi.moonshot.cn' },
  { rank: 2, model: 'GLM-5.2 (max)', organization: '智谱 AI', arenaScore: 51, mmlu: null, superClue: 92.8, cEval: 93.5, releaseDate: '2026-06', params: '—', country: 'CN', url: 'https://zhipuai.cn' },
  { rank: 3, model: 'Qwen3.7 Max', organization: '阿里云', arenaScore: 46, mmlu: null, superClue: 91.2, cEval: 92.1, releaseDate: '2026-07', params: '—', country: 'CN', url: 'https://tongyi.aliyun.com' },
  { rank: 4, model: 'MiniMax-M3', organization: 'MiniMax', arenaScore: 44, mmlu: null, superClue: 90.5, cEval: 91.0, releaseDate: '2026-06', params: '—', country: 'CN', url: 'https://minimax.io' },
  { rank: 5, model: 'DeepSeek V4 Pro (max)', organization: 'DeepSeek', arenaScore: 44, mmlu: null, superClue: 91.8, cEval: 92.5, releaseDate: '2026-06', params: '—', country: 'CN', url: 'https://deepseek.com' },
  { rank: 6, model: 'Kimi K2.7 Code', organization: '月之暗面', arenaScore: 42, mmlu: null, superClue: 89.8, cEval: 90.5, releaseDate: '2026-06', params: '—', country: 'CN', url: 'https://kimi.moonshot.cn' },
  { rank: 7, model: 'Hy3', organization: '腾讯混元', arenaScore: 41, mmlu: null, superClue: 90.0, cEval: 90.8, releaseDate: '2026-06', params: '—', country: 'CN', url: 'https://hunyuan.tencent.com' },
  { rank: 8, model: 'Qwen3.6 Plus', organization: '阿里云', arenaScore: 40, mmlu: null, superClue: 89.5, cEval: 90.2, releaseDate: '2026-05', params: '—', country: 'CN', url: 'https://tongyi.aliyun.com' },
  { rank: 9, model: 'Qwen3.7 Plus', organization: '阿里云', arenaScore: 39, mmlu: null, superClue: 88.5, cEval: 89.0, releaseDate: '2026-07', params: '—', country: 'CN', url: 'https://tongyi.aliyun.com' },
  { rank: 10, model: 'MiMo-V2.5-Pro', organization: '小米', arenaScore: 42, mmlu: null, superClue: 88.0, cEval: 88.8, releaseDate: '2026-05', params: '—', country: 'CN', url: 'https://xiaomi.com' },
  { rank: 11, model: 'DeepSeek V4 Pro (high)', organization: 'DeepSeek', arenaScore: 41, mmlu: null, superClue: 90.5, cEval: 91.0, releaseDate: '2026-06', params: '—', country: 'CN', url: 'https://deepseek.com' },
  { rank: 12, model: 'GLM-5.2 (high)', organization: '智谱 AI', arenaScore: 40, mmlu: null, superClue: 91.0, cEval: 91.8, releaseDate: '2026-06', params: '—', country: 'CN', url: 'https://zhipuai.cn' },
  { rank: 13, model: 'Kimi K2.7 Think', organization: '月之暗面', arenaScore: 39, mmlu: null, superClue: 88.5, cEval: 89.2, releaseDate: '2026-05', params: '—', country: 'CN', url: 'https://kimi.moonshot.cn' },
  { rank: 14, model: 'Qwen3.6 Max', organization: '阿里云', arenaScore: 39, mmlu: null, superClue: 89.0, cEval: 89.8, releaseDate: '2026-06', params: '—', country: 'CN', url: 'https://tongyi.aliyun.com' },
  { rank: 15, model: 'Hy3-Pro', organization: '腾讯混元', arenaScore: 38, mmlu: null, superClue: 88.0, cEval: 89.0, releaseDate: '2026-05', params: '—', country: 'CN', url: 'https://hunyuan.tencent.com' },
  { rank: 16, model: 'Step-3.5 Max', organization: '阶跃星辰', arenaScore: 38, mmlu: null, superClue: 87.5, cEval: 88.0, releaseDate: '2026-06', params: '—', country: 'CN', url: 'https://stepfun.com' },
  { rank: 17, model: 'Baidu ERNIE 5.5 Pro', organization: '百度', arenaScore: 37, mmlu: null, superClue: 87.0, cEval: 87.5, releaseDate: '2026-05', params: '—', country: 'CN', url: 'https://yiyan.baidu.com' },
  { rank: 18, model: 'Qwen3.7 Plus (VL)', organization: '阿里云', arenaScore: 37, mmlu: null, superClue: 86.5, cEval: 87.0, releaseDate: '2026-07', params: '—', country: 'CN', url: 'https://tongyi.aliyun.com' },
  { rank: 19, model: '360GPT-S1 Pro', organization: '360', arenaScore: 36, mmlu: null, superClue: 86.0, cEval: 86.8, releaseDate: '2026-06', params: '—', country: 'CN', url: 'https://360.cn' },
  { rank: 20, model: 'ByteDance Doubao 2.5', organization: '字节跳动', arenaScore: 36, mmlu: null, superClue: 85.5, cEval: 86.0, releaseDate: '2026-05', params: '—', country: 'CN', url: 'https://doubao.com' },
]

export const BENCHMARK_LATEST = '2026-07-25'
export const BENCHMARK_SOURCE_INTL = 'Artificial Analysis Intelligence Index'
export const BENCHMARK_SOURCE_CN = 'SuperCLUE / C-Eval / Artificial Analysis'
