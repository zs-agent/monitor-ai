// /api/arena — 模型竞技场：LMArena + Artificial Analysis 双源动态抓取
// 动态源：
//   1. LMArena Text Arena（Elo 综合榜 / Agent 成功率榜 / 开源模型 Elo）
//   2. Artificial Analysis（推理速度 / API 成本 / 长上下文 / 推理能力指数）
// 降级链：live → cached（60min）→ partial（单源失败）→ static（全部失败）
import { NextResponse } from 'next/server'
import { ARENA_BOARDS, type ArenaBoard, type ArenaEntry } from '@/data/arena'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

const TIMEOUT = 25000
const CACHE_TTL = 60 * 60 * 1000
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const LMARENA_URL = 'https://lmarena.ai/leaderboard/text'
const LMARENA_AGENT_URL = 'https://lmarena.ai/leaderboard/agent'
const LMARENA_OVERVIEW_URL = 'https://lmarena.ai/leaderboard/'
const AA_URL = 'https://artificialanalysis.ai/leaderboards/models'

/** 待接入维度的统一说明 */
const PENDING_NOTE = '暂无免凭证实时源（已尝试 LMArena 分类筛选 / SWE-bench / BFCL / SuperCLUE），待接入后自动更新'

interface CacheEntry {
  boards: ArenaBoard[]
  fetchedAt: number
}
let arenaCache: CacheEntry | null = null

function clean(s: string): string {
  return s.replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ').trim()
}

function parseContext(ctx: string): number {
  const t = ctx.toLowerCase().replace(/,/g, '')
  const m = t.match(/([\d.]+)\s*(m|k)?/)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (m[2] === 'm') return n * 1e6
  if (m[2] === 'k') return n * 1e3
  return n
}

function parseNum(s: string): number | null {
  if (!s || s === '--' || s === '-' || s === '—') return null
  const n = parseFloat(s.replace(/[$,]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** 解析 LMArena 表格 → entries（modelCol：模型列索引；scoreCol：score 列索引） */
function parseLmarenaHtml(html: string, scoreClean: (s: string) => string, scoreCol = 3, modelCol = 2): ArenaEntry[] {
  const trs = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []
  const entries: ArenaEntry[] = []
  for (const tr of trs) {
    const tds = Array.from(tr.matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)).map(m => clean(m[0]))
    if (tds.length <= Math.max(scoreCol, modelCol)) continue
    const link = tr.match(/<a[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/)
    const modelCell = tds[modelCol] || ''
    const model = link ? clean(link[1]) : modelCell.split('·')[0].trim()
    if (!model || model === 'Rank') continue
    const scoreRaw = tds[scoreCol] || ''
    const score = scoreClean(scoreRaw)
    if (!score) continue
    entries.push({
      rank: entries.length + 1,
      model,
      organization: modelCell.split('·')[0].trim().split(' ')[0] || '—',
      score,
      note: tds[4] ? `${tds[4]} votes` : undefined,
    })
  }
  return entries
}

/** 抓取 LMArena Elo 榜（overall / open-source） */
async function fetchLmarenaBoard(url: string): Promise<{ entries: ArenaEntry[]; title: string; date: string; votes: string }> {
  const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } }, TIMEOUT)
  if (!res.ok) throw new Error(`LMArena HTTP ${res.status}`)
  const html = await res.text()
  const entries = parseLmarenaHtml(html, (s) => {
    const m = s.match(/([\d.]+)\s*±/)
    return m ? `Elo ${m[1]}` : ''
  })
  if (entries.length === 0) throw new Error('LMArena: no rows parsed')
  const date = (html.match(/(\w{3} \d{1,2}, \d{4})/) || [])[1] || ''
  const votes = (html.match(/([\d,]+) votes/) || [])[1] || ''
  const title = url.includes('license=open-source') ? '开源模型' : '综合'
  return { entries, title, date, votes }
}

/** 抓取 LMArena Agent 榜（成功率百分比） */
async function fetchLmarenaAgent(): Promise<{ entries: ArenaEntry[]; date: string }> {
  const res = await fetchWithTimeout(LMARENA_AGENT_URL, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } }, TIMEOUT)
  if (!res.ok) throw new Error(`LMArena agent HTTP ${res.status}`)
  const html = await res.text()
  const entries = parseLmarenaHtml(html, (s) => {
    const m = s.match(/([\d.]+) %/)
    return m ? `${m[1]}%` : ''
  }, 2, 1)
  if (entries.length === 0) throw new Error('LMArena agent: no rows parsed')
  const date = (html.match(/(\w{3} \d{1,2}, \d{4})/) || [])[1] || ''
  return { entries: entries.slice(0, 10), date }
}

