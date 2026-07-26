'use client'

interface AnalyticsEvent {
  type: 'pageview' | 'interaction' | 'search' | 'error'
  path: string
  timestamp: number
  metadata?: Record<string, string>
}

interface DailyStats {
  date: string
  pageviews: number
  interactions: number
  errors: number
  sessions: number
  signalClicks: number
  categoryClicks: Record<string, number>
}

const ANALYTICS_KEY = 'monitor-ai-analytics-v1'
const SESSION_KEY = 'monitor-ai-session-v1'
const SESSION_TIMEOUT = 30 * 60 * 1000

function getDailyKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function getStats(): Record<string, DailyStats> {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveStats(stats: Record<string, DailyStats>): void {
  try { localStorage.setItem(ANALYTICS_KEY, JSON.stringify(stats)) } catch {}
}

function getOrCreateToday(): DailyStats {
  const stats = getStats()
  const key = getDailyKey()
  if (!stats[key]) {
    stats[key] = {
      date: key,
      pageviews: 0,
      interactions: 0,
      errors: 0,
      sessions: 0,
      signalClicks: 0,
      categoryClicks: {},
    }
  }
  return stats[key]
}

function persistToday(updated: DailyStats): void {
  const stats = getStats()
  stats[getDailyKey()] = updated
  saveStats(stats)
}

function trackSession(): void {
  const now = Date.now()
  const lastActive = localStorage.getItem(SESSION_KEY)
  const today = getOrCreateToday()
  
  if (!lastActive || (now - parseInt(lastActive)) > SESSION_TIMEOUT) {
    today.sessions += 1
    persistToday(today)
  }
  localStorage.setItem(SESSION_KEY, now.toString())
}

export function trackPageview(path: string): void {
  const today = getOrCreateToday()
  today.pageviews += 1
  persistToday(today)
  trackSession()
}

export function trackInteraction(type: string, metadata?: Record<string, string>): void {
  const today = getOrCreateToday()
  today.interactions += 1
  if (type === 'signalClick') today.signalClicks += 1
  if (type === 'categoryClick' && metadata?.category) {
    today.categoryClicks[metadata.category] = (today.categoryClicks[metadata.category] || 0) + 1
  }
  persistToday(today)
  trackSession()
}

export function trackError(): void {
  const today = getOrCreateToday()
  today.errors += 1
  persistToday(today)
}

export interface AnalyticsSummary {
  today: DailyStats | null
  week: DailyStats[]
  totalPageviews: number
  totalInteractions: number
  dau: number
}

export function getAnalyticsSummary(): AnalyticsSummary {
  const stats = getStats()
  const today = stats[getDailyKey()] || null
  
  const week: DailyStats[] = []
  const keys = Object.keys(stats).sort().reverse()
  for (const key of keys.slice(0, 7)) {
    week.push(stats[key])
  }
  
  const totalPageviews = Object.values(stats).reduce((sum, d) => sum + d.pageviews, 0)
  const totalInteractions = Object.values(stats).reduce((sum, d) => sum + d.interactions, 0)
  const dau = week.length > 0 
    ? Math.round(week.reduce((sum, d) => sum + d.sessions, 0) / week.length)
    : 0

  return { today, week, totalPageviews, totalInteractions, dau }
}

export function initAnalytics(): void {
  if (typeof window === 'undefined') return
  trackPageview(window.location.pathname)
  
  const originalPushState = history.pushState
  history.pushState = function(...args) {
    originalPushState.apply(this, args)
    trackPageview(window.location.pathname)
  }
  window.addEventListener('popstate', () => trackPageview(window.location.pathname))
}
