'use client'

import { useMemo } from 'react'
import { type Locale } from '@/lib/i18n'
import { AI_INFRA, type AIInfra } from '@/data/ai-infra'
import PanelBase from './PanelBase'

const TYPE_LABELS: Record<AIInfra['type'], [en: string, zh: string]> = {
  datacenter: ['DC', '数据中心'],
  supercomputer: ['Super', '超算'],
  cluster: ['Cluster', '集群'],
}

const STATUS_COLOR: Record<AIInfra['status'], string> = {
  operational: 'bg-emerald-400',
  building: 'bg-amber-400',
  planned: 'bg-slate-400',
}

const STATUS_LABELS: Record<AIInfra['status'], [en: string, zh: string]> = {
  operational: ['Operational', '运营中'],
  building: ['Building', '建设中'],
  planned: ['Planned', '规划中'],
}

function formatGPUCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  return `${(n / 1_000).toFixed(0)}K`
}

export default function InfrastructurePanel({ locale }: { locale: Locale }) {
  const sorted = useMemo(() => {
    return [...AI_INFRA].sort((a, b) => b.gpuCount - a.gpuCount)
  }, [])

  const totals = useMemo(() => {
    let gpus = 0
    let power = 0
    for (const item of sorted) {
      gpus += item.gpuCount
      power += item.powerMW
    }
    return { gpus, power }
  }, [sorted])

  return (
    <PanelBase
      id="infrastructure"
      title={locale === 'zh' ? 'AI 基础设施' : 'AI Infrastructure'}
      dataBadge="static"
      collapsible
    >
      <div className="overflow-y-auto">
        <div className="px-3 py-1.5 text-[9px] text-muted uppercase tracking-[0.08em] border-b border-edge">
          {locale === 'zh' ? `共 ${sorted.length} 个项目` : `${sorted.length} facilities`}
        </div>
        {sorted.map((item) => {
          const name = locale === 'zh' ? item.nameZh : item.name
          const typeLabel = locale === 'zh' ? TYPE_LABELS[item.type][1] : TYPE_LABELS[item.type][0]
          const statusLabel = locale === 'zh' ? STATUS_LABELS[item.status][1] : STATUS_LABELS[item.status][0]

          return (
            <div
              key={item.id}
              className="grid grid-cols-[1fr_auto] items-center gap-x-3 px-3 py-1.5 border-b border-edge-50 hover:bg-hover transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-ink truncate">{name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-hover text-ink-2 font-mono">
                    {typeLabel}
                  </span>
                </div>
                <div className="text-[9px] text-muted mt-0.5">{item.operator}</div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[10px] font-mono tabular-nums text-accent">
                      {formatGPUCount(item.gpuCount)} GPUs
                    </div>
                    <div className="text-[9px] text-ink-2 font-mono tabular-nums">
                      {item.powerMW}MW
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_COLOR[item.status]}`} />
                    <span className="text-[8px] text-muted">{statusLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Totals */}
        <div className="grid grid-cols-2 gap-2 px-3 py-2 bg-sidebar border-t border-edge">
          <div className="text-center">
            <div className="text-[11px] font-bold font-mono tabular-nums text-accent">
              {formatGPUCount(totals.gpus)}
            </div>
            <div className="text-[9px] text-muted">{locale === 'zh' ? '总算力' : 'Total GPUs'}</div>
          </div>
          <div className="text-center">
            <div className="text-[11px] font-bold font-mono tabular-nums text-[#f59e0b]">
              {totals.power}MW
            </div>
            <div className="text-[9px] text-muted">{locale === 'zh' ? '总功耗' : 'Total Power'}</div>
          </div>
        </div>
      </div>
    </PanelBase>
  )
}
