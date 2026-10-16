'use client'
import type { ResearchState } from '@/types/research'

export default function AgentFlow({ state }: { state: ResearchState }) {
  const actions = state.actions || []
  const roles = [
    ['规划', '需求 → 对象、时间、任务类型与问题', 'planner'],
    ['研究', '问题与实际资料 → 结构化结论', 'researcher'],
    ['审核', '来源键硬校验 → 支持 / 矛盾 / 不足', 'verifier'],
    ['整合', '研究与审核产物 → 带待核查项的报告', 'integrator'],
  ]
  const current = state.current_role
  return <div className="space-y-2" aria-label="四类智能体状态图">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">{roles.map(([label, contract, role], i) => <div key={role} className={`rounded border p-2 ${current === role ? 'border-accent bg-accent-bg' : 'border-edge'}`}><div className="font-semibold">{i + 1} · {label}{i < 3 ? ' →' : ''}</div><p className="text-[10px] text-muted mt-1">{contract}</p></div>)}</div>
    <div className="border border-dashed border-accent rounded p-2 text-accent">审核 ↶ 研究 / 再次核查 · 先保留已选动作预算 · 剩余 {state.remaining_budget ?? Math.max(0, (state.allocation?.budget_units || 0) - (state.allocation?.spent_units || 0))} 单位 · 已执行反馈 {actions.filter(a => a.feedback).length} 动作</div>
    <p className="text-muted text-[10px]">共享状态：Q {Object.keys(state.issues).length} · E {Object.keys(state.evidence).length} · C {Object.keys(state.dependency_graph?.C || {}).length} · 已记录审核 {Object.values(state.issues).flatMap(q => q.claims).filter(c => c.review).length}。规划与整合为确定性节点，研究与审核调用配置模型。</p>
  </div>
}
