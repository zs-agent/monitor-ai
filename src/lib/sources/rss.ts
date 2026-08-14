import type { Signal } from '@/types/signal'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { inferCountry, sourceCredibility } from '@/lib/normalizer'
import type { SignalProvider } from './types'

const TIMEOUT = 8000

export interface RssRoute {
  /** RSSHub 路由，如 '/arxiv/cs.AI'（不含 ?format=json） */
  route: string
  category: Signal['category']
  /** 1-5，数据源权威度 */
  credibility: number
  /** 指定语言的路由；省略则按请求 locale 输出 */
  language?: 'zh' | 'en'
}

/** 只选免登录路由；微信公众号等需要 cookie 的路由不进默认列表 */
const DEFAULT_ROUTES: RssRoute[] = [
  { route: '/arxiv/cs.AI', category: 'papers', credibility: 4 },
  { route: '/arxiv/cs.LG', category: 'papers', credibility: 4 },
  { route: '/v2ex/tech', category: 'industry', credibility: 2 },
  { route: '/zhihu/hotlist', category: 'industry', credibility: 2, language: 'zh' },
  { route: '/bilibili/popular/科技', category: 'products', credibility: 2, language: 'zh' },
]

interface RssHubItem {
  title?: string
  link?: string
  description?: string
  pubDate?: string
  author?: string
  category?: string | string[]
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeRssItem(item: RssHubItem, route: RssRoute, locale: 'zh' | 'en'): Signal {  const title = item.title || 'Untitled'
  const summary = stripHtml(item.description || '').slice(0, 200)
  return {
    id: `rss-${Buffer.from(title).toString('base64url').slice(0, 24)}`,
    title,
    summary,
    source: `RSSHub ${route.route.split('/').filter(Boolean)[0] || 'feed'}`,
    sourceUrl: item.link || '',
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    category: route.category,
    country: inferCountry(title),
    credibility: route.credibility,
    tags: ['rsshub'],
    importance: route.credibility >= 4 ? 3 : 2,
    sourcesCount: 1,
    language: route.language ?? locale,
    providerId: 'rsshub',
  }
}

export const rssProvider: SignalProvider = {
  id: 'rsshub',
  name: 'RSSHub',
  pollIntervalMs: 5 * 60 * 1000,
  async fetchSignals(locale): Promise<Signal[]> {
    const base = (process.env.RSSHUB_BASE_URL || '').replace(/\/$/, '')
    if (!base) throw new Error('RSSHUB_BASE_URL not configured')
    if (base.includes('rsshub.app')) {
      throw new Error('RSSHUB_BASE_URL must point to a self-hosted instance, not the public rsshub.app')
    }

    const routes = DEFAULT_ROUTES.filter(r => !r.language || r.language === locale)
    const results = await Promise.allSettled(
      routes.map(r => fetchWithTimeout(`${base}${r.route}?format=json`, {}, TIMEOUT)),
    )

    const signals: Signal[] = []
    let okCount = 0
    for (let i = 0; i < routes.length; i++) {
      const r = results[i]
      if (r.status !== 'fulfilled' || !r.value.ok) {
        console.warn(`[rsshub] skip route ${routes[i].route}: ${r.status === 'fulfilled' ? `HTTP ${r.value.status}` : r.reason?.message || 'unknown'}`)
        continue
      }
      try {
        const body = await r.value.json()
        const items: RssHubItem[] = body?.data?.items || body?.items || []
        for (const item of items) {
          try { signals.push(normalizeRssItem(item, routes[i], locale)) } catch { /* skip malformed item */ }
        }
        okCount++
      } catch (e) {
        console.warn(`[rsshub] parse failed for ${routes[i].route}: ${(e as Error)?.message}`)
      }
    }

    // 所有路由都失败才 throw（由聚合层走 stale/mock 降级）；部分失败只跳过
    if (okCount === 0 && signals.length === 0) throw new Error('RSSHub: all routes failed')
    return signals
  },
}
