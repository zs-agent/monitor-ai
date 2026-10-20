'use client'

import { useState } from 'react'
import DependencyGraph from './DependencyGraph'
import AgentFlow from './AgentFlow'
import EvaluationView from './EvaluationView'
import type { ManualAssociation, ResearchState as V2ResearchState } from '@/types/research'

export type ResearchState = V2ResearchState

const actionLabel: Record<string, string> = { defer: '暂缓', research: '仅研究', research_review: '研究 + 核查', research_and_verify: '研究 + 核查' }
const statusLabel: Record<string, string> = { supported: '支持', contradicted: '有矛盾', insufficient: '依据不足', pending_verification: '待核查', pending: '待核查', retained: '沿用', revised: '已修订' }
const reasonLabel: Record<string, string> = { object_mismatch: '对象不一致', version_unconfirmed: '版本待确认', version_mismatch: '版本不一致', full_recheck_policy: '对照策略要求全量复核', conflicting_version: '同来源版本冲突 · 待复核', association_policy_changed: '关联策略改变', matched: '已挂载', duplicate_url: 'URL重复', duplicate_content: '内容转载', low_similarity: '低相关', dimension_unmatched: '维度未匹配', accepted: '保留', related_signal_changed: '关联线索变化', dependency_requires_recheck: '依赖变化 / 缺失', previously_unresolved: '尚未解决', no_previous_analysis: '缺历史结论', time_scope_changed: '时间范围改变' }
const axes: Record<string, string> = { identity: '版本事实', capability: '能力', deployment: '部署', ecosystem: '生态', risk: '风险' }
const tabs = ['资料关联', '分析安排', '版本对比', '效果与评阅']

