// /api/agent-shackles — Agent紧箍咒：自动抓取微信公众号文章
// 抓取链（稳定优先）：
//   1. 合集（appmsgalbum，免登录，官方数据，全量）← 主方案
//   2. 搜狗微信（按公众号名搜索 + 账号过滤）← 降级
//   3. 静态清单（REF）← 最后兜底
// 配置：
//   AGENT_SHACKLES_ACCOUNT  公众号名（默认 Agent紧箍咒）
//   WECHAT_ALBUM_IDS        合集 album_id 列表（逗号分隔），默认内置
//   WECHAT_BIZ               公众号 __biz（默认 MzY4NzI1MTg2NQ==）
import { NextResponse } from 'next/server'
import { AGENT_SHACKLES, type ShacklesItem } from '@/data/agent-shackles'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

export const dynamic = 'force-dynamic'

const TIMEOUT = 15000
const CACHE_TTL = 30 * 60 * 1000
const ACCOUNT = process.env.AGENT_SHACKLES_ACCOUNT || 'Agent紧箍咒'
const WECHAT_BIZ = process.env.WECHAT_BIZ || 'MzY4NzI1MTg2NQ=='
const ALBUM_IDS = (process.env.WECHAT_ALBUM_IDS || '4468009337856294914,4549205397177516037,4535650115386179585,4534451597950681089')
  .split(',').map(s => s.trim()).filter(Boolean)
const SOGOU_PAGES = 3
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

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

interface RawArticle {
  title: string
  link: string
  ts: number
}

/** 抓取单个合集（翻页直到 continue_flag 结束）→ 文章列表 */
async function fetchAlbum(biz: string, albumId: string): Promise<RawArticle[]> {
  const items: RawArticle[] = []
  let beginMsgid = ''
  let beginItemidx = ''

  for (let page = 0; page < 30; page++) {
    const url = `https://mp.weixin.qq.com/mp/appmsgalbum?action=getalbum&__biz=${encodeURIComponent(biz)}&album_id=${albumId}&count=10&begin_msgid=${beginMsgid}&begin_itemidx=${beginItemidx}&continue_flag=&f=json`
    const res = await fetchWithTimeout(
      url,
      { headers: { 'User-Agent': UA, 'Referer': `https://mp.weixin.qq.com/mp/appmsgalbum?__biz=${encodeURIComponent(biz)}&action=getalbum&album_id=${albumId}` } },
      TIMEOUT,
    )
    if (!res.ok) throw new Error(`Album HTTP ${res.status}`)
    const body = await res.json().catch(() => null)
    const resp = body?.getalbum_resp
    if (!resp) throw new Error('Album: bad response')

    // article_list 兼容：多篇是数组，单篇是对象
    const list = Array.isArray(resp.article_list) ? resp.article_list : (resp.article_list ? [resp.article_list] : [])
    for (const it of list) {
      const title = clean(it.title)
      const link = (it.url || it.link || '')
      if (!title || !link) continue
      items.push({
        title,
        link: link.startsWith('http') ? link : `https://mp.weixin.qq.com${link}`,
        ts: parseInt(it.create_time, 10) || 0,
      })
    }

    if (!resp.continue_flag || list.length === 0) break
    const last = list[list.length - 1]
    beginMsgid = String(last.msgid || '')
    beginItemidx = String(last.itemidx || '')
  }
  return items
}

