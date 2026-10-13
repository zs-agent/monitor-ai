'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getLocale, type Locale } from '@/lib/i18n'
import ThemeToggle from '@/components/layout/ThemeToggle'

/* =========================================================
   monitor.ai — 系统首页（herdr.dev 风格）
   独立落地页：Hero + 终端模拟 + 数据横幅 + 编号特性 + 尾页 CTA
   复用全局主题令牌，支持明/暗与中/英切换。
   ========================================================= */

type Dict = typeof COPY.en
const COPY = {
  en: {
    nav: { nexus: 'Nexus', ops: 'Ops', cta: 'Open console' },
    hero: { eyebrow: 'the AI intelligence stream', headlineA: 'Watch the AI world', headlineB: 'as it moves.', sub: 'monitor.ai pulls global AI intelligence — news, papers, open-source repos, and model releases — into one live console you can read at a glance.', primary: 'Enter the console', secondary: 'View research' },
    stream: { title: 'monitor.ai — live stream', rows: [
      { t: 'OpenAI ships new agent runtime', tag: 'news', src: 'HN', sev: 'live' },
      { t: 'Qwen3-Max tops the arena', tag: 'model', src: 'arena', sev: 'live' },
      { t: '128k-context paper published', tag: 'paper', src: 'huggingface', sev: 'ok' },
      { t: 'agent-framework trending on GitHub', tag: 'repo', src: 'github', sev: 'ok' },
    ] },
    stats: [
      { n: '4', label: 'signal sources' },
      { n: '10', label: 'agent roles' },
      { n: '60s', label: 'auto refresh' },
      { n: '2', label: 'languages' },
    ],
    features: [
      { num: '01', title: 'DASHBOARD', head: 'One command center, the whole landscape.', body: 'The signal stream with filters and tags, a live map of AI agents across the globe, daily insights, model reports and the arena — all on one board.', view: '/nexus?tab=dashboard' },
      { num: '02', title: 'RESEARCH', head: 'Briefs with receipts.', body: 'A monitored signal becomes a research topic; a team of agents plans, researches, reviews and fact-checks it, then publishes a cited brief you can trace back to its sources.', view: '/nexus?tab=research' },
      { num: '03', title: 'OPS', head: 'Know when a source lies.', body: 'Every provider reports its own health. Live, cached, or stale is always visible, so a dead upstream never masquerades as silence in the signal.', view: '/ops' },
    ],
    cta: { head: 'Give your radar a home.', sub: 'One page. Everything the AI world is doing, while it is doing it.', primary: 'Enter the console', hint: 'no signup · runs self-hosted' },
    footer: { tag: 'built in the terminal', rights: '© 2026 monitor.ai', nexus: 'Nexus', ops: 'Ops' },
    viewLabel: 'OPEN',
  },
  zh: {
    nav: { nexus: '观测中枢', ops: '源网监控', cta: '进入控制台' },
    hero: { eyebrow: 'AI 全球情报流', headlineA: '看 AI 世界', headlineB: '实时运转。', sub: 'monitor.ai 汇聚全球 AI 情报——新闻、论文、开源项目与模型发布——在一套实时控制台中一屏尽览。', primary: '进入控制台', secondary: '查看情报研究' },
    stream: { title: 'monitor.ai — 实时流', rows: [
      { t: 'OpenAI 发布新一代 Agent 运行时', tag: '新闻', src: 'HN', sev: 'live' },
      { t: 'Qwen3-Max 登顶竞技场', tag: '模型', src: 'arena', sev: 'live' },
      { t: '128k 上下文论文发布', tag: '论文', src: 'huggingface', sev: 'ok' },
      { t: 'agent-framework 登上 GitHub 热榜', tag: '开源', src: 'github', sev: 'ok' },
    ] },
    stats: [
      { n: '4', label: '路数据源' },
      { n: '10', label: '个智能体角色' },
      { n: '60s', label: '自动刷新' },
      { n: '2', label: '语言切换' },
    ],
    features: [
      { num: '01', title: 'DASHBOARD', head: '一个中枢，纵览全貌。', body: '带筛选与标签的信号流、覆盖全球的 AI Agent 实时地图、当日洞察、模型报告与竞技场——同一块看板上一屏尽览。', view: '/nexus?tab=dashboard' },
      { num: '02', title: 'RESEARCH', head: '结论背后有据可查。', body: '一条监测信号变成一个研究课题，多个智能体分工规划、检索、评审与事实核查，最后产出报告——每条结论都能追回它的来源。', view: '/nexus?tab=research' },
      { num: '03', title: 'OPS', head: '知道数据源何时说谎。', body: '每个数据源自报健康状态。实时、缓存或过期一目了然，上游宕机永远不会伪装成情报里的沉默。', view: '/ops' },
    ],
    cta: { head: '给你的雷达安一个家。', sub: '一页尽览。AI 世界此刻正在发生的一切。', primary: '进入控制台', hint: '无需注册 · 可自托管' },
    footer: { tag: '构建于终端', rights: '© 2026 monitor.ai', nexus: '观测中枢', ops: '源网监控' },
    viewLabel: '查看',
  },
}

