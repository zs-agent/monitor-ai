'use client'
import type { Ablation, SchedulerConfig } from '@/types/research-contracts'

const fields: [keyof Omit<SchedulerConfig, 'ablations'>, string][] = [
  ['alpha', '研究投入权重'], ['beta_verify', '核查优先程度'], ['beta_risk', '风险核查优先程度'],
  ['w0', '基础优先程度'], ['wn', '新资料重视程度'], ['wu', '未解决问题重视程度'], ['wc', '资料不足重视程度'], ['max_feedback_rounds', '最多补查轮次'],
]
const ablations: [Ablation, string][] = [['drop_n', '不考虑资料变化'], ['drop_u', '不考虑问题是否解决'], ['drop_c', '不考虑资料是否充足'], ['drop_t', '不额外优先核查风险'], ['equal_utility', '各问题同等优先']]
export default function ExperimentControls({ value, onChange, disabled }: { value: SchedulerConfig; onChange: (config: SchedulerConfig) => void; disabled: boolean }) {
  return <details className="rounded border border-edge p-2">
    <summary className="cursor-pointer font-semibold text-ink">高级实验设置</summary>
    <p className="mt-2 text-[10px] text-muted">通常保留默认值即可。这里可改变研究与核查的侧重点，用于比较不同安排的效果。</p>
    <div className="grid grid-cols-2 gap-2 mt-2">{fields.map(([key, label]) => <label key={key} className="text-[10px]">{label}<input aria-label={label} type="number" min={0} max={key === 'max_feedback_rounds' ? 8 : 1000} step={key === 'max_feedback_rounds' ? 1 : 0.5} value={value[key]} disabled={disabled} onChange={e => {
      const number = Number(e.target.value)
      if (Number.isFinite(number) && number >= 0) onChange({ ...value, [key]: key === 'max_feedback_rounds' ? Math.min(8, Math.floor(number)) : Math.min(1000, number) })
    }} className="w-full bg-elevated border border-edge rounded p-1 mt-1" /></label>)}</div>
    <fieldset disabled={disabled} className="mt-2 space-y-1"><legend className="text-[10px]">实验对照：忽略哪些判断依据</legend>{ablations.map(([key, label]) => <label key={key} className="flex gap-2 text-[10px]"><input type="checkbox" checked={value.ablations.includes(key)} onChange={e => onChange({ ...value, ablations: e.target.checked ? [...value.ablations, key] : value.ablations.filter(v => v !== key) })} />{label}</label>)}</fieldset>
  </details>
}