export default function MechanismView({ state, preview = false, taskId, onCorrect, onCritical, comparisons = [] }: { state: ResearchState; preview?: boolean; taskId?: string; onCorrect?: (value: ManualAssociation) => Promise<void>; onCritical?: (id: string, critical: boolean) => Promise<void>; comparisons?: { label: string; state: ResearchState }[] }) {
  const [tab, setTab] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [focusedEvidence, setFocusedEvidence] = useState<string | null>(null)
  const [correction, setCorrection] = useState<ManualAssociation | null>(null)
  const [correcting, setCorrecting] = useState(false)
  const [correctionError, setCorrectionError] = useState('')
  const issues = Object.values(state.issues)
  const allocation = state.allocation
  const association = state.association
  const selected = chosen ? state.issues[chosen] : null
  const graphIssue = selected || issues[0]
  const graphClaims = graphIssue?.claims.slice(0, 4).map((c, i) => ({ id: c.id || `${graphIssue.id}-${i}`, label: c.text })) || []
  const graphEvidence = Array.from(new Set(graphIssue?.claims.flatMap(c => c.evidence_keys) || [])).slice(0, 12).map(id => ({ id, label: state.evidence[id]?.title || id }))
  const focused = focusedEvidence ? state.evidence[focusedEvidence] : null
  return <section aria-label="研究过程" className="m-3 rounded-lg border border-edge bg-sidebar text-[12px] min-w-0">
    <div className="px-3 py-3 border-b border-edge flex flex-wrap justify-between gap-2">
      <strong className="text-ink">研究过程 {preview && <span className="text-muted font-normal">· 执行前预览</span>}</strong>
      <span className="text-muted">{issues.length} 个问题 · {state.affected.length} 个待复核</span>
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 px-3 pt-3" role="tablist" aria-label="四大研究视图">
      {tabs.map((name, i) => <button key={name} role="tab" aria-selected={tab === i} onClick={() => setTab(i)} className={`px-3 py-2 rounded ${tab === i ? 'bg-accent text-white' : 'text-muted hover:bg-overlay'}`}>{i + 1} · {name}</button>)}
    </div>
    <div className="p-3 space-y-3 max-h-[660px] overflow-auto" role="tabpanel">
      {tab === 0 && <>
        <p className="text-muted">合并重复资料，再判断资料与研究对象、分析问题的关系。归属不对时可手动校正。</p>
        <div className="grid grid-cols-3 gap-2">
          {[['原始线索', association?.raw_count ?? 0], ['规范来源', association?.unique_count ?? 0], ['问题挂载', association?.matches.filter(m => m.question_ids.length).length ?? 0]].map(([name, count]) => <div key={name} className="rounded border border-edge p-3"><div className="text-muted">{name}</div><div className="text-xl font-semibold text-ink">{count}</div></div>)}
        </div>
        <p className="text-muted">关联策略：{state.association_mode || 'structured'}。评分与命中词项仅表示相关性，重复转载不计为独立证据。</p>
        {association?.matches.map(m => <div key={m.key} className="border border-edge rounded p-2 space-y-1">
          <div className="flex gap-2 justify-between"><span className="break-words">{m.title || m.key}</span><span className="shrink-0 font-mono text-accent">相关度 {m.score.toFixed(3)}</span></div>
          <div className="text-muted">{reasonLabel[m.reason] || m.reason} {m.question_ids.map(q => <button key={q} onClick={() => { setChosen(q); setTab(2) }} className="ml-2 text-accent underline">{axes[state.issues[q]?.axis] || q}</button>)}</div>
          <p className="text-[10px] text-muted break-all">指纹 {m.fingerprint?.slice(0, 24)} · 命中词项：{m.matched_terms?.join('、') || '无'}</p>
          <p className="text-[10px] text-muted">维度命中：{Object.entries(m.dimension_hits || {}).filter(([, values]) => values.length).map(([qid, values]) => `${axes[state.issues[qid]?.axis] || qid}(${values.join('、')})`).join('；') || '无'}</p>
          {m.dimension_scores && <p className="text-[10px] text-muted">问题方向得分：{Object.entries(m.dimension_scores).map(([id, score]) => (axes[state.issues[id]?.axis] || id) + ' ' + score.toFixed(2)).join('；')}</p>}
          {m.manual && <p className="text-accent text-[10px]">人工校正：{m.manual.object_name} · {m.manual.reason}</p>}
          {onCorrect && !m.duplicate_of && <button className="border border-edge rounded px-2 py-1 text-accent" onClick={() => { setCorrection({ evidence_key: m.key, object_name: state.focus, question_ids: m.question_ids, reason: '' }); setCorrectionError('') }}>校正归属</button>}
        </div>)}
        {correction && <form aria-label="人工关联校正" className="border border-accent rounded p-3 space-y-2" onSubmit={async event => {
          event.preventDefault(); if (!onCorrect || correcting) return
          setCorrecting(true); setCorrectionError('')
          try { await onCorrect(correction); setCorrection(null) } catch (error) { setCorrectionError(error instanceof Error ? error.message : String(error)) } finally { setCorrecting(false) }
        }}>
          <b>人工关联校正</b><p className="text-muted break-all">{correction.evidence_key}</p>
          <label className="block">归属对象<input aria-label="归属对象" value={correction.object_name} required onChange={e => setCorrection({ ...correction, object_name: e.target.value, question_ids: e.target.value === state.focus ? correction.question_ids : [] })} className="ml-2 bg-elevated border border-edge rounded p-1" /></label>
          <p className="text-muted text-[10px]">归属其他对象时，从当前对象的问题中移除；历史报告保留，校正用于下一次预览与研究。</p>
          {issues.map(q => <label key={q.id} className="flex gap-2"><input type="checkbox" disabled={correction.object_name !== state.focus} checked={correction.question_ids.includes(q.id)} onChange={e => setCorrection({ ...correction, question_ids: e.target.checked ? [...correction.question_ids, q.id] : correction.question_ids.filter(id => id !== q.id) })} />{q.question}</label>)}
          <label className="block">校正理由<input aria-label="校正理由" required maxLength={1000} value={correction.reason} onChange={e => setCorrection({ ...correction, reason: e.target.value })} className="block w-full bg-elevated border border-edge rounded p-1 mt-1" /></label>
          {correctionError && <p role="alert" className="text-warning">{correctionError}</p>}
          <button disabled={correcting} className="border border-accent rounded px-3 py-2 text-accent">{correcting ? '保存中…' : '保存并重新预览'}</button><button type="button" disabled={correcting} className="ml-3 text-muted" onClick={() => setCorrection(null)}>取消</button>
        </form>}
        <details><summary className="cursor-pointer text-accent">展开规范化及过滤记录</summary>{association?.cleaning.map((c, i) => <div key={i} className="py-2 border-b border-edge break-all"><b>{reasonLabel[c.reason] || c.reason}</b> · {c.title}<div className="text-muted">{c.original_url || '无URL'} → {c.normalized_url || '来源ID'}</div></div>)}</details>
      </>}
      {tab === 1 && <>
        <AgentFlow state={state} />
        <p className="text-muted">优先处理资料有变化、尚未解决或资料不足的问题。次数不够时会保留“待核查”。</p><details><summary className="cursor-pointer text-muted">查看计算规则</summary><p className="text-muted">p=w₀+wₙn+wᵤu+w꜀I(c&lt;1)。α={state.scheduler_config?.alpha ?? 4}；配置={state.scheduler_config?.utility_profile || 'legacy_v2'}；事实/比较/变化/风险核查偏好={state.scheduler_config?.beta_fact ?? 2}/{state.scheduler_config?.beta_comparison ?? 4}/{state.scheduler_config?.beta_dynamic ?? 4}/{state.scheduler_config?.beta_risk_v3 ?? 8}；补查预留={state.allocation?.reserve_units ?? 0}次。</p></details>
        <div className="flex justify-between"><b>已用次数 {allocation?.spent_units ?? 0} / {allocation?.budget_units ?? 0}</b><span className="text-muted">已安排 {allocation?.reserved_units ?? 0} 次</span></div>
        <progress aria-label="动作预算消耗" className="w-full accent-[var(--accent)]" value={allocation?.spent_units ?? 0} max={Math.max(1, allocation?.budget_units ?? 1)} />
        {issues.map(q => {
          const pick = allocation?.selected.find(a => a.issue_id === q.id)
          const f = q.features
          return <div key={q.id} className="border border-edge rounded p-3 space-y-2">
            {onCritical && (q.task_type === 'risk_assessment' || q.task_type === 'object_comparison') && <label className="flex gap-2 text-muted"><input type="checkbox" checked={q.critical || false} disabled={correcting} onChange={async e => { setCorrecting(true); setCorrectionError(''); try { await onCritical(q.id, e.target.checked) } catch (error) { setCorrectionError(error instanceof Error ? error.message : '修改失败') } finally { setCorrecting(false) } }} />重点核查：次数不足时暂缓，不只给草稿</label>}
            {correctionError && <p role="alert" className="text-red-500">{correctionError}</p>}

            <div className="flex justify-between gap-2"><b>{q.question}</b><span className="shrink-0 text-accent">{q.status === 'carried' ? '稳定沿用 · 0动作' : actionLabel[pick?.kind || 'defer']}</span></div>
            <p className="text-muted">新资料：{f?.n ? "有" : "无"} · 问题：{f?.u ? "未解决" : "已有结论"} · 资料覆盖：{f ? `${Math.round(f.c * 100)}%` : "未知"} · 优先程度：{f?.priority ?? "—"}</p>
            {f?.contributions && <details><summary className="cursor-pointer text-muted text-[10px]">优先程度怎么算</summary><p className="text-muted">p = {Object.values(f.contributions).join(" + ")} = {f.priority}；任务类型 {q.task_type || state.task_type}</p></details>}
            {!pick && allocation?.defer_reasons?.[q.id] && <p className="text-warning">{allocation.defer_reasons[q.id]}</p>}
            {!!allocation?.candidates?.[q.id]?.length && <details><summary className="cursor-pointer text-muted text-[10px]">查看备选安排与评分</summary><div className="flex flex-wrap gap-2 mt-2">{allocation.candidates[q.id].map(a => <span key={a.kind} className={`border rounded p-1 ${pick?.kind === a.kind ? 'border-accent text-accent' : 'border-edge text-muted'}`}>{actionLabel[a.kind]} · 次数 {a.cost} / 评分 {a.utility}</span>)}</div></details>}
          </div>
        })}
        <details><summary className="text-accent cursor-pointer">实际动作开销与异常记录</summary>{state.actions?.map((a, i) => <p key={i} className="py-2 break-all">{a.kind === 'research' ? '研究' : a.kind === 'review' ? '核查' : a.kind} · {{ completed: '完成', no_evidence: '资料不足，待核查', failed: '失败', cancelled: '已取消', skipped_no_new_claims: '无新结论，跳过' }[a.outcome] || a.outcome} · {a.elapsed_sec ?? 0}s · Token {a.input_tokens == null ? '未知' : `${a.input_tokens}入/${a.output_tokens}出`}{a.retrieval_warnings?.map((warning, j) => <span key={j} className="block text-warning mt-1">{warning.reason}</span>)}{a.error && <span className="block text-warning mt-1">失败原因：{a.error.replace(/^\w*Error:\s*/, '')}</span>}</p>)}</details>
      </>}
      {tab === 2 && <>
        <div className="grid grid-cols-2 gap-2">{[['added', '新增'], ['changed', '内容变化'], ['absent_from_snapshot', '本次缺失 · 待核查'], ['stable', '稳定']].map(([key, label]) => <details key={key} className="border border-edge rounded p-2"><summary className="cursor-pointer">{label} · {state.delta[key]?.length ?? 0}</summary>{state.delta[key]?.map(e => <div key={e} className="mt-2 break-all text-muted">{state.evidence[e]?.title || e}<div className="font-mono text-[10px]">{state.evidence[e]?.fingerprint?.slice(0, 20)}</div></div>)}</details>)}</div>
        <p className="text-muted">问题与证据关系：{state.dependency_graph?.Q.length ?? issues.length} 问题 / {state.dependency_graph?.E.length ?? 0} 资料 / {Object.keys(state.dependency_graph?.C || {}).length} 结论 / {state.dependency_graph?.R.length ?? 0} 关联。快照缺失不等于事实失效。</p>
        {graphIssue && <DependencyGraph question={{ id: graphIssue.id, label: graphIssue.question }} claims={graphClaims} evidence={graphEvidence} edges={state.dependency_graph?.R || []} onEvidence={setFocusedEvidence} />}
        <p className="text-muted text-[10px]">图中展示当前问题的前 4 条结论及最多 12 个来源；下方可切换问题、展开完整结论与旧版记录。</p>
        {focused && <div className="border border-accent rounded p-2"><b>{focused.title}</b><div className="text-muted break-all">{focused.url} · {focused.fingerprint.slice(0, 20)}</div><p className="whitespace-pre-wrap">{focused.content.slice(0, 2400)}</p><button className="text-accent mt-2" onClick={() => setFocusedEvidence(null)}>收起来源</button></div>}
        <div className="space-y-2">{issues.map(q => <button key={q.id} onClick={() => setChosen(q.id)} aria-pressed={chosen === q.id} className={`w-full text-left rounded border p-2 ${chosen === q.id ? 'border-accent' : 'border-edge'}`}>
          <span className={q.status === 'carried' ? 'text-accent' : 'text-warning'}>{q.status === 'carried' ? '🟢 稳定沿用 · 0动作' : state.affected.includes(q.id) ? '🟡 局部唤醒复核' : '待判定'}</span><div>{q.question}</div><div className="text-muted text-[10px]">{state.impact_reasons[q.id]?.map(r => reasonLabel[r] || r).join('；')}</div>
        </button>)}</div>
        {selected && <div className="border border-accent rounded p-3 space-y-3">
          <b>{selected.question} · 修订 v{selected.revision}</b>
          <div className="text-muted font-mono">Q {selected.id} → C → E</div>
          {!selected.claims.length && <p className="text-warning">{selected.pending_reason || '尚未形成结论，本次预算可能暂缓。'}</p>}
          {selected.claims.map((c, index) => <details key={c.id || index} className="border border-edge rounded p-2">
            <summary className="cursor-pointer">{selected.status === 'carried' ? '🟢 沿用' : c.status === 'supported' ? c.update_label === 'new' ? '🟡 新增 / 已核查' : '🟡 局部修订 / 已核查' : '🔴 待核查 / 依据不足'} · {c.text}</summary>
            <p className="mt-2 text-muted">核查：{statusLabel[c.verification_status || c.status] || '待核查'} · 更新：{statusLabel[c.update_status || 'pending']} · {c.review?.reason || c.uncertainty || '尚未完成审核'}</p>
            {!!c.contract_errors?.length && <p className="text-warning">契约检查：{c.contract_errors.join('；')}</p>}
            {c.conditions && <p className="text-muted">适用条件：{c.conditions}</p>}
            {c.versions && <p className="text-muted">{c.versions.before} ({c.versions.before_time}) → {c.versions.after} ({c.versions.after_time})</p>}
            {c.comparison && <p className="text-muted">{c.comparison.dimension} · {c.comparison.conditions} · {c.comparison.comparable ? '相同条件下可比' : `不可直接比较：${c.comparison.mismatch_reason}`}</p>}
            {c.counter_evidence?.map((entry, i) => <p key={i} className="text-muted">反例记录：{entry.text}</p>)}
            {!!c.rejected_sources?.length && <p className="text-warning">拒绝绑定未取得的来源：{c.rejected_sources.join('，')}</p>}
            {c.evidence_keys.map(key => { const fingerprint = c.evidence_fingerprints?.[key]; const current = state.evidence[key]; const e = fingerprint ? state.evidence_versions?.[key]?.[fingerprint] || (current?.fingerprint === fingerprint ? current : undefined) : current; return <div key={key} className="mt-2 border-l-2 border-accent pl-2"><a href={e?.url && /^https?:\/\//.test(e.url) ? e.url : undefined} target="_blank" rel="noopener noreferrer" className="text-accent break-all">{e?.title || key}</a><div className="text-muted text-[10px]">E {key} · {e?.retrieval_level || '资料'} · 指纹 {e?.fingerprint.slice(0, 12)} · {e?.fetched_at ? new Date(e.fetched_at * 1000).toLocaleString() : '抓取时间未记录'}</div><p className="whitespace-pre-wrap break-words">{e?.content?.slice(0, 2400) || '原文不可用'}</p></div> })}
          </details>)}
          {!!selected.history?.length && <details><summary className="cursor-pointer text-accent">对比旧版结论</summary>{selected.history.map((h, i) => <div key={i} className="mt-2 text-muted">v{h.revision}{h.claims.map((c, j) => <p key={j}>{c.text} [{c.status}]</p>)}</div>)}</details>}
        </div>}
      </>}
      {tab === 3 && <EvaluationView key={taskId || 'preview'} state={state} taskId={taskId} comparisons={comparisons} />}
    </div>
  </section>
}