/** 解析 LMArena Text Arena Overview 表 → 各分类排名（Coding 列=4，Math 列=5） */
async function fetchLmarenaOverview(): Promise<{ model: string; org: string; coding: number | null; math: number | null }[]> {
  const res = await fetchWithTimeout(LMARENA_OVERVIEW_URL, { headers: { 'User-Agent': UA, 'Accept': 'text/html' } }, TIMEOUT)
  if (!res.ok) throw new Error(`LMArena overview HTTP ${res.status}`)
  const html = await res.text()
  const trs = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []
  const rows: { model: string; org: string; coding: number | null; math: number | null }[] = []
  for (const tr of trs) {
    const cells = Array.from(tr.matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)).map(m => clean(m[0]))
    if (cells.length < 6) continue
    const modelCell = cells[0]
    if (!modelCell || modelCell.includes('Model') || !/\s/.test(modelCell)) continue
    const org = modelCell.split(' ')[0] || '—'
    const model = modelCell.replace(org, '').trim()
    const parseRank = (s: string): number | null => {
      const n = parseInt(s, 10)
      return Number.isFinite(n) ? n : null
    }
    rows.push({ model, org, coding: parseRank(cells[4]), math: parseRank(cells[5]) })
  }
  if (rows.length === 0) throw new Error('LMArena overview: no rows parsed')
  return rows
}

/** 抓取 Artificial Analysis 表格 → [模型, 上下文, 厂商, 指数, 成本, tokens/s, 延迟, 响应] */
async function fetchAaRows(): Promise<string[][]> {
  const res = await fetchWithTimeout(
    AA_URL,
    { headers: { 'User-Agent': UA } },
    TIMEOUT,
  )
  if (!res.ok) throw new Error(`Artificial Analysis HTTP ${res.status}`)
  const html = await res.text()
  const trs = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []
  const rows: string[][] = []
  for (const tr of trs) {
    const tds = Array.from(tr.matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)).map(m => clean(m[0]))
    if (tds.length >= 6 && tds[0] && tds[2] && parseNum(tds[3]) !== null) {
      rows.push(tds.slice(0, 9))
    }
  }
  if (rows.length === 0) throw new Error('Artificial Analysis: no rows parsed')
  return rows
}

