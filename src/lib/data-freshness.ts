export type FreshnessStatus = 'fresh' | 'stale' | 'very_stale' | 'no_data' | 'disabled' | 'error'

export interface DataSourceState {
  id: string
  name: string
  lastUpdate: number | null
  lastError: string | null
  itemCount: number
  enabled: boolean
  status: FreshnessStatus
}

export interface DataFreshnessSummary {
  totalSources: number
  activeSources: number
  staleSources: number
  disabledSources: number
  errorSources: number
  overallStatus: 'sufficient' | 'limited' | 'insufficient'
  coveragePercent: number
}

export interface PanelFreshnessSource {
  id: string
  name: string
  status: FreshnessStatus
  lastUpdate: number | null
  itemCount: number
  lastError: string | null
}

const FRESH_THRESHOLD = 15 * 60 * 1000
const STALE_THRESHOLD = 2 * 60 * 60 * 1000
const VERY_STALE_THRESHOLD = 6 * 60 * 60 * 1000

const INTELLIGENCE_GAP_MESSAGES: Record<string, string> = {
  hackernews: 'Breaking AI news may be missed—Hacker News feed unavailable',
  huggingface: 'Latest AI papers may be missed—HuggingFace Daily Papers unavailable',
}

type Listener = () => void

class DataFreshnessTracker {
  private sources = new Map<string, DataSourceState>()
  private listeners = new Set<Listener>()

  register(id: string, name: string): void {
    if (!this.sources.has(id)) {
      this.sources.set(id, {
        id,
        name,
        lastUpdate: null,
        lastError: null,
        itemCount: 0,
        enabled: true,
        status: 'no_data',
      })
    }
  }

  recordUpdate(id: string, itemCount: number): void {
    const source = this.sources.get(id)
    if (!source) return
    source.lastUpdate = Date.now()
    source.itemCount = itemCount
    source.lastError = null
    source.status = this.calculateStatus(source)
    this.notifyListeners()
  }

  recordError(id: string, error: string): void {
    const source = this.sources.get(id)
    if (!source) return
    source.lastError = error
    source.status = 'error'
    this.notifyListeners()
  }

  setEnabled(id: string, enabled: boolean): void {
    const source = this.sources.get(id)
    if (source) {
      source.enabled = enabled
      source.status = enabled ? this.calculateStatus(source) : 'disabled'
      this.notifyListeners()
    }
  }

  getSource(id: string): DataSourceState | undefined {
    const source = this.sources.get(id)
    if (source) {
      source.status = source.enabled ? this.calculateStatus(source) : 'disabled'
    }
    return source
  }

  getAllSources(): DataSourceState[] {
    return Array.from(this.sources.values()).map(s => ({
      ...s,
      status: s.enabled ? this.calculateStatus(s) : 'disabled',
    }))
  }

  getSummary(): DataFreshnessSummary {
    const sources = this.getAllSources()
    const activeSources = sources.filter(s => s.status === 'fresh' || s.status === 'stale' || s.status === 'very_stale')
    const staleSources = sources.filter(s => s.status === 'stale' || s.status === 'very_stale')
    const disabledSources = sources.filter(s => s.status === 'disabled')
    const errorSources = sources.filter(s => s.status === 'error')

    const coveragePercent = sources.length > 0
      ? Math.round((activeSources.length / sources.length) * 100)
      : 0

    let overallStatus: 'sufficient' | 'limited' | 'insufficient'
    if (activeSources.length >= 2 && coveragePercent >= 66) {
      overallStatus = 'sufficient'
    } else if (activeSources.length >= 1) {
      overallStatus = 'limited'
    } else {
      overallStatus = 'insufficient'
    }

    return {
      totalSources: sources.length,
      activeSources: activeSources.length,
      staleSources: staleSources.length,
      disabledSources: disabledSources.length,
      errorSources: errorSources.length,
      overallStatus,
      coveragePercent,
    }
  }

  getIntelligenceGaps(): { source: string; message: string }[] {
    const gaps: { source: string; message: string }[] = []
    for (const source of this.getAllSources()) {
      if (source.status === 'no_data' || source.status === 'very_stale' || source.status === 'error') {
        const message = INTELLIGENCE_GAP_MESSAGES[source.id] || `${source.name} data unavailable`
        gaps.push({ source: source.id, message })
      }
    }
    return gaps
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getTimeSince(id: string): string {
    const source = this.sources.get(id)
    if (!source?.lastUpdate) return 'never'
    const ms = Math.max(0, Date.now() - source.lastUpdate)
    if (ms < 60000) return 'just now'
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`
    return `${Math.floor(ms / 86400000)}d ago`
  }

  private calculateStatus(source: DataSourceState): FreshnessStatus {
    if (!source.enabled) return 'disabled'
    if (source.lastError) return 'error'
    if (!source.lastUpdate) return 'no_data'

    const age = Date.now() - source.lastUpdate
    if (age <= FRESH_THRESHOLD) return 'fresh'
    if (age <= STALE_THRESHOLD) return 'stale'
    if (age <= VERY_STALE_THRESHOLD) return 'very_stale'
    return 'no_data'
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try { listener() } catch { /* ignore */ }
    })
  }
}

const freshnessStore = globalThis as typeof globalThis & { __monitorDataFreshness?: DataFreshnessTracker }
export const dataFreshness = freshnessStore.__monitorDataFreshness ??= new DataFreshnessTracker()
