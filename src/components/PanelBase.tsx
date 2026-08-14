'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { loadPanelCollapsed, savePanelCollapsed } from '@/lib/panel-persistence'

export type PanelSeverity = 'critical' | 'high' | 'medium' | 'low' | 'none'
export type DataBadgeState = 'live' | 'cached' | 'stale' | 'unavailable' | 'static'

interface PanelBaseProps {
  id: string
  title: string
  severity?: PanelSeverity
  dataBadge?: DataBadgeState
  dataBadgeDetail?: string
  freshness?: { status: string; label: string } | null
  newCount?: number
  count?: number
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  collapsible?: boolean
  className?: string
  children?: ReactNode
  headerExtra?: ReactNode
}

const RETRY_BASE_SECONDS = 15

export default function PanelBase({
  id,
  title,
  severity = 'none',
  dataBadge,
  dataBadgeDetail,
  freshness,
  newCount = 0,
  count,
  loading = false,
  error = null,
  onRetry,
  collapsible = false,
  className = '',
  children,
  headerExtra,
}: PanelBaseProps) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (collapsible) {
      setCollapsed(loadPanelCollapsed()[id] || false)
    }
  }, [id, collapsible])
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const cleanupRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return cleanupRetryTimer
  }, [cleanupRetryTimer])

  useEffect(() => {
    if (error && onRetry) {
      let remaining = RETRY_BASE_SECONDS
      setRetryCountdown(remaining)
      retryTimerRef.current = setInterval(() => {
        remaining -= 1
        if (remaining <= 0) {
          cleanupRetryTimer()
          setRetryCountdown(null)
          onRetry()
        } else {
          setRetryCountdown(remaining)
        }
      }, 1000)
    } else {
      cleanupRetryTimer()
      setRetryCountdown(null)
    }
  }, [error, onRetry, cleanupRetryTimer])

  const handleToggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      savePanelCollapsed(id, next)
      return next
    })
  }, [id])

  const handleRetryClick = useCallback(() => {
    cleanupRetryTimer()
    setRetryCountdown(null)
    onRetry?.()
  }, [onRetry, cleanupRetryTimer])

  const panelClasses = [
    'panel-base',
    collapsed ? 'panel-collapsed' : '',
    error ? 'panel-error' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div ref={panelRef} className={panelClasses} data-panel={id}>
      <div className="panel-header">
        <div className="panel-header-left">
          <span className={`panel-severity-dot severity-${severity}`} />
          <span className="panel-title" title={title}>{title}</span>
          {dataBadge && (
            <span className={`panel-data-badge ${dataBadge}`}>
              {dataBadgeDetail
                ? `${dataBadge === 'static' ? 'REF' : dataBadge.toUpperCase()} · ${dataBadgeDetail}`
                : dataBadge === 'static' ? 'REF' : dataBadge.toUpperCase()}
            </span>
          )}
          {freshness && (
            <span className={`panel-freshness-badge panel-freshness-${freshness.status}`} title={freshness.label}>
              {freshness.label}
            </span>
          )}
          {newCount > 0 && (
            <span className={`panel-new-badge ${newCount > 0 ? 'pulse' : ''}`}>
              {newCount > 99 ? '99+' : `${newCount} NEW`}
            </span>
          )}
          {count !== undefined && (
            <span className="panel-count">{count}</span>
          )}
          </div>
        <div className="flex items-center gap-1">
          {headerExtra}
          {collapsible && (
            <button
              className="panel-btn"
              onClick={handleToggleCollapse}
              aria-label={collapsed ? 'Expand' : 'Collapse'}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '▸' : '▾'}
            </button>
          )}
        </div>
      </div>
      <div className="panel-content min-h-0">
        {loading ? (
          <div className="panel-loading">
            <div className="panel-loading-radar">
              <div className="panel-radar-dot" />
            </div>
            <div className="panel-loading-text">Loading...</div>
          </div>
        ) : error ? (
          <div className="panel-error-state">
            <div className="panel-loading-radar panel-error-radar">
              <div className="panel-radar-dot" style={{ background: '#ff4444' }} />
            </div>
            <div className="panel-error-msg">{error}</div>
            {onRetry && (
              <button
                className="text-[10px] text-accent hover:text-accent-dim transition-colors mt-1"
                onClick={handleRetryClick}
              >
                {retryCountdown !== null ? `Retrying (${retryCountdown}s)` : 'Retry now'}
              </button>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
