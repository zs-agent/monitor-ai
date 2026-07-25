'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface ApiResponse<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number = 60000
): ApiResponse<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const mountedRef = useRef(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcherRef.current()
      if (mountedRef.current) {
        setData(result)
        setError(null)
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
    const interval = setInterval(fetchData, intervalMs)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [fetchData, intervalMs])

  return { data, loading, error, refetch: fetchData }
}
