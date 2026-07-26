'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex items-center justify-center min-h-screen bg-[#0a0a0f]">
          <div className="text-center p-8">
            <div className="text-3xl text-[#1e1e2e] mb-4">⚠</div>
            <h2 className="text-sm font-semibold text-[#e5e5e5] mb-2">Something went wrong</h2>
            <p className="text-[10px] text-[#5c5c72] mb-4">{this.state.error?.message || 'Unknown error'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 text-[10px] bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20 rounded hover:bg-[#06b6d4]/20 transition-colors"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
