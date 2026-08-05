'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import type { Locale } from '@/lib/i18n'

interface Repo {
  id: number; name: string; description: string | null; url: string
  stars: number; language: string | null; avatar: string | null
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const d = Math.floor(diff / 86400000)
  return d > 0 ? `${d}d ago` : 'today'
}

function starLabel(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

export default function GitHubTrendingPanel({ locale }: { locale: Locale }) {
  const [repos, setRepos] = useState<Repo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch('/api/github-trending', { signal: ctrl.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(d => { if (!ctrl.signal.aborted) { setRepos(d || []); setFetchedAt(Date.now()); setLoading(false) } })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ctrl.abort()
  }, [])

  if (loading) return <LoadingSkeleton />
  if (error) return <ErrorState message={error} locale={locale} onRetry={() => window.location.reload()} />

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <span className="text-[13px] font-semibold text-[var(--text-primary)]">GitHub Trending</span>
          <span className="ml-2 text-[10px] text-[var(--text-muted)]">{locale === 'zh' ? 'AI 开源项目热度排行（GitHub Search API）' : 'AI open-source ranking (GitHub Search API)'}</span>
        </div>
        <span className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-hover)] px-2 py-0.5 rounded" title={fetchedAt ? new Date(fetchedAt).toLocaleString() : ''}>API{fetchedAt ? ' · ' + timeAgo(new Date(fetchedAt).toISOString()) : ''}</span>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {repos.map((repo, i) => (
          <div key={repo.id} className="block px-4 py-3 hover:bg-[var(--hover-overlay)] transition-colors group">
            <div className="flex items-start gap-3">
              <span className="text-[10px] text-[var(--text-muted)] font-mono w-5 shrink-0 pt-0.5">#{i + 1}</span>
              {repo.avatar && <Image src={repo.avatar} alt="" width={20} height={20} className="w-5 h-5 rounded-full mt-0.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a href={repo.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-[var(--accent)] group-hover:text-[var(--accent-dim)] transition-colors truncate">{repo.name}</a>
                  {repo.language && (
                    <span className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded shrink-0">{repo.language}</span>
                  )}
                </div>
                {repo.description && (
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{repo.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">⭐ {starLabel(repo.stars)}</span>
                  <a href={repo.url} target="_blank" rel="noopener noreferrer"
                    className="text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {locale === 'zh' ? '查看 →' : 'View →'}
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {repos.length === 0 && (
        <div className="flex flex-col items-center py-8 text-[var(--text-muted)]">
          <span className="text-2xl mb-2 opacity-30">◆</span>
          <p className="text-[11px]">{locale === 'zh' ? '暂无 Trending 数据' : 'No trending data'}</p>
          <p className="text-[9px] mt-1">{locale === 'zh' ? 'GitHub API 调用受限，请稍后重试' : 'GitHub API rate limited, retry later'}</p>
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 animate-pulse space-y-3">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-[var(--bg-hover)] rounded" />)}
    </div>
  )
}

function ErrorState({ message, locale, onRetry }: { message: string; locale: Locale; onRetry: () => void }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">GitHub Trending</span>
        <span className="text-[9px] text-[var(--error)] bg-[var(--error-bg)] px-2 py-0.5 rounded">{locale === 'zh' ? '异常' : 'ERROR'}</span>
      </div>
      <p className="text-[11px] text-[var(--error)] mb-2">{message}</p>
      <button onClick={onRetry} className="text-[10px] text-[var(--accent)] hover:text-[var(--accent-dim)] transition-colors">
        {locale === 'zh' ? '重试' : 'Retry'} →
      </button>
    </div>
  )
}
