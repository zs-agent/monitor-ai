const SPANS_KEY = 'monitor-ai-panel-spans'
const COLLAPSED_KEY = 'monitor-ai-panel-collapsed'

export function loadPanelSpans(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SPANS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function savePanelSpan(panelId: string, span: number): void {
  try {
    const spans = loadPanelSpans()
    spans[panelId] = span
    localStorage.setItem(SPANS_KEY, JSON.stringify(spans))
  } catch { /* ignore */ }
}

export function loadPanelCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function savePanelCollapsed(panelId: string, collapsed: boolean): void {
  try {
    const map = loadPanelCollapsed()
    if (collapsed) map[panelId] = true
    else delete map[panelId]
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(map))
  } catch { /* ignore */ }
}
