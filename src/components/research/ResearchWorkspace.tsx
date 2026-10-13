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
  task_id?: number | null
  status: string
  error?: string | null
  created_at?: number | null
  report?: string | null
  events?: RunEvent[]
  elapsed_sec?: number | null
  signals_used?: string[]
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
  const [policyMode, setPolicyMode] = useState<'adaptive' | 'fixed'>('adaptive')

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

  useEffect(() => () => sourceRef.current?.close(), [])

  const followLive = useCallback((runId: string) => {
    sourceRef.current?.close()
    setActiveKey(runId)
    setRunning(true)
    setEvents([])
    setDetail(null)
    startedAtRef.current = Date.now()
    setElapsed(0)

    const source = new EventSource(`/api/research/run/${runId}/events`)
    sourceRef.current = source
    source.onmessage = msg => {
      let ev: RunEvent
      try { ev = JSON.parse(msg.data) } catch { return }
      if (ev.event === 'stream_end') {
        source.close()
        void fetch(`/api/research/run/${runId}`)
          .then(r => (r.ok ? r.json() : null))
          .then((record: RunDetail | null) => {
            if (record) {
              setDetail(record)
              // 落盘后列表项用 task_id 标识，选中态要跟着换成它，否则高亮丢失
              if (record.task_id) setActiveKey(String(record.task_id))
            }
            setNotice(null)
            setRunning(false)
            reloadHistory(true)
          })
          .catch(() => setRunning(false))
        return
      }
      setEvents(prev => [...prev, ev])
    }
    source.onerror = () => {
      // 断流：不静默失败——下一次拉取会给出最终状态，这里只提示一次
      setNotice(zh ? '事件流中断，正在拉取最终结果…' : 'Event stream dropped; fetching the final result…')
    }
  }, [reloadHistory, zh])

  const start = useCallback(async () => {
    const parentTaskId = reuseHistory && detail?.status === 'done' && detail.report && detail.task_id ? String(detail.task_id) : undefined
    setNotice(null)
    setDetail(null)
    setEvents([])
    try {
      const res = await fetch('/api/research/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ focus, top, max_sections: maxSections, policy_mode: policyMode, parent_task_id: parentTaskId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNotice(data.error || `HTTP ${res.status}`)
        return
      }
      followLive(data.run_id as string)
      reloadHistory(true)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e))
    }
  }, [focus, top, maxSections, followLive, reloadHistory, reuseHistory, detail, policyMode])

  const onSelect = useCallback(async (item: RunSummary) => {
    if (item.run_id) {
      followLive(item.run_id)
      return
    }
    if (!item.task_id) return
    sourceRef.current?.close()
    setRunning(false)
    setEvents([])
    setNotice(null)
    setActiveKey(String(item.task_id))
    const res = await fetch(`/api/research/history/${item.task_id}`)
    if (!res.ok) {
      setNotice(zh ? `历史报告加载失败：HTTP ${res.status}` : `Failed to load report: HTTP ${res.status}`)
      return
    }
    const record: RunDetail = await res.json()
    setDetail(record)
    setEvents(record.events || [])
  }, [followLive, zh])

  const cancel = useCallback(async () => {
    // 运行中的 key 就是 run_id（followLive 设置的），落盘后才会换成 task_id
    if (!activeKey) return
    try {
      const res = await fetch(`/api/research/run/${activeKey}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setNotice(data.error || `HTTP ${res.status}`)
        return
      }
      setNotice(zh ? '已请求停止，等当前步骤结束后中断…' : 'Stop requested; interrupting after the current step…')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e))
    }
  }, [activeKey, zh])

  const report = detail?.report || null
  const historyItems = useMemo(() => history?.items ?? [], [history])

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
    if (report) void navigator.clipboard?.writeText(report)
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
          ? '由监测信号自动组题，多个智能体协作完成深度技术情报研究：规划章节 → 分头查证 → 评审改写 → 事实核查 → 成稿'
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
            <span className="text-muted">上游 <span className="text-ink-2">{health.upstream_commit?.slice(0, 8) || '—'}</span></span>
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
            <div className="px-3 pt-3 space-y-2 text-[11px] text-muted">
            <label className="block">
              <span className="mr-2">{zh ? '研究配置' : 'Research policy'}</span>
              <select aria-label={zh ? '研究配置' : 'Research policy'} value={policyMode} disabled={running}
                onChange={e => setPolicyMode(e.target.value as 'adaptive' | 'fixed')}
                className="bg-elevated border border-edge rounded p-1">
                <option value="adaptive">{zh ? '按任务与资料状态调整' : 'Task and information aware'}</option>
                <option value="fixed">{zh ? '固定配置' : 'Fixed policy'}</option>
              </select>
            </label>
            <label className="flex gap-2 items-start">
              <input type="checkbox" checked={reuseHistory} disabled={running}
                onChange={e => setReuseHistory(e.target.checked)} />
              <span>{zh ? '以当前选中的已完成报告开展后续研究' : 'Continue from the selected completed report'}</span>
            </label>
            {reuseHistory && (!detail?.report || detail.status !== 'done') &&
              <p>{zh ? '请先选择一份已完成报告；未选择时将开展独立研究。' : 'Select a completed report; otherwise a standalone run will start.'}</p>}
          </div>
          <Composer
              locale={locale}
              focus={focus}
              onFocusChange={setFocus}
              top={top}
              onTopChange={setTop}
              maxSections={maxSections}
              onMaxSectionsChange={setMaxSections}
              onStart={start}
              onCancel={cancel}
              running={running}
              ready={!serviceDown && !keyMissing}
              blockedReason={blockedReason}
            />
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
          <ReportView
            locale={locale}
            status={detail?.status || (running ? 'running' : 'idle')}
            report={report}
            error={detail?.error || null}
            meta={{
              model: health?.model,
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
          <HistoryList locale={locale} items={historyItems} activeKey={activeKey} onSelect={onSelect} />
        </PanelBase>
      </div>
    </div>
  )
}
