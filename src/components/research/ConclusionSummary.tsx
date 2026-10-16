'use client'

import type { Claim, ResearchState } from '@/types/research'

export default function ConclusionSummary({ state }: { state: ResearchState }) {
  const questions = Object.values(state.issues)
  const notices = Array.from(new Set(state.actions?.flatMap(action => action.retrieval_warnings?.map(warning => warning.reason) || []) || []))
  if (state.actions?.some(action => action.error_code === 'retrieval_unavailable')) notices.push('部分问题检索暂不可用。已保留其他研究结果，证据不足的问题单独标为待核查。')
  if (state.run_status === 'failed') notices.unshift('此任务未完成。下方展示已保存的阶段性结果，仍需补充核查；该记录保留在失败记录中。')
  function finding(claim: Claim, carried: boolean, pending: boolean) {
    const supported = !pending && (claim.verification_status || claim.status) === 'supported'
    return <div key={claim.id || claim.text} className="space-y-2">
      <span className={'inline-block rounded px-2 py-0.5 text-[11px] ' + (supported ? 'bg-accent-bg text-accent' : 'text-warning border border-edge')}>{supported ? carried ? '沿用 · 已核查' : '已核查' : '待核查'}</span>
      <p className="text-[14px] leading-7 text-ink whitespace-pre-wrap">{claim.text}</p>
      {claim.conditions && <p className="text-[11px] text-muted">适用条件：{claim.conditions}</p>}
      {!!claim.evidence_keys.length && <div className="text-[11px] text-muted flex flex-wrap gap-x-3 gap-y-1">{claim.evidence_keys.slice(0, 3).map((key, index) => {
        const fp = claim.evidence_fingerprints?.[key]
        const current = state.evidence[key]
        const source = fp ? state.evidence_versions?.[key]?.[fp] || (current?.fingerprint === fp ? current : undefined) : current
        return <a key={key} href={source?.url && /^https?:\/\//i.test(source.url) ? source.url : undefined} target="_blank" rel="noopener noreferrer" className="text-accent underline break-words">来源{index + 1}：{source?.title || key}</a>
      })}</div>}
      <details className="rounded border border-edge bg-sidebar px-3 py-2">
        <summary className="cursor-pointer text-accent text-[12px] font-medium">查看证据链 · {claim.evidence_keys.length}条来源</summary>
        <div className="mt-3 space-y-3 text-[12px]">
          <p className="text-ink-2"><b>核查结果：</b>{supported ? '现有资料支持该结论' : '尚不能确认'}。{claim.review?.reason || claim.uncertainty || '尚无有效核查说明'}</p>
          {!claim.evidence_keys.length && <p className="text-warning">尚未绑定有效来源，不能作为已确认结论。</p>}
          {claim.evidence_keys.map((key, index) => {
            const fingerprint = claim.evidence_fingerprints?.[key]
            const current = state.evidence[key]
            const source = fingerprint ? state.evidence_versions?.[key]?.[fingerprint] || (current?.fingerprint === fingerprint ? current : undefined) : current
            return <div key={key} className="border-l-2 border-accent pl-3 space-y-1">
              <p className="font-medium text-ink">来源{index + 1}：{source?.title || key}</p>
              {source?.url && /^https?:\/\//i.test(source.url) && <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-accent underline break-all">打开原始资料</a>}
              <p className="text-muted">资料时间：{source?.published_at || claim.source_times?.[key] || '未提供'}</p>
              <p className="text-muted text-[11px]">原文摘录</p>
              <blockquote className="max-h-52 overflow-y-auto whitespace-pre-wrap break-words text-ink-2 leading-6">{source?.content || '未保留该版本原文，请回查来源后核对。'}</blockquote>
            </div>
          })}
          {!!claim.contract_errors?.length && <p className="text-warning">仍需核对：{claim.contract_errors.join('；')}</p>}
        </div>
      </details>
    </div>
  }
  return <section aria-label="结论与证据链" className="m-3 rounded-lg border border-accent/60 bg-accent-bg p-4 space-y-4">
    <div className="flex justify-between items-center gap-2"><h2 className="text-[16px] font-semibold text-ink">结论与证据链</h2><span className="text-[10px] text-muted">模型辅助核查</span></div>
    {notices.slice(0, 3).map(notice => <p key={notice} className="text-[12px] leading-6 text-warning">{notice}</p>)}
    {questions.map(question => {
      const primary = question.claims.find(claim => (claim.verification_status || claim.status) === 'supported') || question.claims[0]
      const others = question.claims.filter(claim => claim !== primary)
      return <div key={question.id} className="space-y-3">
        {questions.length > 1 && <h3 className="text-[12px] font-semibold text-ink-2">{question.question}</h3>}
        {primary ? finding(primary, question.status === 'carried', question.status === 'pending') : <p className="text-warning text-[13px]">{question.pending_reason || '本次尚未形成可核查结论，需补充资料或增加研究次数。'}</p>}
        {!!others.length && <details className="text-[12px]"><summary className="cursor-pointer text-accent">其余{others.length}条结论与证据</summary><div className="mt-3 space-y-5">{others.map(claim => finding(claim, question.status === 'carried', question.status === 'pending'))}</div></details>}
      </div>
    })}
  </section>
}
