'use client'

// /research 工作台：左（新建 + 历史报告库）· 中（报告阅读）· 右（协作过程）
// 数据面：research-service 的 /health、/research/history、/research/{run_id}、/{run_id}/events(SSE)
// 全部经 Next 的 /api/research/* 反代，浏览器不直连 Python 服务。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getLocale, type Locale } from '@/lib/i18n'
import { useRemoteData } from '@/lib/use-remote-data'
import PageHeader from '@/components/layout/PageHeader'
import PanelBase from '@/components/PanelBase'
import AgentTimeline, { type RunEvent } from './AgentTimeline'
import Composer from './Composer'
import HistoryList, { type RunSummary } from './HistoryList'
import ReportView from './ReportView'
import ConclusionSummary from './ConclusionSummary'
import MechanismView, { type ResearchState } from './MechanismView'
import ExperimentControls from './ExperimentControls'
import { defaultSchedulerConfig, type SchedulerConfig, type TaskType, type RunStatus } from '@/types/research-contracts'
import type { Evidence, ManualAssociation } from '@/types/research'

interface Health {
  ok?: boolean
  upstream_commit?: string | null
  model?: string
  retriever?: string
  llm_key_present?: boolean
  signal_snapshot?: string
  signals_snapshot?: string
  snapshot_exists?: boolean
  active_runs?: string[]
}

interface HistoryResponse {
  items: RunSummary[]
}

interface RunDetail {
  run_id?: string
  task_id?: number | string | null
  status: RunStatus
  error?: string | null
  created_at?: number | null
  report?: string | null
  events?: RunEvent[]
  elapsed_sec?: number | null
  signals_used?: string[]
  structured_state?: ResearchState
  data_mode?: string
  snapshot?: string
}