function Tag({ label, sev }: { label: string; sev: string }) {
  const color = sev === 'live'
    ? 'text-accent bg-accent-bg'
    : 'text-success bg-success-10'
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${color}`}>{label}</span>
}

/* ---- 01 地图模拟 ---- */
function MapMock() {
  const dots = [
    { top: '22%', left: '24%' }, { top: '34%', left: '52%' }, { top: '28%', left: '70%' },
    { top: '52%', left: '40%' }, { top: '48%', left: '76%' }, { top: '66%', left: '58%' },
  ]
  return (
    <div className="relative h-40 rounded-lg bg-dot-grid border border-edge overflow-hidden">
      {dots.map((d, i) => (
        <span key={i} className="absolute w-1.5 h-1.5 -ml-1 -mt-1 rounded-full bg-accent landing-glow" style={{ top: d.top, left: d.left }} />
      ))}
      <span className="absolute right-3 top-3 text-[10px] font-mono text-muted">● 6 active nodes</span>
      <span className="absolute left-3 bottom-3 text-[10px] font-mono text-accent bg-accent-bg px-1.5 py-0.5 rounded">SF → Beijing · 1.2s</span>
    </div>
  )
}

/* ---- 01 研判模拟 ---- */
function InsightMock() {
  return (
    <div className="rounded-lg border border-edge bg-base-50 p-3 space-y-2">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted">today’s read · 2026-08-13</div>
      <p className="text-[12px] text-ink leading-relaxed">Agent runtimes are consolidating fast — two new frameworks, one plateau on benchmarks, and a sharp uptick in multi-agent orchestration papers.</p>
      <div className="flex flex-wrap gap-1.5">
        <Tag label="agents" sev="live" /><Tag label="runtimes" sev="live" /><Tag label="bench" sev="ok" />
        <span className="text-[10px] font-mono text-muted px-1.5 py-0.5 rounded bg-warning-10 text-warning">credibility 4/5</span>
      </div>
    </div>
  )
}

/* ---- 05 源网状态模拟 ---- */
function OpsMock() {
  const rows: { src: string; s: 'live' | 'cached' | 'stale' }[] = [
    { src: 'hackernews', s: 'live' }, { src: 'huggingface', s: 'live' }, { src: 'github', s: 'cached' }, { src: 'semanticscholar', s: 'stale' },
  ]
  const cls = { live: 'text-success bg-success-10', cached: 'text-warning bg-warning-10', stale: 'text-danger bg-danger-bg' }
  return (
    <div className="rounded-lg border border-edge bg-base-50 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-edge text-[10px] text-muted uppercase tracking-widest">source health</div>
      <div className="divide-y divide-edge">
        {rows.map(r => (
          <div key={r.src} className="px-3 py-1.5 flex items-center justify-between">
            <span className="font-mono text-[12px] text-ink-2">{r.src}</span>
            <span className={`text-[10px] font-mono uppercase font-semibold px-1.5 py-0.5 rounded ${cls[r.s]}`}>{r.s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>('en')

  useEffect(() => { setLocale(getLocale()) }, [])

  const toggleLocale = () => {
    const next: Locale = locale === 'zh' ? 'en' : 'zh'
    setLocale(next)
    if (typeof window !== 'undefined') localStorage.setItem('monitor-ai-locale', next)
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en'
  }

  const t: Dict = COPY[locale]
  const mocks = [<MapMock key="m1" />, <InsightMock key="m2" />, <OpsMock key="m3" />]

  return (
    <div className="min-h-screen bg-base text-ink overflow-x-hidden">
      {/* ===== 顶部导航 ===== */}
      <header className="sticky top-0 z-40 bg-base border-b border-edge">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold tracking-tight text-[15px]">
            <span className="text-accent">monitor</span><span>.ai</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {(['nexus', 'ops'] as const).map(k => (
              <Link key={k} href={`/${k}`} className="text-[13px] text-muted hover:text-ink transition-colors">{t.nav[k]}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={toggleLocale} className="text-[13px] text-muted hover:text-ink transition-colors font-mono">{locale === 'zh' ? 'EN' : '中文'}</button>
            <Link href="/nexus" className="text-[13px] font-medium text-accent border border-accent-50 rounded-md px-3 py-1.5 hover:bg-accent-bg transition-colors">
              {t.nav.cta} →
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="max-w-5xl mx-auto px-5 pt-16 md:pt-24 pb-14 text-center">
        <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted mb-5">{t.hero.eyebrow}</p>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
          {t.hero.headlineA}{' '}<span className="text-accent">{t.hero.headlineB}</span>
        </h1>
        <p className="max-w-2xl mx-auto mt-6 text-base md:text-lg text-ink-2 leading-relaxed">{t.hero.sub}</p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link href="/nexus" className="text-[15px] font-semibold bg-accent text-black rounded-md px-5 py-2.5 hover:bg-accent-dim hover:text-white transition-colors">
            {t.hero.primary} →
          </Link>
          <Link href="/nexus?tab=research" className="text-[15px] font-medium text-ink-2 border border-edge rounded-md px-5 py-2.5 hover:border-edge-light hover:text-ink transition-colors">
            {t.hero.secondary}
          </Link>
        </div>
      </section>

      {/* ===== Hero 终端模拟 ===== */}
      <section className="max-w-4xl mx-auto px-5 pb-14">
        <div className="rounded-xl border border-edge overflow-hidden shadow-2xl shadow-black/20">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-card border-b border-edge">
            <span className="w-2.5 h-2.5 rounded-full bg-danger" />
            <span className="w-2.5 h-2.5 rounded-full bg-warning" />
            <span className="w-2.5 h-2.5 rounded-full bg-success" />
            <span className="ml-3 text-[11px] font-mono text-muted">{t.stream.title}</span>
            <span className="ml-auto text-[10px] font-mono text-success bg-success-10 px-1.5 py-0.5 rounded uppercase">● live</span>
          </div>
          <div className="bg-base-50 p-4 font-mono text-[13px] space-y-2.5">
            {t.stream.rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 animate-fade-in" style={{ animationDelay: `${i * 0.08}s` }}>
                <span className="w-2 h-2 rounded-full shrink-0 bg-accent landing-glow" />
                <span className="text-ink">{r.t}</span>
                <Tag label={r.tag} sev={r.sev} />
                <span className="ml-auto text-muted text-[11px]">{r.src}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-accent">❯</span><span className="text-ink">monitor.ai</span><span className="landing-caret" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== 数据横幅 ===== */}
      <section className="max-w-4xl mx-auto px-5 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-edge rounded-lg overflow-hidden border border-edge">
          {t.stats.map(s => (
            <div key={s.label} className="bg-card px-6 py-6 text-center">
              <div className="text-3xl font-extrabold text-ink tabular-nums">{s.n}</div>
              <div className="text-[11px] text-muted mt-1 uppercase tracking-widest">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 编号特性 ===== */}
      <section className="border-t border-edge">
        <div className="max-w-5xl mx-auto px-5">
          {t.features.map((f, i) => (
            <div key={f.num} className="py-14 md:py-20 border-b border-edge last:border-0 grid md:grid-cols-2 gap-8 md:gap-16 items-center">
              <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-accent text-sm">{f.num}</span>
                  <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted">{f.title}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">{f.head}</h2>
                <p className="mt-4 text-base text-ink-2 leading-relaxed">{f.body}</p>
                <Link href={f.view} className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-dim transition-colors">
                  {t.viewLabel} {f.title} →
                </Link>
              </div>
              <div className={i % 2 === 1 ? 'md:order-1' : ''}>{mocks[i]}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 尾页 CTA ===== */}
      <section className="py-24 md:py-32 text-center">
        <div className="max-w-3xl mx-auto px-5">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">{t.cta.head}</h2>
          <p className="mt-4 text-base md:text-lg text-ink-2">{t.cta.sub}</p>
          <div className="mt-8">
            <Link href="/nexus" className="inline-block text-[15px] font-semibold bg-accent text-black rounded-md px-6 py-3 hover:bg-accent-dim hover:text-white transition-colors">
              {t.cta.primary} →
            </Link>
            <p className="mt-3 text-[11px] font-mono text-muted">{t.cta.hint}</p>
          </div>
        </div>
      </section>

      {/* ===== 页脚 ===== */}
      <footer className="border-t border-edge">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="text-[12px] font-mono text-muted">{t.footer.tag} · {t.footer.rights}</span>
          <div className="flex items-center gap-5">
            <Link href="/nexus" className="text-[12px] text-muted hover:text-ink">{t.footer.nexus}</Link>
            <Link href="/ops" className="text-[12px] text-muted hover:text-ink">{t.footer.ops}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
