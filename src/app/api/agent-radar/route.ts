// /api/agent-radar — Agent 开源雷达：GitHub 真实指标 + 7 日增长快照
// 降级链：live（真实数据）→ cached（15min 缓存）→ partial（部分仓库失败）→ static（仅 curated 字段）
import { NextResponse } from 'next/server'
import { AGENT_RADAR_PROJECTS, type AgentRadarProject } from '@/data/agent-radar'
import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

const TIMEOUT = 8000
const CACHE_TTL = 15 * 60 * 1000
const SNAPSHOT_INTERVAL = 24 * 60 * 60 * 1000

interface RadarCacheEntry {
  projects: AgentRadarProject[]
  fetchedAt: number
  failedRepos: string[]
}
let radarCache: RadarCacheEntry | null = null

/** 每日快照：记录每个 repo 每天的 stars，用于计算近 7 日增长 */
const starHistory = new Map<string, { day: string; stars: number }[]>()
function recordStarSnapshot(repo: string, stars: number): number | null {
  const today = new Date().toISOString().slice(0, 10)
  const list = starHistory.get(repo) || []
  const last = list[list.length - 1]
  if (!last || last.day !== today) {
    list.push({ day: today, stars })
    // 只保留最近 7 天
    while (list.length > 7) list.shift()
    starHistory.set(repo, list)
  }
  const oldest = list[0]
  if (!oldest || oldest.day === today) return null
  return stars - oldest.stars
}

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'monitor-ai/1.0',
  }
  if (process.env.GITHUB_TOKEN) h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  return h
}

interface GhRepoBrief {
  full_name: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  language: string | null
  license: { spdx_id: string | null } | null
  pushed_at: string
}

/** 用 GitHub Search API 一次查询全部仓库基础指标（节省配额） */
async function fetchRepoMetrics(repos: string[]): Promise<{ ok: Map<string, GhRepoBrief>; failed: string[] }> {
  const ok = new Map<string, GhRepoBrief>()
  const failed: string[] = []
  const CHUNK = 5
  for (let i = 0; i < repos.length; i += CHUNK) {
    const chunk = repos.slice(i, i + CHUNK)
    const q = chunk.map(r => `repo:${r}`).join(' ')
    try {
      const res = await fetchWithTimeout(
        `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=${CHUNK}`,
        { headers: githubHeaders() },
        TIMEOUT,
      )
      if (!res.ok) {
        chunk.forEach(r => failed.push(r))
        continue
      }
      const body = await res.json()
      const items: GhRepoBrief[] = Array.isArray(body.items) ? body.items : []
      const found = new Set(items.map(i => i.full_name.toLowerCase()))
      for (const item of items) ok.set(item.full_name.toLowerCase(), item)
      chunk.forEach(r => { if (!found.has(r.toLowerCase())) failed.push(r) })
    } catch {
      chunk.forEach(r => failed.push(r))
    }
  }

  // search 未命中的仓库：逐个用 GET /repos/{owner}/{repo} 兜底（未认证 60 req/h 内）
  for (const repo of [...failed]) {
    try {
      const res = await fetchWithTimeout(
        `https://api.github.com/repos/${repo}`,
        { headers: githubHeaders() },
        TIMEOUT,
      )
      if (res.ok) {
        const item = await res.json() as GhRepoBrief
        ok.set(item.full_name.toLowerCase(), item)
        failed.splice(failed.indexOf(repo), 1)
      }
    } catch { /* 保持 failed */ }
  }

  return { ok, failed }
}

/** 有 token 时补充最近 release（无 token 跳过，避免配额耗尽） */
async function fetchLatestRelease(repo: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.github.com/repos/${repo}/releases/latest`,
      { headers: githubHeaders() },
      TIMEOUT,
    )
    if (!res.ok) return null
    const body = await res.json()
    return typeof body.tag_name === 'string' ? body.tag_name : null
  } catch {
    return null
  }
}

export async function GET() {
  const now = Date.now()

  if (radarCache && now - radarCache.fetchedAt < CACHE_TTL) {
    return NextResponse.json({
      fetchedAt: new Date(radarCache.fetchedAt).toISOString(),
      state: 'cached',
      projects: radarCache.projects,
      failedRepos: radarCache.failedRepos,
      snapshotNote: '近 7 日增长由本服务每日快照计算，接入后次日可见',
    })
  }

  const repos = AGENT_RADAR_PROJECTS.map(p => p.repo)
  const { ok, failed } = await fetchRepoMetrics(repos)

  // 全部失败 → 仅返回 curated 静态字段
  if (ok.size === 0) {
    return NextResponse.json({
      fetchedAt: new Date(now).toISOString(),
      state: 'static',
      projects: AGENT_RADAR_PROJECTS,
      failedRepos: failed,
      snapshotNote: 'GitHub API 暂不可达，当前为静态清单（无实时指标）',
    })
  }

  const hasToken = !!process.env.GITHUB_TOKEN
  const projects: AgentRadarProject[] = AGENT_RADAR_PROJECTS.map(p => {
    const m = ok.get(p.repo.toLowerCase())
    if (!m) return p
    return {
      ...p,
      stars: m.stargazers_count,
      starsDelta7d: recordStarSnapshot(p.repo, m.stargazers_count),
      forks: m.forks_count,
      openIssues: m.open_issues_count,
      language: m.language || p.language,
      license: m.license?.spdx_id && m.license.spdx_id !== 'NOASSERTION' ? m.license.spdx_id : p.license,
      pushedAt: m.pushed_at,
      issuesActivity: m.open_issues_count > 200 ? 'high' : m.open_issues_count > 50 ? 'medium' : 'low',
      latestRelease: null, // 下面补
    }
  })

  // release：仅在有 token 时逐个补充（无 token 保持 null → UI 显示"—"）
  if (hasToken && ok.size > 0) {
    await Promise.all(projects.map(async p => {
      if (!ok.has(p.repo.toLowerCase())) return
      p.latestRelease = await fetchLatestRelease(p.repo)
    }))
  }

  const state = failed.length === 0 ? 'live' : 'partial'
  radarCache = { projects, fetchedAt: now, failedRepos: failed }

  return NextResponse.json({
    fetchedAt: new Date(now).toISOString(),
    state,
    projects,
    failedRepos: failed,
    hasToken,
    snapshotNote: '近 7 日增长由本服务每日快照计算，接入后次日可见',
  })
}