export async function GET() {
  const now = Date.now()

  if (arenaCache && now - arenaCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({
      state: 'cached',
      fetchedAt: new Date(arenaCache.fetchedAt).toISOString(),
      boards: arenaCache.boards,
      staticBoards: ARENA_BOARDS,
      note: '动态榜单来自 LMArena（Elo/Agent）与 Artificial Analysis；静态快照为人工核实（REF）',
    })
  }

  const [lmOverall, lmAgent, lmOpen, lmOv, aaRowsRes] = await Promise.allSettled([
    fetchLmarenaBoard(LMARENA_URL),
    fetchLmarenaAgent(),
    fetchLmarenaBoard(`${LMARENA_URL}?license=open-source`),
    fetchLmarenaOverview(),
    fetchAaRows(),
  ])
  const partialSources: string[] = []
  if (lmOverall.status === 'rejected') partialSources.push('lmarena-text')
  if (lmAgent.status === 'rejected') partialSources.push('lmarena-agent')
  if (lmOpen.status === 'rejected') partialSources.push('lmarena-open')
  if (lmOv.status === 'rejected') partialSources.push('lmarena-overview')
  if (aaRowsRes.status === 'rejected') partialSources.push('artificial-analysis')

  // AA 维度
  const aaRows = aaRowsRes.status === 'fulfilled' ? aaRowsRes.value : []
  const toAaEntry = (r: string[], score: string, note?: string): ArenaEntry => ({ rank: 0, model: r[0], organization: r[2], score, note })
  const aaSpeed: ArenaEntry[] = aaRows
    .map((r) => ({ r, v: parseNum(r[5]) ?? 0 })).sort((a, b) => b.v - a.v).filter((x) => x.v > 0).slice(0, 8)
    .map((x, i) => ({ ...toAaEntry(x.r, `${x.v.toLocaleString()} tok/s`, x.r[1]), rank: i + 1 }))
  const aaCost: ArenaEntry[] = aaRows
    .map((r) => ({ r, v: parseNum(r[4]) ?? -1 })).filter((x) => x.v >= 0).sort((a, b) => a.v - b.v).slice(0, 8)
    .map((x, i) => ({ ...toAaEntry(x.r, `$${x.v.toFixed(2)}`, x.r[1]), rank: i + 1 }))
  const aaContext: ArenaEntry[] = aaRows
    .map((r) => ({ r, v: parseContext(r[1]) })).sort((a, b) => b.v - a.v).filter((x) => x.v > 0).slice(0, 8)
    .map((x, i) => ({ ...toAaEntry(x.r, x.r[1], x.r[2]), rank: i + 1 }))

  // LMArena Overview：Coding 排名 → 编程能力；Math 排名 → 推理能力
  const ov = lmOv.status === 'fulfilled' ? lmOv.value : []
  const codingRanked: ArenaEntry[] = ov
    .filter((r) => r.coding !== null)
    .sort((a, b) => (a.coding ?? 0) - (b.coding ?? 0))
    .slice(0, 8)
    .map((r, i) => ({ rank: i + 1, model: r.model, organization: r.org, score: `#${r.coding}`, note: 'LMArena Coding 分类排名' }))
  const mathRanked: ArenaEntry[] = ov
    .filter((r) => r.math !== null)
    .sort((a, b) => (a.math ?? 0) - (b.math ?? 0))
    .slice(0, 8)
    .map((r, i) => ({ rank: i + 1, model: r.model, organization: r.org, score: `#${r.math}`, note: 'LMArena Math 分类排名' }))

  const boards: ArenaBoard[] = [
    {
      dimension: '综合能力',
      source: lmOverall.status === 'fulfilled' ? 'LMArena Text Arena（Elo）' : '待接入',
      sourceUrl: LMARENA_URL,
      date: lmOverall.status === 'fulfilled' ? lmOverall.value.date || '实时抓取' : '—',
      methodology: '匿名盲测用户投票 Elo 评分（' + (lmOverall.status === 'fulfilled' ? `${lmOverall.value.votes} 票` : '—') + '），分数越高越强',
      entries: lmOverall.status === 'fulfilled' ? lmOverall.value.entries : [],
    },
    {
      dimension: 'Agent 工具调用',
      source: lmAgent.status === 'fulfilled' ? 'LMArena Agent Arena' : '待接入',
      sourceUrl: LMARENA_AGENT_URL,
      date: lmAgent.status === 'fulfilled' ? lmAgent.value.date || '实时抓取' : '—',
      methodology: 'Agent 任务综合成功率（%），覆盖工具调用/多步骤任务',
      entries: lmAgent.status === 'fulfilled' ? lmAgent.value.entries : [],
    },
    {
      dimension: '本地部署友好度',
      source: lmOpen.status === 'fulfilled' ? 'LMArena 开源模型（Elo）' : '待接入',
      sourceUrl: `${LMARENA_URL}?license=open-source`,
      date: lmOpen.status === 'fulfilled' ? lmOpen.value.date || '实时抓取' : '—',
      methodology: 'LMArena 开源权重模型 Elo 榜（license=open-source 筛选）',
      entries: lmOpen.status === 'fulfilled' ? lmOpen.value.entries : [],
    },
    {
      dimension: '推理速度',
      source: 'Artificial Analysis', sourceUrl: AA_URL,
      date: '实时抓取', methodology: 'Median output speed（tokens/s），因硬件/量化而异，仅作量级参考',
      entries: aaSpeed,
    },
    {
      dimension: 'API 成本',
      source: 'Artificial Analysis', sourceUrl: AA_URL,
      date: '实时抓取', methodology: 'Cost per task（美元），随厂商调价更新',
      entries: aaCost,
    },
    {
      dimension: '长上下文',
      source: 'Artificial Analysis', sourceUrl: AA_URL,
      date: '实时抓取', methodology: '官方上下文窗口（token），数值越大支持越长',
      entries: aaContext,
    },
    {
      dimension: '推理能力',
      source: lmOv.status === 'fulfilled' ? 'LMArena Math 分类排名' : '待接入',
      sourceUrl: LMARENA_OVERVIEW_URL,
      date: '实时抓取',
      methodology: 'LMArena Text Arena Math 分类排名（数学/推理任务盲测排名）',
      entries: mathRanked,
    },
    {
      dimension: '编程能力',
      source: lmOv.status === 'fulfilled' ? 'LMArena Coding 分类排名' : '待接入',
      sourceUrl: LMARENA_OVERVIEW_URL,
      date: '实时抓取',
      methodology: 'LMArena Text Arena Coding 分类排名（编程任务盲测排名）',
      entries: codingRanked,
    },
  ]

  // 全部动态源失败 → static
  if (lmOverall.status === 'rejected' && lmAgent.status === 'rejected' && lmOpen.status === 'rejected' && lmOv.status === 'rejected' && aaRowsRes.status === 'rejected') {
    return NextResponse.json({
      state: 'static',
      fetchedAt: new Date(now).toISOString(),
      boards: [],
      staticBoards: ARENA_BOARDS,
      note: 'LMArena 与 Artificial Analysis 均暂不可达，当前仅显示静态快照（REF）',
    })
  }

  arenaCache = { boards, fetchedAt: now }
  return NextResponse.json({
    state: partialSources.length === 0 ? 'live' : 'partial',
    fetchedAt: new Date(now).toISOString(),
    boards,
    staticBoards: ARENA_BOARDS,
    partialSources,
    note: '动态榜单来自 LMArena（Elo / Agent / 开源）与 Artificial Analysis；静态快照为人工核实（REF）',
  })
}