export default function ResearchWorkspace() {
  const [locale, setLocale] = useState<Locale>('en')
  useEffect(() => { setLocale(getLocale()) }, [])

  // 实体档案页的「用这个实体发起研究」会带 ?focus=<实体名> 过来，预填课题
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('focus')
    if (wanted) setFocus(wanted)
  }, [])
  const zh = locale === 'zh'

  const { data: health, error: healthError, reload: reloadHealth } = useRemoteData<Health>(
    '/api/research/health',
    [],
    { refreshInterval: 30000 },
  )
  const { data: history, reload: reloadHistory } = useRemoteData<HistoryResponse>(
    '/api/research/history',
    [],
    { refreshInterval: 15000 },
  )

  const [focus, setFocus] = useState('AI 智能体编排框架')
  const [top, setTop] = useState(12)
  const [maxSections, setMaxSections] = useState(3)
  const [reuseHistory, setReuseHistory] = useState(false)
  const [includeUnsuccessful, setIncludeUnsuccessful] = useState(false)
  const engine = 'structured' as const
  const [taskType, setTaskType] = useState<TaskType>('fact_check')
  const [associationMode, setAssociationMode] = useState<'structured' | 'jaccard' | 'hybrid' | 'unfiltered' | 'keyword' | 'semantic'>('structured')
  const [schedulerConfig, setSchedulerConfig] = useState<SchedulerConfig>({ ...defaultSchedulerConfig, ablations: [] })
  const [manualAssociations, setManualAssociations] = useState<ManualAssociation[]>([])
  const [snapshotOverride, setSnapshotOverride] = useState<Evidence[] | undefined>()
  const [questionSpecs, setQuestionSpecs] = useState<{ id?: string; axis: string; question: string; task_type: TaskType; critical?: boolean }[] | undefined>()
  const [demoResults, setDemoResults] = useState<RunDetail[]>([])
  const [loadingDemo, setLoadingDemo] = useState(false)
  const previewRequestRef = useRef(0)
  const [actionBudget, setActionBudget] = useState(6)
  const [policyMode, setPolicyMode] = useState<'adaptive' | 'fixed' | 'single' | 'full' | 'greedy'>('adaptive')

  const [previewState, setPreviewState] = useState<ResearchState | null>(null)
  const [timeScope, setTimeScope] = useState('')
  const [starting, setStarting] = useState(false)
  const generationRef = useRef(0)
  const startLock = useRef(false)

  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [detail, setDetail] = useState<RunDetail | null>(null)
  const [events, setEvents] = useState<RunEvent[]>([])
  const [running, setRunning] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const sourceRef = useRef<EventSource | null>(null)
  const startedAtRef = useRef(0)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [running])

  useEffect(() => () => { sourceRef.current?.close(); generationRef.current++; previewRequestRef.current++ }, [])

  const followLive = useCallback((runId: string) => {
    sourceRef.current?.close()
    const generation = ++generationRef.current
    setActiveKey(runId)
    setRunning(true)
    setEvents([])
    setDetail(null)
    startedAtRef.current = Date.now()
    setElapsed(0)

    const source = new EventSource(`/api/research/run/${runId}/events`)
    sourceRef.current = source
    source.onmessage = msg => {
      if (generation !== generationRef.current) return
      let ev: RunEvent
      try { ev = JSON.parse(msg.data) } catch { return }
      const stateEvent = ev as RunEvent & { state?: ResearchState }
      if (ev.event === 'shared_state' && stateEvent.state?.issues && stateEvent.state?.evidence) {
        setDetail(previous => ({ ...previous, status: 'running', structured_state: stateEvent.state }))
        return
      }
      if (ev.event === 'stream_end') {
        source.close()
        void fetch(`/api/research/run/${runId}`, { signal: AbortSignal.timeout(10000) })
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
          .then((record: RunDetail | null) => {
            if (generation !== generationRef.current) return
            if (record) {
              setDetail(record)
              // 落盘后列表项用 task_id 标识，选中态要跟着换成它，否则高亮丢失
              if (record.task_id) setActiveKey(String(record.task_id))
            }
            setNotice(record?.error || null)
            setRunning(false)
            reloadHistory(true)
          })
          .catch(() => { if (generation === generationRef.current) { setNotice('任务结果获取失败，请刷新或重选报告'); setRunning(false) } })
        return
      }
      setEvents(prev => prev.some(p => p.ts === ev.ts && p.event === ev.event && p.output === ev.output) ? prev : [...prev.slice(-1999), ev])
    }
    source.onerror = () => {
      if (generation !== generationRef.current) return
      // 断流：不静默失败——下一次拉取会给出最终状态，这里只提示一次
      setNotice(zh ? '事件流中断，正在拉取最终结果…' : 'Event stream dropped; fetching the final result…')
    }
  }, [reloadHistory, zh])


  useEffect(() => {
    if (!running || !activeKey) return
    const generation = generationRef.current
    let disposed = false
    let failures = 0
    let inFlight = false
    const poll = async () => {
      if (inFlight) return
      inFlight = true
      try {
        const response = await fetch(`/api/research/run/${activeKey}`, { signal: AbortSignal.timeout(10000) })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const record: RunDetail = await response.json()
        if (disposed || generation !== generationRef.current) return
        failures = 0
        setDetail(record)
        if (record.status !== 'running') {
          sourceRef.current?.close()
          setRunning(false)
          setNotice(record.error || null)
          if (record.task_id) setActiveKey(String(record.task_id))
          reloadHistory(true)
        }
      } catch (error) {
        if (disposed || generation !== generationRef.current) return
        failures++
        setNotice(`任务状态暂不可达 (${failures})：${error instanceof Error ? error.message : String(error)}`)
        if (failures >= 3) { sourceRef.current?.close(); setRunning(false) }
      } finally { inFlight = false }
    }
    void poll()
    const timer = setInterval(() => { void poll() }, 3000)
    return () => { disposed = true; clearInterval(timer) }
  }, [running, activeKey, reloadHistory])

  const preview = useCallback(async () => {
    setNotice(null)
    const generation = generationRef.current
    const request = ++previewRequestRef.current
    try {
      const response = await fetch('/api/research/preview', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ focus, top, engine, task_type: taskType, action_budget: actionBudget, scheduler_mode: policyMode, association_mode: associationMode, time_scope: timeScope,
          scheduler_config: schedulerConfig, manual_associations: manualAssociations, snapshot: snapshotOverride, questions: questionSpecs,
          data_mode: snapshotOverride && detail?.structured_state?.data_mode === 'synthetic_demo' ? 'synthetic_demo' : 'live',
          parent_task_id: reuseHistory && detail?.task_id ? String(detail.task_id) : undefined }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : data.error || `HTTP ${response.status}`)
      if (generation !== generationRef.current || request !== previewRequestRef.current) return
      const state = data.structured_state as ResearchState
      if (state) state.allocation = data.research_policy.allocation
      setPreviewState(state || null)
    } catch (error) { if (generation === generationRef.current && request === previewRequestRef.current) setNotice(error instanceof Error ? error.message : String(error)) }
  }, [focus, top, engine, taskType, actionBudget, policyMode, timeScope, reuseHistory, detail, associationMode, schedulerConfig, manualAssociations, snapshotOverride, questionSpecs])

  useEffect(() => { previewRequestRef.current++; setPreviewState(null) }, [focus, top, taskType, actionBudget, policyMode, timeScope, reuseHistory, associationMode, schedulerConfig])

  const changeCritical = useCallback(async (id: string, critical: boolean) => {
    const source = previewState || detail?.structured_state
    if (!source) return
    const request = ++previewRequestRef.current
    const generation = generationRef.current
    const specs = Object.values(source.issues).map(q => ({ id: q.id, axis: q.axis, question: q.question, task_type: q.task_type || source.task_type, critical: q.id === id ? critical : q.critical || false }))
    const records = Object.values(source.signal_evidence || source.evidence)
    const response = await fetch('/api/research/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ focus, task_type: taskType, action_budget: actionBudget, scheduler_mode: policyMode, association_mode: associationMode, scheduler_config: schedulerConfig, time_scope: timeScope, snapshot: records, questions: specs, manual_associations: manualAssociations, association_config: source.association_config, data_mode: source.data_mode || 'live' }) })
    const data = await response.json()
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : '修改失败')
    if (request !== previewRequestRef.current || generation !== generationRef.current) return
    setQuestionSpecs(specs); setSnapshotOverride(records); setPreviewState(data.structured_state)
  }, [previewState, detail, focus, taskType, actionBudget, policyMode, associationMode, schedulerConfig, timeScope, manualAssociations])

  const correctAssociation = useCallback(async (correction: ManualAssociation) => {
    const sourceState = previewState || detail?.structured_state
    if (!sourceState) return
    const request = ++previewRequestRef.current
    const generation = generationRef.current
    const records = Object.values(sourceState.signal_evidence || sourceState.evidence)
    const corrected = [...manualAssociations.filter(m => m.evidence_key !== correction.evidence_key), correction]
    const specs = Object.values(sourceState.issues).map(q => ({ id: q.id, axis: q.axis, question: q.question, critical: q.critical || false, task_type: q.task_type || sourceState.task_type }))
    const response = await fetch('/api/research/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(15000), body: JSON.stringify({ focus, task_type: taskType, action_budget: actionBudget, scheduler_mode: policyMode, association_mode: associationMode, scheduler_config: schedulerConfig, time_scope: timeScope, snapshot: records, manual_associations: corrected, questions: specs, association_config: sourceState.association_config, data_mode: sourceState.data_mode || 'live' }) })
    const data = await response.json()
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `HTTP ${response.status}`)
    if (request !== previewRequestRef.current || generation !== generationRef.current) return
    const result = data.structured_state as ResearchState
    result.allocation = data.research_policy.allocation
    setSnapshotOverride(records); setQuestionSpecs(specs); setManualAssociations(corrected); setPreviewState(result)
  }, [previewState, detail, manualAssociations, focus, taskType, actionBudget, policyMode, associationMode, schedulerConfig, timeScope])

  const loadDemo = useCallback(async () => {
    if (loadingDemo || running || starting) return
    setLoadingDemo(true); setNotice(null)
    const generation = ++generationRef.current
    previewRequestRef.current++
    try {
      const response = await fetch('/api/research/demo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action_budget: Math.max(8, actionBudget), scheduler_config: schedulerConfig, scheduler_mode: policyMode }), signal: AbortSignal.timeout(30000) })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `HTTP ${response.status}`)
      if (generation !== generationRef.current) return
      const snapshots = data.snapshots as RunDetail[]
      setDemoResults(snapshots); setPreviewState(null); setDetail(snapshots[1]); setEvents(snapshots[1]?.events || []); setNotice(data.description)
      if (snapshots[1]?.structured_state) { setFocus(snapshots[1].structured_state.focus); setTaskType(snapshots[1].structured_state.task_type) }
    } catch (error) { if (generation === generationRef.current) setNotice(error instanceof Error ? error.message : String(error)) } finally { setLoadingDemo(false) }
  }, [loadingDemo, running, starting, actionBudget, schedulerConfig, policyMode])

  const start = useCallback(async () => {
    if (startLock.current) return
    startLock.current = true
    setStarting(true)
    const generation = ++generationRef.current
    previewRequestRef.current++
    const parentTaskId = reuseHistory && (detail?.status === 'done' || detail?.status === 'partial') && detail.report && detail.task_id ? String(detail.task_id) : undefined
    if (reuseHistory && !parentTaskId) { setNotice("请先选择一份具有结构化状态的报告"); startLock.current = false; setStarting(false); return }
    setNotice(null)
    setDetail(null)
    setEvents([])
    try {
      const res = await fetch('/api/research/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({ focus, top, max_sections: maxSections, policy_mode: policyMode === 'fixed' ? 'fixed' : 'adaptive', parent_task_id: parentTaskId, engine, task_type: taskType, action_budget: actionBudget, scheduler_mode: policyMode, association_mode: associationMode, time_scope: timeScope, scheduler_config: schedulerConfig, manual_associations: manualAssociations, snapshot: snapshotOverride, questions: questionSpecs, association_config: snapshotOverride ? (previewState || detail?.structured_state)?.association_config : undefined, data_mode: snapshotOverride ? (previewState || detail?.structured_state)?.data_mode || 'live' : 'live' }),
      })
      const data = await res.json()
      if (generation !== generationRef.current) return
      if (!res.ok) {
        setNotice(typeof data.detail === 'string' ? data.detail : data.error || `HTTP ${res.status}`)
        return
      }
      followLive(data.run_id as string)
      reloadHistory(true)
    } catch (e) {
      if (generation === generationRef.current) setNotice(e instanceof Error ? e.message : String(e))
    } finally { startLock.current = false; setStarting(false) }
  }, [focus, top, maxSections, followLive, reloadHistory, reuseHistory, detail, policyMode, engine, taskType, actionBudget, timeScope, associationMode, schedulerConfig, manualAssociations, snapshotOverride, questionSpecs, previewState])

  const onSelect = useCallback(async (item: RunSummary) => {
    if (item.run_id) {
      followLive(item.run_id)
      return
    }
    if (!item.task_id) return
    sourceRef.current?.close()
    const generation = ++generationRef.current
    setRunning(false)
    setEvents([])
    setDetail(null); setPreviewState(null); setSnapshotOverride(undefined); setQuestionSpecs(undefined); setManualAssociations([])
    setNotice(null)
    setActiveKey(String(item.task_id))
    try {
    const res = await fetch(`/api/research/history/${item.task_id}`, { signal: AbortSignal.timeout(15000) })
    if (generation !== generationRef.current) return
    if (!res.ok) {
      setNotice(zh ? `历史报告加载失败：HTTP ${res.status}` : `Failed to load report: HTTP ${res.status}`)
      return
    }
    const record: RunDetail = await res.json()
    if (generation !== generationRef.current) return
    setDetail(record)
    if (record.structured_state) {
      setFocus(record.structured_state.focus)
      setTaskType(record.structured_state.task_type)
      setTimeScope(record.structured_state.time_scope || '')
    }
    setEvents(record.events || [])
    } catch (error) { if (generation === generationRef.current) setNotice(error instanceof Error ? error.message : String(error)) }
  }, [followLive, zh])

  const cancel = useCallback(async () => {
    // 运行中的 key 就是 run_id（followLive 设置的），落盘后才会换成 task_id
    if (!activeKey) return
    try {
      const res = await fetch(`/api/research/run/${activeKey}/cancel`, { method: 'POST', signal: AbortSignal.timeout(10000) })
      const data = await res.json()
      if (!res.ok) {
        setNotice(typeof data.detail === 'string' ? data.detail : data.error || `HTTP ${res.status}`)
        return
      }
      setNotice(zh ? '已请求停止，等当前步骤结束后中断…' : 'Stop requested; interrupting after the current step…')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e))
    }
  }, [activeKey, zh])

  const report = detail?.report || null
  const historyItems = useMemo(() => (history?.items ?? []).filter(item => includeUnsuccessful || ['done', 'partial', 'running'].includes(item.status || '')), [history, includeUnsuccessful])

  const download = useCallback(() => {
    if (!report) return
    const url = URL.createObjectURL(new Blob([report], { type: 'text/markdown;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `research-${detail?.task_id ?? 'report'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [report, detail])

  const copy = useCallback(() => {
    if (report) void navigator.clipboard.writeText(report).catch(() => setNotice('复制失败，请下载报告'))
  }, [report])

  const serviceDown = !!healthError
  const keyMissing = health ? health.llm_key_present === false : false
  const blockedReason = !serviceDown && keyMissing
    ? (zh
      ? '研究服务缺少模型 key：在 research-service/.env 填 DEEPSEEK_API_KEY 后重启服务，再回来开始研究。'
      : 'The research service has no model key: set DEEPSEEK_API_KEY in research-service/.env, restart it, then start a run.')
    : null

  return (
    <div className="px-4 pb-6">
      <PageHeader
        title={zh ? '情报研究' : 'Research'}
        valueProp={zh
          ? '关联监测线索与分析问题，在预算内组织研究和核查，保留可回查的报告与更新记录'
          : 'Signals become a research topic; a team of agents plans, researches, reviews, fact-checks and publishes'}
        actions={
          <button
            onClick={() => { reloadHealth(true); reloadHistory(true) }}
            className="text-[11px] font-mono text-muted hover:text-ink border border-edge rounded px-2 py-1 transition-colors"
          >
            {zh ? '刷新' : 'Refresh'}
          </button>
        }
      />

      {/* 服务状态：一眼看出能不能跑、跑在什么配置上 */}
      <div className="mb-4 px-3 py-2.5 rounded-md bg-sidebar border border-edge text-[10px] font-mono">
        {serviceDown ? (
          <div className="text-muted">
            <span className="text-[var(--error)]">{healthError}</span>
            <span className="ml-2">
              {zh ? '启动命令：research-service/.venv/Scripts/python.exe -m uvicorn service.app:app --port 8000' : 'Start it: research-service/.venv/Scripts/python.exe -m uvicorn service.app:app --port 8000'}
            </span>
          </div>
        ) : health ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-muted">模型 <span className="text-ink-2">{health.model || '—'}</span></span>
            <span className="text-muted">检索器 <span className="text-ink-2">{health.retriever || '—'}</span></span>
            <span className={keyMissing ? 'text-[var(--error)]' : 'text-accent'}>
              {keyMissing ? (zh ? '缺模型 key' : 'key missing') : (zh ? 'key 就绪' : 'key ready')}
            </span>
            {!!health.active_runs?.length && (
              <span className="text-accent">{zh ? `运行中 ${health.active_runs.length}` : `${health.active_runs.length} running`}</span>
            )}
            {running && <span className="text-accent tabular-nums">{zh ? `已运行 ${elapsed}s` : `${elapsed}s elapsed`}</span>}
          </div>
        ) : (
          <span className="text-muted">{zh ? '检查服务…' : 'Checking service…'}</span>
        )}
      </div>

      {notice && (
        <div className="mb-4 px-3 py-2 rounded-md border border-edge text-[11px] text-warning break-words">{notice}</div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_372px] xl:grid-rows-[auto_minmax(0,1fr)] xl:h-[calc(100vh-190px)]">
        {/* 新建研究：桌面在左列第一格，移动端排在最前 */}
        <PanelBase
          id="research-composer"
          title={zh ? '新建研究' : 'New research'}
          className="shrink-0 xl:col-start-1 xl:row-start-1"
        >
          <div className="overflow-y-auto">
            <Composer locale={locale} structured focus={focus}
              onFocusChange={value => { setFocus(value); setManualAssociations([]); setSnapshotOverride(undefined); setQuestionSpecs(undefined) }}
              top={top} onTopChange={setTop} maxSections={maxSections} onMaxSectionsChange={setMaxSections}
              onStart={start} onCancel={cancel} running={running || starting || loadingDemo}
              ready={!serviceDown && !keyMissing} blockedReason={blockedReason}>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted">
                <label>想做什么<select aria-label="任务类型" value={taskType} disabled={running || starting || loadingDemo} onChange={e => { setTaskType(e.target.value as TaskType); setManualAssociations([]); setQuestionSpecs(undefined) }} className="block w-full bg-elevated border border-edge rounded p-2 mt-1">
                  <option value="fact_check">核对事实</option><option value="object_comparison">比较对象</option><option value="dynamic_analysis">跟踪变化</option><option value="risk_assessment">评估风险</option>
                </select></label>
                <label>最多研究 / 核查<input aria-label="动作预算" type="number" min={0} max={64} value={actionBudget} disabled={running || starting || loadingDemo} onChange={e => setActionBudget(Math.max(0, Math.min(64, Math.floor(Number(e.target.value) || 0))))} className="block w-full bg-elevated border border-edge rounded p-2 mt-1" /></label>
              </div>
              <p className="text-[10px] text-muted">每次包含一轮查找与分析。系统默认自动安排，未核实的内容会注明。</p>
            </Composer>
            <div className="px-3 pb-3 space-y-2 text-[11px] text-muted">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { void preview() }} disabled={running || starting || loadingDemo || serviceDown} className="border border-edge text-accent rounded p-2 disabled:opacity-40">预览分析安排</button>
                <button onClick={() => { void loadDemo() }} disabled={running || starting || loadingDemo || serviceDown} className="border border-edge text-accent rounded p-2 disabled:opacity-40">{loadingDemo ? '加载样例中…' : '体验版本更新样例'}</button>
              </div>
              {!!demoResults.length && <div className="flex gap-2">{demoResults.map((result, i) => <button key={String(result.task_id)} disabled={running || starting || loadingDemo} onClick={() => { generationRef.current++; previewRequestRef.current++; setPreviewState(null); setDetail(result); setEvents(result.events || []) }} className="border border-edge rounded px-3 py-2 text-accent">{i === 0 ? '初始发布（T1）' : '新版本（T2）'}</button>)}</div>}
              <details className="border border-edge rounded p-2">
                <summary className="cursor-pointer text-ink">更多研究选项</summary>
                <div className="space-y-3 mt-3">
                  <label className="block">资料时间范围<input aria-label="资料时间范围" value={timeScope} disabled={running || starting} onChange={e => setTimeScope(e.target.value)} maxLength={200} placeholder="不填则不限定" className="block w-full bg-elevated border border-edge rounded p-2 mt-1" /></label>
                  <label className="block">最多选取资料数<input aria-label="信号条数" type="number" min={1} max={50} value={top} disabled={running || starting} onChange={e => setTop(Math.max(1, Math.min(50, Math.floor(Number(e.target.value) || 1))))} className="block w-full bg-elevated border border-edge rounded p-2 mt-1" /></label>
                  <label className="block">分析方式<select aria-label="研究配置" value={policyMode} disabled={running || starting} onChange={e => setPolicyMode(e.target.value as typeof policyMode)} className="block w-full bg-elevated border border-edge rounded p-2 mt-1">
                    <option value="adaptive">自动安排（推荐）</option><option value="single">只做研究（对照）</option><option value="full">全部重新研究（对照）</option><option value="greedy">按优先程度依次安排</option><option value="fixed">各问题同等优先（对照）</option>
                  </select></label>
                  <label className="block">资料筛选方式<select aria-label="线索关联策略" value={associationMode} disabled={running || starting} onChange={e => setAssociationMode(e.target.value as typeof associationMode)} className="block w-full bg-elevated border border-edge rounded p-2 mt-1">
                    <option value="structured">词项与分析维度（推荐）</option><option value="keyword">只按关键词（对照）</option><option value="semantic">按语义关联（需配置服务）</option><option value="hybrid">综合关联（需语义服务）</option><option value="unfiltered">不做关联筛选（对照）</option>
                  </select></label>
                  <label className="flex gap-2"><input type="checkbox" checked={reuseHistory} disabled={running || starting} onChange={e => setReuseHistory(e.target.checked)} />接着当前报告继续研究</label>
                  {reuseHistory && !detail?.structured_state && <p>请先在报告库选择一份已有报告。</p>}
                </div>
              </details>
              <ExperimentControls value={schedulerConfig} onChange={setSchedulerConfig} disabled={running || starting || loadingDemo} />
            </div>
          </div>
        </PanelBase>

        {/* 中：报告（移动端紧跟"新建研究"之后，研究一启动就能看到进展） */}
        <PanelBase
          id="research-report"
          title={zh ? '情报报告' : 'Intelligence report'}
          dataBadge={running ? 'live' : report ? 'cached' : undefined}
          dataBadgeDetail={detail?.task_id ? `#${detail.task_id}` : undefined}
          className="min-h-[520px] xl:col-start-2 xl:row-start-1 xl:row-span-2"
          headerExtra={report ? (
            <div className="flex items-center gap-1">
              <button onClick={copy} className="px-1.5 py-0.5 text-[10px] rounded text-muted hover:text-ink-2 hover:bg-overlay transition-colors">
                {zh ? '复制' : 'Copy'}
              </button>
              <button onClick={download} className="px-1.5 py-0.5 text-[10px] rounded text-muted hover:text-ink-2 hover:bg-overlay transition-colors">
                {zh ? '下载 .md' : '.md'}
              </button>
            </div>
          ) : undefined}
        >
          {detail?.structured_state && ['done', 'partial', 'failed'].includes(detail.status) && <ConclusionSummary key={detail.task_id} state={detail.structured_state} />}
          {(previewState || detail?.structured_state) && <details open={running || !!previewState || !report} className="mx-3 my-2 rounded border border-edge">
            <summary className="cursor-pointer px-3 py-2 text-[12px] text-muted">{zh ? '研究过程与完整证据记录' : 'Research process and evidence records'}</summary>
            <MechanismView state={(previewState || detail?.structured_state)!} preview={!!previewState} taskId={!previewState && detail?.task_id && ['done', 'partial'].includes(detail.status) ? String(detail.task_id) : undefined} onCorrect={!running ? correctAssociation : undefined} onCritical={!running && !starting ? changeCritical : undefined} comparisons={demoResults.flatMap((r, i) => r.structured_state ? [{ label: `T${i + 1} · 合成样例`, state: r.structured_state }] : [])} />
          </details>}
          <ReportView
            locale={locale}
            status={detail?.status || (running ? 'running' : 'idle')}
            report={report}
            error={detail?.error || null}
            meta={{
              model: (detail?.structured_state?.data_mode || detail?.data_mode) === 'synthetic_demo' ? '演示规则（未调用外部模型）' : health?.model,
              elapsedSec: running ? elapsed : detail?.elapsed_sec,
              events: events.length,
              signals: detail?.signals_used?.length,
              finishedAt: detail?.created_at ?? null,
            }}
          />
        </PanelBase>

        {/* 右：协作过程 */}
        <PanelBase
          id="research-trace"
          title={zh ? '协作过程' : 'Collaboration'}
          dataBadge={running ? 'live' : undefined}
          count={events.length}
          className="min-h-[520px] xl:col-start-3 xl:row-start-1 xl:row-span-2"
        >
          <AgentTimeline locale={locale} events={events} running={running} />
        </PanelBase>

        {/* 报告库：桌面在左列第二格，移动端排最后 */}
        <PanelBase
          id="research-history"
          title={zh ? '报告库' : 'Reports'}
          count={historyItems.length}
          collapsible
          className="min-h-[240px] xl:col-start-1 xl:row-start-2"
        >
          <label className="flex gap-2 px-3 py-2 text-[10px] text-muted"><input type="checkbox" checked={includeUnsuccessful} onChange={e => setIncludeUnsuccessful(e.target.checked)} />查看失败与取消记录</label>
          <HistoryList locale={locale} items={historyItems} activeKey={activeKey} onSelect={onSelect} />
        </PanelBase>
      </div>
    </div>
  )
}
