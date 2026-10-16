import { NextResponse } from 'next/server'
import { MODEL_REPORTS } from '@/data/model-reports'
import { aggregateSignals } from '@/lib/aggregate'
import { signalsToReports } from '@/lib/model-report-mapping'

export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await aggregateSignals('en', 'all')
  const partialSources = Object.entries(result.sourceHealth).filter(([id, health]) =>
    ['huggingface', 'huggingface-models', 'semanticscholar'].includes(id) && health !== 'ok').map(([id]) => id)
  const live = result.fallbackMock ? [] : signalsToReports(result.signals)
  return NextResponse.json({
    state: !live.length ? 'static' : result.staleUsed ? 'stale' : partialSources.length ? 'partial' : result.fromCache ? 'cached' : 'live',
    fetchedAt: new Date(result.fetchedAt).toISOString(), live, curated: MODEL_REPORTS, partialSources,
    note: '动态资料与信号采集共用来源；历史参考单独标注。模型仓库的维护者不代表已核实的官方厂商。',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
