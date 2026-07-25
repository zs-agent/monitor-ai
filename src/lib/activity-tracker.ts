const NEW_TAG_DURATION_MS = 2 * 60 * 1000
const HIGHLIGHT_DURATION_MS = 30 * 1000
const READ_STATE_KEY = 'monitor-ai-read-state-v1'

interface PersistedReadState {
  v: 1
  lastVisitAt: number
}

interface PanelState {
  seenIds: Set<string>
  firstSeenTime: Map<string, number>
  newCount: number
  lastInteraction: number
}

type ChangeCallback = (newCount: number) => void

class ActivityTracker {
  private panels = new Map<string, PanelState>()
  private callbacks = new Map<string, ChangeCallback>()
  private previousVisitAt = 0
  private lastInteractionAt: number | null = null

  constructor() {
    this.loadReadState()
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.persistLastVisit())
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.persistLastVisit()
      })
    }
  }

  getPreviousVisitTime(): number {
    return this.previousVisitAt
  }

  private loadReadState(): void {
    try {
      const raw = localStorage.getItem(READ_STATE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<PersistedReadState>
      if (parsed?.lastVisitAt && Number.isFinite(parsed.lastVisitAt)) {
        this.previousVisitAt = parsed.lastVisitAt
      }
    } catch { /* ignore */ }
  }

  private persistLastVisit(): void {
    if (this.lastInteractionAt === null) return
    try {
      const state: PersistedReadState = { v: 1, lastVisitAt: this.lastInteractionAt }
      localStorage.setItem(READ_STATE_KEY, JSON.stringify(state))
    } catch { /* ignore */ }
  }

  register(panelId: string): void {
    if (!this.panels.has(panelId)) {
      this.panels.set(panelId, {
        seenIds: new Set(),
        firstSeenTime: new Map(),
        newCount: 0,
        lastInteraction: Date.now(),
      })
    }
  }

  updateItems(panelId: string, itemIds: string[]): string[] {
    this.register(panelId)
    const state = this.panels.get(panelId)!
    const now = Date.now()
    const newItems: string[] = []

    for (const id of itemIds) {
      if (!state.firstSeenTime.has(id)) {
        state.firstSeenTime.set(id, now)
      }
      if (!state.seenIds.has(id)) {
        newItems.push(id)
      }
    }

    state.newCount = newItems.length

    const callback = this.callbacks.get(panelId)
    if (callback) {
      callback(state.newCount)
    }

    const currentIds = new Set(itemIds)
    Array.from(state.firstSeenTime.keys()).forEach(id => {
      if (!currentIds.has(id)) {
        state.firstSeenTime.delete(id)
        state.seenIds.delete(id)
      }
    })

    return newItems
  }

  markAsSeen(panelId: string): void {
    const state = this.panels.get(panelId)
    if (!state) return

    Array.from(state.firstSeenTime.keys()).forEach(id => {
      state.seenIds.add(id)
    })

    state.newCount = 0
    state.lastInteraction = Date.now()
    this.lastInteractionAt = Date.now()
    this.persistLastVisit()

    const callback = this.callbacks.get(panelId)
    if (callback) callback(0)
  }

  markItemsSeen(panelId: string, itemIds: string[]): void {
    const state = this.panels.get(panelId)
    if (!state) return

    for (const id of itemIds) {
      state.seenIds.add(id)
    }

    let unseen = 0
    Array.from(state.firstSeenTime.keys()).forEach(id => {
      if (!state.seenIds.has(id)) unseen++
    })
    state.newCount = unseen

    const callback = this.callbacks.get(panelId)
    if (callback) callback(state.newCount)
  }

  getNewCount(panelId: string): number {
    return this.panels.get(panelId)?.newCount ?? 0
  }

  shouldShowNewBadge(panelId: string, itemId: string): boolean {
    const state = this.panels.get(panelId)
    if (!state) return false
    const firstSeen = state.firstSeenTime.get(itemId)
    if (!firstSeen) return false
    return Date.now() - firstSeen < NEW_TAG_DURATION_MS
  }

  shouldHighlight(panelId: string, itemId: string): boolean {
    const state = this.panels.get(panelId)
    if (!state) return false
    if (state.seenIds.has(itemId)) return false
    const firstSeen = state.firstSeenTime.get(itemId)
    if (!firstSeen) return false
    return Date.now() - firstSeen < HIGHLIGHT_DURATION_MS
  }

  onChange(panelId: string, callback: ChangeCallback): void {
    this.callbacks.set(panelId, callback)
  }

  unregister(panelId: string): void {
    this.callbacks.delete(panelId)
    this.panels.delete(panelId)
  }
}

export const activityTracker = new ActivityTracker()
