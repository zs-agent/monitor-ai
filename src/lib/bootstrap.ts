const BOOTSTRAP_CACHE_KEY = 'monitor-ai-bootstrap-v1'
const BOOTSTRAP_CACHE_TTL = 30 * 60 * 1000 // 30 min

interface BootstrapCache {
  timestamp: number
  signals: any[]
  freshness: any
}

function getCached(): BootstrapCache | null {
  try {
    const raw = localStorage.getItem(BOOTSTRAP_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BootstrapCache
    if (Date.now() - parsed.timestamp > BOOTSTRAP_CACHE_TTL) return null
    return parsed
  } catch { return null }
}

function setCache(data: BootstrapCache): void {
  try { localStorage.setItem(BOOTSTRAP_CACHE_KEY, JSON.stringify(data)) } catch {}
}

export function getBootstrapData(): BootstrapCache | null {
  return getCached()
}

export function persistBootstrap(signals: any[], freshness: any): void {
  setCache({ timestamp: Date.now(), signals, freshness })
}

export function clearBootstrapCache(): void {
  try { localStorage.removeItem(BOOTSTRAP_CACHE_KEY) } catch {}
}
