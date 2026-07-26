'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface ApiResponse<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

const MAX_BACKOFF_MS = 5 * 60 * 1000

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 60000
): ApiResponse<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)
  const fetcherRef = useRef(fetcher)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentIntervalRef = useRef(intervalMs)
  const originalIntervalRef = useRef(intervalMs)
  fetcherRef.current = fetcher

  const scheduleNext = useCallback(() => {
    timeoutRef.current = setTimeout(async () => {
      if (!mountedRef.current) return
      try {
        const result = await fetcherRef.current()
        if (mountedRef.current) {
          setData(result)
          setError(null)
          currentIntervalRef.current = originalIntervalRef.current
        }
      } catch (e) {
        if (mountedRef.current) setError(e as Error)
        currentIntervalRef.current = Math.min(
          currentIntervalRef.current * 2,
          MAX_BACKOFF_MS
        )
      }
      if (mountedRef.current) scheduleNext()
    }, currentIntervalRef.current)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcherRef.current()
      if (mountedRef.current) {
        setData(result)
        setError(null)
        currentIntervalRef.current = originalIntervalRef.current
      }
    } catch (e) {
      if (mountedRef.current) setError(e as Error)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchData()
    scheduleNext()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleNext()
      } else if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mountedRef.current = false
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchData, scheduleNext])

  return { data, loading, error, refetch: fetchData }
}
