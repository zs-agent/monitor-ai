export interface SavedBrowseView {
  id: string
  name: string
  dimension: 'signals' | 'vendors' | 'models'
  category: string
  languageFilter: 'all' | 'zh' | 'en'
  activeTags: string[]
  signalSort: 'time' | 'importance' | 'credibility'
  vendorDays: number
  drillQuery?: string
  includeReferences?: boolean
}
export function validBrowseViews(value: unknown): value is SavedBrowseView[] {
  if (!Array.isArray(value) || value.length > 6) return false
  return value.every(v => v && typeof v.id === 'string' && typeof v.name === 'string' &&
    ['signals','vendors','models'].includes(v.dimension) &&
    ['all','models','products','industry','papers','tips'].includes(v.category) &&
    ['all','zh','en'].includes(v.languageFilter) &&
    Array.isArray(v.activeTags) && v.activeTags.every((t: unknown) => typeof t === 'string') &&
    ['time','importance','credibility'].includes(v.signalSort) && [7,30].includes(v.vendorDays) &&
    (v.drillQuery === undefined || typeof v.drillQuery === 'string') &&
    (v.includeReferences === undefined || typeof v.includeReferences === 'boolean'))
}
