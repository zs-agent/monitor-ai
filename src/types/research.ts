import type { TaskType, SchedulerConfig, ActionPackage, VerificationStatus, UpdateStatus, AgentRole, RunStatus, QuestionStatus } from './research-contracts'

export interface Claim {
  id?: string; text: string; status: VerificationStatus; evidence_keys: string[]; uncertainty?: string
  verification_status?: VerificationStatus; update_status?: UpdateStatus
  evidence_fingerprints?: Record<string, string>; rejected_sources?: string[]
  review?: { reason?: string; verdict?: string }; update_label?: string; contract_errors?: string[]
  conditions?: string; source_times?: Record<string, string>
  comparison?: { dimension: string; conditions: string; comparable: boolean; mismatch_reason?: string } | null
  versions?: { before: string; after: string; before_time: string; after_time: string } | null
  counter_evidence?: { text: string; evidence_keys: string[] }[] | null
}
export interface Issue {
  id: string; axis: string; question: string; status: QuestionStatus; revision: number; claims: Claim[]; task_type?: TaskType
  critical?: boolean
  pending_reason?: string
  features?: { t: string; n: number; u: number; c: number; priority: number; contributions?: Record<string, number> }
  history?: { revision: number; claims: Claim[] }[]
}
export interface Action { issue_id: string; kind: ActionPackage; cost: number; utility: number }
export interface Evidence {
  title: string; content: string; url?: string; key?: string; fingerprint: string; fetched_at?: number
  published_at?: string; retrieval_level?: string; summary?: string; link_available?: boolean | null
}
export interface ManualAssociation { evidence_key: string; object_name: string; question_ids: string[]; reason: string }
export interface HumanReview {
  question_id: string; claim_id: string; reviewer: string; verdict: 'supported' | 'contradicted' | 'insufficient'; score: number; notes: string; resolution: string
}
export interface Metric { numerator: number; denominator: number; value: number | null; basis: string }
export interface Consumption { embedding?: { calls: number; input_tokens: number | null; elapsed_sec: number }; model_calls?: number; search_batches?: number; retriever_calls?: number; pages_requested?: number; input_tokens?: number | null; output_tokens?: number | null; elapsed_sec?: number; usage_available?: boolean }
export interface Evaluation {
  key_question_coverage: Metric; citation_coverage: Metric; link_availability: Metric; content_support: Metric
  manual_stale_retention?: Metric; unjustified_stable_change?: Metric; verified_update_coverage?: Metric
  update_coverage: Metric; stale_retention: Metric; human_support: Metric; sampled_claims: number; disagreements: number; consumption: Consumption
}
export interface ResearchState {
  current_role?: AgentRole; run_status?: RunStatus
  focus: string; task_type: TaskType; time_scope?: string; data_mode?: string; remaining_budget?: number
  association_config?: Record<string, unknown>
  association_mode?: string; scheduler_config?: SchedulerConfig; consumption?: Consumption; evaluation?: Evaluation; human_reviews?: HumanReview[]
  association?: {
    raw_count: number; unique_count: number
    cleaning: { key?: string; title?: string; original_url?: string; normalized_url?: string; reason: string }[]
    matches: { key: string; title: string; score: number; reason: string; question_ids: string[]; fingerprint?: string; matched_terms?: string[]; dimension_hits?: Record<string, string[]>; dimension_scores?: Record<string, number>; dimension_semantic_scores?: Record<string, number>; duplicate_of?: string | null; manual?: ManualAssociation | null }[]
  }
  issues: Record<string, Issue>; evidence: Record<string, Evidence>; signal_evidence?: Record<string, Evidence>
  evidence_versions?: Record<string, Record<string, Evidence>>; delta: Record<string, string[]>
  affected: string[]; impact_reasons: Record<string, string[]>
  allocation?: { budget_units: number; initial_budget?: number; reserve_units?: number; reserved_units: number; spent_units?: number; proxy_utility: number; selected: Action[]; candidates?: Record<string, Action[]>; deferred?: string[]; defer_reasons?: Record<string, string> }
  dependency_graph?: { Q: string[]; E: string[]; C: Record<string, Claim>; R: { kind: string; source: string; target: string }[] }
  actions?: { issue_id: string; kind: string; outcome: string; elapsed_sec?: number; input_tokens?: number | null; output_tokens?: number | null; feedback?: boolean; model_calls?: number; search_batches?: number; error?: string; error_code?: string; associated_sources?: string[]; retrieval_warnings?: { code: string; reason: string }[] }[]
}
