// /api/arena — 模型竞技场：Artificial Analysis 单源动态抓取（RSC JSON，服务器可达）
// 覆盖 8 维：综合 / 编程 / Agent / 推理 / 速度 / 成本 / 上下文 / 本地部署
// 降级链：live → cached（60min）→ static（全部失败时用 ARENA_BOARDS 人工快照 REF）
// 注：原 LMArena 抓取因生产服务器被网络封锁（TLS 重置）不可用，故统一改用 AA 指标；
//     维度口径随之变为 AA 指数（Intelligence/Coding/Agentic Index 等），非 LMArena Elo。
import { NextResponse } from 'next/server'
import { ARENA_BOARDS, type ArenaBoard, type ArenaDimension, type ArenaEntry } from '@/data/arena'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export const dynamic = 'force-dynamic'

const TIMEOUT = 25000
const CACHE_TTL = 60 * 60 * 1000
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const AA_URL = 'https://artificialanalysis.ai/leaderboards/models'

/* ---------- 模型名清洗与厂商推断 ---------- */

/** 厂商关键词 → 展示名（长关键词优先以降低误匹配） */
const VENDOR_MAP: [string, string][] = [
  ['anthropic', 'Anthropic'], ['claude', 'Anthropic'],
  ['openai', 'OpenAI'], ['gpt', 'OpenAI'], ['o1', 'OpenAI'], ['o3', 'OpenAI'], ['chatgpt', 'OpenAI'],
  ['google', 'Google'], ['gemini', 'Google'], ['gemma', 'Google'], ['palm', 'Google'], ['bard', 'Google'],
  ['meta', 'Meta'], ['llama', 'Meta'], ['muse', 'Meta'],
  ['alibaba', 'Alibaba Qwen'], ['qwen', 'Alibaba Qwen'], ['tongyi', 'Alibaba Qwen'],
  ['deepseek', 'DeepSeek'],
  ['moonshot', 'Moonshot AI'], ['kimi', 'Moonshot AI'],
  ['xai', 'xAI'], ['grok', 'xAI'],
  ['mistral', 'Mistral AI'],
  ['zhipu', 'Zhipu AI'], ['glm', 'Zhipu AI'],
  ['bytedance', 'ByteDance'], ['doubao', 'ByteDance'], ['seed', 'ByteDance'],
  ['minimax', 'MiniMax'],
  ['microsoft', 'Microsoft'], ['phi', 'Microsoft'], ['copilot', 'Microsoft'],
  ['cohere', 'Cohere'], ['command', 'Cohere'], ['aya', 'Cohere'],
  ['huggingface', 'Hugging Face'], ['idefics', 'Hugging Face'],
  ['baidu', 'Baidu'], ['ernie', 'Baidu'], ['wenxin', 'Baidu'],
  ['nvidia', 'NVIDIA'], ['nemotron', 'NVIDIA'],
  ['01', '01.AI'], ['yi-', '01.AI'],
]

/** 厂商关键词 → 展示名（inferOrg 用） */
function inferOrg(model: string, fallback: string): string {
  const lower = (model || '').toLowerCase()
  for (const [kw, org] of VENDOR_MAP) {
    if (lower.includes(kw)) return org
  }
  return fallback || '—'
}

interface CacheEntry {
  boards: ArenaBoard[]
  fetchedAt: number
}
let arenaCache: CacheEntry | null = null

/* ---------- AA RSC JSON 抓取 ---------- */

/** AA 页面内嵌 RSC payload 中的模型对象（只取用到的字段） */
interface AaModel {
  name: string
  modelCreatorName: string | null
  intelligenceIndex: number | null
  codingIndex: number | null
  terminalBench40: number | null
  scicode: number | null
  tau2: number | null
  agenticIndex: number | null
  gpqa: number | null
  medianOutputTokensPerSecond: number | null
  price1mInputTokens: number | null
  price1mOutputTokens: number | null
  contextWindowTokens: number | null
  isOpenWeights: boolean | null
}