/** 抓取全部合集 → 去重 → 时间倒序 */
async function fetchAllAlbums(): Promise<RawArticle[]> {
  const all: RawArticle[] = []
  let failed = 0
  for (const albumId of ALBUM_IDS) {
    try {
      all.push(...await fetchAlbum(WECHAT_BIZ, albumId))
    } catch {
      failed++
    }
  }
  if (failed === ALBUM_IDS.length && all.length === 0) throw new Error('All albums failed')
  // 去重（title + link）
  const seen = new Set<string>()
  const dedup = all.filter(a => {
    const key = `${a.title}-${a.link}`.slice(0, 100)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => b.ts - a.ts)
  return dedup
}

interface SogouHit {
  title: string
  summary: string
  account: string
  ts: number | null
  link: string
}

/** 账号名归一化（搜狗显示的"Agent 紧箍咒"带空格，与配置"Agent紧箍咒"匹配） */
const normAccount = (s: string): string => (s || '').replace(/\s+/g, '').toLowerCase()

/** 降级：搜狗微信按公众号名搜索 + 账号过滤 */
async function fetchSogouArticles(): Promise<SogouHit[]> {
  const target = normAccount(ACCOUNT)
  const hits: SogouHit[] = []
  let captchaHit = false

  for (let page = 1; page <= SOGOU_PAGES; page++) {
    const url = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(ACCOUNT)}&page=${page}`
    const res = await fetchWithTimeout(
      url,
      { headers: { 'User-Agent': UA, 'Referer': 'https://weixin.sogou.com/' } },
      TIMEOUT,
    )
    if (!res.ok) { if (page === 1) throw new Error(`Sogou HTTP ${res.status}`); break }
    const html = await res.text()
    if (html.includes('antispider') || html.includes('请输入验证码')) { captchaHit = true; break }

    const boxes = Array.from(html.matchAll(/id="sogou_vr_11002601_box_(\d+)"[\s\S]*?<\/li>/g))
    if (boxes.length === 0) break

    for (const b of boxes) {
      const block = b[0]
      const title = clean((block.match(/<h3>[\s\S]*?>([\s\S]*?)<\/a>/) || [])[1])
      const acc = clean((block.match(/class="all-time-y2">([\s\S]*?)<\/span>/) || [])[1])
      if (!title || normAccount(acc) !== target) continue
      const summary = clean((block.match(/class="txt-info"[^>]*>([\s\S]*?)<\/p>/) || [])[1])
      const tsM = block.match(/timeConvert\('(\d+)'\)/)
      const linkM = block.match(/href="(\/link\?url=[^"]*)"/)
      hits.push({
        title,
        summary,
        account: acc,
        ts: tsM ? parseInt(tsM[1], 10) : null,
        link: linkM ? `https://weixin.sogou.com${linkM[1]}` : '',
      })
    }
  }

  if (captchaHit && hits.length === 0) throw new Error('Sogou anti-spider triggered')
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
      note: `自动抓取自微信公众号「${ACCOUNT}」（合集 + 搜狗，30 分钟缓存）`,
    })
  }

  let items: ShacklesItem[] = []
  let mode = 'album'
  let note = ''

  try {
    const articles = await fetchAllAlbums()
    items = articles.map((a, i) => ({
      id: `wx-album-${a.ts}-${i}`,
      title: a.title,
      publishedAt: new Date((a.ts || now) * 1000).toISOString(),
      summary: '',
      keywords: [],
      related: [ACCOUNT],
      url: a.link,
      priority: false,
      source: 'rss' as const,
    }))
    note = `自动抓取自微信公众号「${ACCOUNT}」（${ALBUM_IDS.length} 个合集，免登录官方接口）`
  } catch {
    // 合集失败 → 降级搜狗
    mode = 'sogou'
    try {
      const hits = await fetchSogouArticles()
      items = hits.map((h, i) => ({
        id: `wx-${h.ts ?? now}-${i}`,
        title: h.title,
        publishedAt: h.ts ? new Date(h.ts * 1000).toISOString() : new Date(now).toISOString(),
        summary: h.summary || '',
        keywords: [],
        related: [h.account],
        url: h.link,
        priority: false,
        source: 'rss' as const,
      }))
      note = `合集接口暂不可达，降级为搜狗微信（按公众号名过滤，${ACCOUNT}）`
    } catch {
      return NextResponse.json({
        state: 'static',
        fetchedAt: new Date(now).toISOString(),
        items: [],
        staticItems: AGENT_SHACKLES,
        account: ACCOUNT,
        note: '合集与搜狗均暂不可达，当前显示静态清单（REF）',
      })
    }
  }

  if (items.length === 0) {
    note = mode === 'album'
      ? `合集接口可达但未返回文章（请检查 ${ALBUM_IDS.length} 个合集配置）`
      : `搜狗暂未检索到「${ACCOUNT}」的文章`
  }

  shacklesCache = { items, fetchedAt: now }
  return NextResponse.json({
    state: 'live',
    fetchedAt: new Date(now).toISOString(),
    items: items.slice(0, 30),
    staticItems: AGENT_SHACKLES,
    account: ACCOUNT,
    note,
  })
}
