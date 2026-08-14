'use client'

// 统一的数据获取 hook：收敛各面板/页面重复的 fetch + AbortController + loading/error/refreshing 样板。
// 用法：
//   const { data, loading, error, reload } = useRemoteData<RadarResponse>('/api/agent-radar')
//   const projects = data?.projects ?? []
// 自动竞态取消（卸载/重跑时 abort 上一个请求），支持 force 刷新时区分 refreshing。

import { useCallback, useEffect, useRef, useState } from 'react'

export interface RemoteDataState<T> {
  data: T | null
  setData: React.Dispatch<React.SetStateAction<T | null>>
  /** 首载 / 非 force 重跑时置 true */
  loading: boolean
  /** force 重跑（reload(true)）时置 true，用于区分"手动刷新"态 */
  refreshing: boolean
  error: string | null
  /** force=true 走"刷新"态（不清 loading），否则走"首载"态 */
  reload: (force?: boolean) => void
}

interface Options<T> {
  /** 自定义解析（如需要 text / 校验）；默认 res.json() */
  parse?: (res: Response) => Promise<T>
  /** false 则首载不自动请求（需手动 reload()） */
  enabled?: boolean
  /** 自动轮询刷新间隔（ms）。设置后页面打开期间会周期性后台重拉（不清 loading，不闪烁）。
   *  标签页隐藏时自动暂停，恢复可见后立即刷新一次。 */
  refreshInterval?: number
}

export function useRemoteData<T>(
  url: string,
  deps: unknown[] = [],
  opts: Options<T> = {},
): RemoteDataState<T> {
  const parse = opts.parse ?? ((res: Response) => res.json() as Promise<T>)
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(opts.enabled ?? true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const dataRef = useRef<T | null>(null)
  dataRef.current = data
  const urlRef = useRef(url)
  urlRef.current = url
  // 保持 parse 引用稳定（避免每次渲染生成新引用导致 reload 变化）
  const parseRef = useRef(parse)
  parseRef.current = parse

  const run = useCallback((force = false) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    if (force) setRefreshing(true)
    else if (!dataRef.current) setLoading(true)
    setError(null)

    fetch(urlRef.current, { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return parseRef.current(r) })
      .then(d => {
        if (ctrl.signal.aborted) return
        setData(d)
        setLoading(false)
        setRefreshing(false)
      })
      .catch(e => {
        if (e.name === 'AbortError') return
        setError((e as Error).message)
        setLoading(false)
        setRefreshing(false)
      })
  }, [])

  const reload = useCallback((force = false) => run(force), [run])

  useEffect(() => {
    if (opts.enabled === false) return
    run()
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, url, ...deps])

  // 自动轮询：标签页隐藏时暂停，恢复可见后立即刷新一次
  useEffect(() => {
    const ms = opts.refreshInterval
    if (!ms) return
    const poll = () => { if (!document.hidden) run(true) }
    const id = setInterval(poll, ms)
    document.addEventListener('visibilitychange', poll)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', poll) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, opts.refreshInterval])

  return { data, setData, loading, refreshing, error, reload }
}