/** 抓取 AA 排行榜 → 全量模型数组（解析 Next.js RSC payload 中的 models JSON） */
async function fetchAaModels(): Promise<AaModel[]> {
  const res = await fetchWithTimeout(
    AA_URL,
    { headers: { 'User-Agent': UA }, cache: 'no-store' },
    TIMEOUT,
  )
  if (!res.ok) throw new Error(`Artificial Analysis HTTP ${res.status}`)
  const html = await res.text()

  // RSC payload 有多个 push 块，取含完整模型指标（intelligenceIndex）的那个
  const blocks = Array.from(html.matchAll(/self\.__next_f\.push\(\[\d+,"((?:[^"\\]|\\.)*)"\]\)/g))
  let decoded = ''
  for (const b of blocks) {
    const d = JSON.parse(`"${b[1]}"`) as string
    if (d.includes('"intelligenceIndex"')) { decoded = d; break }
  }
  if (!decoded) throw new Error('AA: RSC payload not found')
  const mm = decoded.match(/"models":(\[[\s\S]*?\]),"messages"/)
  if (!mm) throw new Error('AA: models array not found in payload')
  const rows: unknown = JSON.parse(mm[1])
  if (!Array.isArray(rows)) throw new Error('AA: invalid models payload')
  const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
  const rate = (value: unknown): number | null => { const n = number(value); return n != null && n <= 1 ? n : null }
  return rows.flatMap((raw: unknown): AaModel[] => {
    if (!raw || typeof raw !== 'object') return []
    const row = raw as Record<string, unknown>
    if (typeof row.name !== 'string' || !row.name.trim() || row.deprecated === true) return []
    return [{
      name: row.name.trim(), modelCreatorName: typeof row.modelCreatorName === 'string' ? row.modelCreatorName : null,
      intelligenceIndex: number(row.intelligenceIndex), codingIndex: number(row.codingIndex),
      agenticIndex: number(row.agenticIndex), terminalBench40: rate(row.terminalBench40),
      scicode: rate(row.scicode), tau2: rate(row.tau2), gpqa: rate(row.gpqa),
      medianOutputTokensPerSecond: number(row.medianOutputTokensPerSecond),
      price1mInputTokens: number(row.price1mInputTokens), price1mOutputTokens: number(row.price1mOutputTokens),
      contextWindowTokens: number(row.contextWindowTokens), isOpenWeights: row.isOpenWeights === true,
    }]
  })
}

/** 按数值字段排序取前 N，构造 entries；score 由 formatter 生成 */
function rankEntries(
  models: AaModel[],
  pick: (x: AaModel) => number | null,
  formatter: (x: AaModel, v: number) => string,
  limit = 8,
  opts: { filter?: (x: AaModel) => boolean; ascending?: boolean } = {},
): ArenaEntry[] {
  const { filter, ascending } = opts
  const list = models
    .filter(x => (filter ? filter(x) : true) && pick(x) != null)
    .sort((a, b) => (ascending ? (pick(a) as number) - (pick(b) as number) : (pick(b) as number) - (pick(a) as number)))
    .slice(0, limit)
  return list.map((x, i) => ({
    rank: i + 1,
    model: x.name,
    organization: x.modelCreatorName || inferOrg(x.name, '—'),
    score: formatter(x, pick(x) as number),
  }))
}

function fmtContext(tokens: number): string {
  if (tokens >= 1e6) return `${(tokens / 1e6).toFixed(1).replace(/\.0$/, '')}M`
  if (tokens >= 1e3) return `${(tokens / 1e3).toFixed(1).replace(/\.0$/, '')}K`
  return String(tokens)
}

export async function GET() {
  const now = Date.now()

  if (arenaCache && now - arenaCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({
      state: 'cached',
      fetchedAt: new Date(arenaCache.fetchedAt).toISOString(),
      boards: arenaCache.boards,
      staticBoards: ARENA_BOARDS,
      note: '动态榜单来自Artificial Analysis；编程/工具调用使用标注的具体基准，成本分别显示输入/输出价；REF为历史参考快照',
    })
  }

  let models: AaModel[] = []
  try {
    models = await fetchAaModels()
  } catch (error) {
    console.warn('Arena source unavailable:', error instanceof Error ? error.message : String(error))
    // 全部失败 → static 快照
    return NextResponse.json({
      state: 'static',
      fetchedAt: new Date(now).toISOString(),
      boards: [],
      staticBoards: ARENA_BOARDS,
      note: 'Artificial Analysis 暂不可达，当前仅显示静态快照（REF）',
    })
  }

  const mk = (dimension: ArenaDimension, entries: ArenaEntry[], source: string, sourceUrl: string, methodology: string): ArenaBoard => ({
    dimension,
    source,
    sourceUrl,
    date: '实时抓取',
    methodology,
    entries,
    ...(entries.length ? {} : { unavailableReason: "上游暂未提供此项可用数据，未用其他维度分数代替。" }),
  })

  const boards: ArenaBoard[] = [
    mk('综合能力',
      rankEntries(models, x => x.intelligenceIndex, (x, v) => v.toFixed(1), 10),
      'Artificial Analysis（Intelligence Index）', AA_URL,
      'AA 综合智能指数（0-100），融合多任务基准，越高越强'),
    mk('编程能力',
      rankEntries(models, x => x.terminalBench40, (x, v) => (v * 100).toFixed(1) + '%', 8),
      'Artificial Analysis（Terminal-Bench 4.0）', 'https://artificialanalysis.ai/methodology/intelligence-benchmarking',
      'Terminal-Bench 4.0终端编程任务成功率；只在同一基准和版本内比较，未测量的模型不参与排名'),
    mk('Agent 工具调用',
      rankEntries(models, x => x.tau2, (x, v) => (v * 100).toFixed(1) + '%', 8),
      'Artificial Analysis（τ²-Bench Telecom）', 'https://artificialanalysis.ai/evaluations/tau2-bench',
      'τ²-Bench Telecom多轮工具调用任务成功率；仅覆盖该场景，不等于所有Agent任务的综合能力'),
    mk('推理能力',
      rankEntries(models, x => x.gpqa, (x, v) => `${(v * 100).toFixed(0)}%`, 8),
      'Artificial Analysis（GPQA）', AA_URL,
      'GPQA 研究生级科学问答正确率（%），衡量强推理'),
    mk('推理速度',
      rankEntries(models, x => x.medianOutputTokensPerSecond, (x, v) => `${v.toLocaleString()} tok/s`, 8),
      'Artificial Analysis', AA_URL,
      'Median output speed（tokens/s），因硬件/量化而异，仅作量级参考'),
    mk('API 成本',
      rankEntries(models, x => x.price1mInputTokens, (x, v) => '$' + v.toLocaleString('en-US', { maximumFractionDigits: 5 }) + ' / $' + x.price1mOutputTokens!.toLocaleString('en-US', { maximumFractionDigits: 5 }), 8,
        { filter: x => x.price1mInputTokens != null && x.price1mOutputTokens != null, ascending: true }),
      'Artificial Analysis（输入/输出单价）', AA_URL,
      '输入价 / 输出价，单位：美元/百万Token；按输入价从低到高排列，不含缓存折扣与实际任务的Token消耗'),
    mk('长上下文',
      rankEntries(models, x => x.contextWindowTokens, (x, v) => fmtContext(v), 8),
      'Artificial Analysis', AA_URL,
      '官方上下文窗口（token），数值越大支持越长'),
    mk('本地部署友好度',
      rankEntries(models, x => x.intelligenceIndex, (x, v) => v.toFixed(1), 8, { filter: x => x.isOpenWeights === true }),
      'Artificial Analysis（开源权重）', AA_URL,
      '开源权重（open-weights）模型按 Intelligence Index 排名'),
  ]

  arenaCache = { boards, fetchedAt: now }
  return NextResponse.json({
    state: 'live',
    fetchedAt: new Date(now).toISOString(),
    boards,
    staticBoards: ARENA_BOARDS,
    note: '动态榜单来自Artificial Analysis；编程/工具调用使用标注的具体基准，成本分别显示输入/输出价；REF为历史参考快照',
  })
}
