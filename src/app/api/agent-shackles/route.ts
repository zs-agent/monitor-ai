// /api/agent-shackles — Agent紧箍咒：自动抓取微信公众号文章
// 源：搜狗微信搜索（按公众号名检索文章，无需登录）
// 说明：微信无公开聚合 API，搜狗是唯一免凭证路径；反爬风险由缓存+降级兜底。
// 公众号名配置：环境变量 AGENT_SHACKLES_ACCOUNT（未配置时用占位名）
// 降级链：live → cached（30min）→ partial（部分解析）→ static（静态清单）
import { NextResponse } from 'next/server'
import { AGENT_SHACKLES, type ShacklesItem } from '@/data/agent-shackles'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

const TIMEOUT = 15000
const CACHE_TTL = 30 * 60 * 1000
const ACCOUNT = process.env.AGENT_SHACKLES_ACCOUNT || 'Agent'

interface CacheEntry {
  items: ShacklesItem[]
  fetchedAt: number
}
let shacklesCache: CacheEntry | null = null

function clean(s: string): string {
  return (s || '').replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

interface SogouHit {
  title: string
  summary: string
  account: string
  ts: number | null
  link: string
}

/** 抓取并解析搜狗微信搜索结果 */
async function fetchSogouArticles(): Promise<SogouHit[]> {
  const url = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(ACCOUNT)}`
  const res = await fetchWithTimeout(
    url,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0', 'Referer': 'https://weixin.sogou.com/' } },
    TIMEOUT,
  )
  if (!res.ok) throw new Error(`Sogou HTTP ${res.status}`)
  const html = await res.text()
  if (html.includes('antispider') || html.includes('请输入验证码')) {
    throw new Error('Sogou anti-spider triggered')
  }

  const titleIds = Array.from(html.matchAll(/href="(\/link\?url=[^"]*)"[\s\S]*?id="sogou_vr_11002601_title_(\d+)"[\s\S]*?>([\s\S]*?)<\/a>/g))
  const summaryIds = Array.from(html.matchAll(/id="sogou_vr_11002601_summary_(\d+)"[^>]*>([\s\S]*?)<\/p>/g))
  const summaryMap = new Map(summaryIds.map(m => [m[1], clean(m[2])]))
  const tsMatch = Array.from(html.matchAll(/timeConvert\('(\d+)'\)/g))

  const hits: SogouHit[] = []
  for (const m of titleIds) {
    const title = clean(m[3])
    if (!title) continue
    // 来源账号：取页面中账号名（搜狗结构里账号紧随摘要后出现，取第一个未消费的）
    hits.push({
      title,
      summary: summaryMap.get(m[2]) || '',
      account: ACCOUNT,
      ts: null,
      link: m[1].startsWith('http') ? m[1] : `https://weixin.sogou.com${m[1]}`,
    })
  }

  // 时间戳（按出现顺序匹配到条目）
  const times = tsMatch.map(x => parseInt(x[1], 10))
  hits.forEach((h, i) => { if (times[i]) h.ts = times[i] })
  if (hits.length === 0) throw new Error('Sogou: no articles parsed')
  return hits
}

export async function GET() {
  const now = Date.now()

  if (shacklesCache && now - shacklesCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({
      state: 'cached',
      fetchedAt: new Date(shacklesCache.fetchedAt).toISOString(),
      items: shacklesCache.items,
      staticItems: AGENT_SHACKLES,
      account: ACCOUNT,
      note: `自动抓取自微信公众号「${ACCOUNT}」（搜狗微信）`,
    })
  }

  let items: ShacklesItem[] = []
  try {
    const hits = await fetchSogouArticles()
    items = hits.map((h, i) => ({
      id: `wx-${h.ts ?? now}-${i}`,
      title: h.title,
      publishedAt: h.ts ? new Date(h.ts * 1000).toISOString() : new Date(now).toISOString(),
      summary: h.summary || '（搜狗未返回摘要）',
      keywords: [],
      related: [h.account],
      url: h.link,
      priority: false,
      source: 'rss' as const,
    }))
  } catch {
    return NextResponse.json({
      state: 'static',
      fetchedAt: new Date(now).toISOString(),
      items: [],
      staticItems: AGENT_SHACKLES,
      account: ACCOUNT,
      note: '搜狗微信暂不可达（可能触发反爬），当前显示静态清单（REF）',
    })
  }

  shacklesCache = { items, fetchedAt: now }
  return NextResponse.json({
    state: 'live',
    fetchedAt: new Date(now).toISOString(),
    items: items.slice(0, 12),
    staticItems: AGENT_SHACKLES,
    account: ACCOUNT,
    note: `自动抓取自微信公众号「${ACCOUNT}」（搜狗微信，30 分钟缓存）`,
  })
}
