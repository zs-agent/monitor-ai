export type IndexKind = 'papers' | 'models' | 'projects'
export interface PublicIndexTotal {
  kind: IndexKind
  source: string
  url: string
  scope: string
  count: number | null
  observedAt: string | null
  approximate: boolean
  status: 'fresh' | 'stale' | 'unavailable'
}
export interface CoverageResponse { totals: PublicIndexTotal[]; checkedAt: string }
