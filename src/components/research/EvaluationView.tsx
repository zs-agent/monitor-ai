'use client'
import { useEffect, useRef, useState } from 'react'
import type { Evaluation, HumanReview, Metric, ResearchState } from '@/types/research'

const metrics: [keyof Pick<Evaluation, 'key_question_coverage' | 'citation_coverage' | 'link_availability' | 'content_support' | 'update_coverage' | 'stale_retention'>, string][] = [
  ['key_question_coverage', '问题回答比例'], ['citation_coverage', '结论附来源比例'], ['link_availability', '来源链接可访问比例'],
  ['content_support', '结论获证据支持比例'], ['update_coverage', '该更新的问题已处理比例'], ['stale_retention', '过时结论仍被沿用比例'],
]
function value(metric?: Metric) { return metric?.value == null ? '未测量 / 无标注' : `${(metric.value * 100).toFixed(1)}% (${metric.numerator}/${metric.denominator})` }
interface Experiment { task_id: string; strategy?: string; status: string; spent_units?: number; scheduler_config?: { alpha?: number; beta_verify?: number; ablations?: string[] }; evaluation?: Evaluation }

export default function EvaluationView({ state, taskId, comparisons = [] }: { state: ResearchState; taskId?: string; comparisons?: { label: string; state: ResearchState }[] }) {
  const [evaluation, setEvaluation] = useState(state.evaluation)
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [reviewing, setReviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<HumanReview>({ question_id: '', claim_id: '', reviewer: '', verdict: 'insufficient', score: 0, notes: '', resolution: '' })
  const reviewerRef = useRef<HTMLInputElement>(null)
  useEffect(() => { setEvaluation(state.evaluation) }, [state.evaluation])
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/research/experiments', { signal: controller.signal }).then(async r => {
      if (!r.ok) throw new Error(`实验记录 HTTP ${r.status}`)
      const response = await r.json()
      if (!controller.signal.aborted) setExperiments(response.items || [])
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e)) })
    return () => controller.abort()
  }, [])
  useEffect(() => { if (reviewing) reviewerRef.current?.focus() }, [reviewing])
  const samples = Object.values(state.issues).flatMap(q => q.claims.filter(c => c.id).map(c => ({ question: q, claim: c })))
  const selectedClaim = samples.find(row => row.claim.id === form.claim_id)?.claim
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!taskId || saving) return
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/research/history/${taskId}/reviews`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form), signal: AbortSignal.timeout(15000) })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `保存失败 HTTP ${response.status}`)
      setEvaluation(data.evaluation); setReviewing(false)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setSaving(false) }
  }
  return <div className="space-y-3">
    <p className="text-muted">指标显示分子与分母。模型辅助内容支持不等于客观准确率；无人工标注的指标保留未知。</p>
    {state.data_mode === 'synthetic_demo' && <p className="text-warning">合成教学样例：以下是规则执行结果，不代表真实模型质量；示例链接未进行联网可用性检查。</p>}
    <div className="grid grid-cols-2 gap-2">{metrics.map(([key, label]) => <div key={key} className="rounded border border-edge p-3" title={evaluation?.[key]?.basis}><div className="text-muted">{label}</div><div className="text-ink font-semibold mt-1">{value(evaluation?.[key])}</div><p className="text-[10px] text-muted mt-1">{evaluation?.[key]?.basis}</p></div>)}</div>
    <div className="rounded border border-edge p-3 space-y-1"><b>实际用了多少资源</b><p>研究与核查 {state.allocation?.spent_units ?? 0} / {state.allocation?.budget_units ?? 0} 次 · 模型调用 {state.consumption?.model_calls ?? '未知'} 次</p><p>检索服务调用 {state.consumption?.retriever_calls ?? '未知'} 次 · 查找批次 {state.consumption?.search_batches ?? '未知'} · 请求解析 {state.consumption?.pages_requested ?? '未知'} 页</p><p>Token {state.consumption?.input_tokens == null ? '未知（供应方未返回用量）' : `${state.consumption.input_tokens} 入 / ${state.consumption.output_tokens ?? 0} 出`} · 耗时 {state.consumption?.elapsed_sec ?? '未知'}s</p></div>
    {!!comparisons.length && <div className="overflow-x-auto"><table className="w-full text-left"><caption className="text-left font-semibold pb-2">两个版本的处理结果</caption><thead><tr><th>快照</th><th>关键问题</th><th>更新覆盖</th><th>动作</th></tr></thead><tbody>{comparisons.map(row => <tr key={row.label} className="border-t border-edge"><td className="py-2">{row.label}</td><td>{value(row.state.evaluation?.key_question_coverage)}</td><td>{value(row.state.evaluation?.update_coverage)}</td><td>{row.state.allocation?.spent_units ?? 0}</td></tr>)}</tbody></table></div>}
    <details><summary className="text-accent cursor-pointer">真实对照与消融运行记录（{experiments.length}）</summary><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>任务/策略</th><th>α / β</th><th>消融</th><th>动作</th></tr></thead><tbody>{experiments.map(row => <tr key={row.task_id} className="border-t border-edge"><td className="py-2">{row.task_id.slice(-8)} · {row.strategy} · {row.status}</td><td>{row.scheduler_config?.alpha ?? '旧版'} / {row.scheduler_config?.beta_verify ?? '旧版'}</td><td>{row.scheduler_config?.ablations?.join(', ') || '无'}</td><td>{row.spent_units ?? 0}</td></tr>)}</tbody></table></div></details>
    <div className="flex justify-between flex-wrap gap-2"><span>人工核查 {evaluation?.sampled_claims ?? 0} 条结论 · 分歧 {evaluation?.disagreements ?? 0} 项</span><button disabled={!taskId || !samples.length} onClick={() => { const first = samples[0]; if (first) setForm(f => ({ ...f, question_id: first.question.id, claim_id: first.claim.id! })); setReviewing(true) }} className="border border-accent text-accent rounded px-3 py-2 disabled:opacity-40">人工抽样评阅</button></div>
    {error && <p role="alert" className="text-warning">{error}</p>}
    {reviewing && <div role="dialog" aria-modal="true" aria-label="人工抽样评阅" onKeyDown={e => { if (e.key === 'Escape' && !saving) setReviewing(false) }} className="fixed inset-y-0 right-0 z-[100] w-full max-w-lg bg-sidebar border-l border-edge p-5 shadow-2xl overflow-y-auto">
      <form onSubmit={save} className="space-y-4"><div className="flex justify-between"><h2 className="text-lg font-semibold">人工抽样评阅</h2><button type="button" disabled={saving} onClick={() => setReviewing(false)} aria-label="关闭评阅">关闭</button></div>
        <label className="block">评阅者<input ref={reviewerRef} required value={form.reviewer} maxLength={100} onChange={e => setForm({ ...form, reviewer: e.target.value })} className="block mt-1 w-full bg-elevated rounded border border-edge p-2" /></label>
        <label className="block">抽样结论<select value={form.claim_id} onChange={e => { const selected = samples.find(row => row.claim.id === e.target.value); if (selected) setForm({ ...form, claim_id: selected.claim.id!, question_id: selected.question.id }) }} className="block w-full mt-1 bg-elevated rounded border border-edge p-2">{samples.map(row => <option key={row.claim.id} value={row.claim.id}>{row.question.question}：{row.claim.text.slice(0, 70)}</option>)}</select></label>
        <p className="rounded border border-edge p-2">{selectedClaim?.text}</p>
        {selectedClaim?.review?.reason && <p className="text-muted">已有核查记录：{selectedClaim.review.reason}</p>}
        {selectedClaim?.evidence_keys.map(key => {
          const fingerprint = selectedClaim.evidence_fingerprints?.[key]
          const current = state.evidence[key]
          const source = fingerprint ? state.evidence_versions?.[key]?.[fingerprint] || (current?.fingerprint === fingerprint ? current : undefined) : current
          return <details key={key} className="rounded border border-edge p-2"><summary className="cursor-pointer text-accent">查看证据：{source?.title || key}</summary><p className="text-muted mt-2">资料时间：{source?.published_at || '未提供'} · 指纹 {fingerprint?.slice(0, 16) || source?.fingerprint.slice(0, 16)}</p><p className="whitespace-pre-wrap mt-2">{source?.content.slice(0, 4000) || '原版本原文不可用，请回查来源后评阅'}</p>{source?.url && /^https?:\/\//.test(source.url) && <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-accent break-all">打开原始来源</a>}</details>
        })}
        <label className="block">核查判定<select value={form.verdict} onChange={e => setForm({ ...form, verdict: e.target.value as HumanReview['verdict'] })} className="block bg-elevated border border-edge rounded p-2 mt-1"><option value="supported">支持</option><option value="contradicted">矛盾</option><option value="insufficient">依据不足</option></select></label>
        <label className="block">评阅得分（0—5）<input type="number" min={0} max={5} required value={form.score} onChange={e => setForm({ ...form, score: Number(e.target.value) })} className="ml-2 w-20 bg-elevated rounded border border-edge p-2" /></label>
        <label className="block">核查依据<textarea value={form.notes} maxLength={2000} onChange={e => setForm({ ...form, notes: e.target.value })} className="block w-full bg-elevated rounded border border-edge mt-1 p-2" /></label>
        <label className="block">分歧处理说明<textarea value={form.resolution} maxLength={2000} onChange={e => setForm({ ...form, resolution: e.target.value })} className="block w-full bg-elevated rounded border border-edge mt-1 p-2" /></label>
        {error && <p role="alert" className="text-warning">{error}</p>}
        <button disabled={saving || !form.reviewer.trim()} className="rounded bg-accent text-black p-3 disabled:opacity-40">{saving ? '保存中…' : '保存评阅与分歧记录'}</button>
      </form>
    </div>}
  </div>
}
