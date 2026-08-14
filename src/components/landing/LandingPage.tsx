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
    nav: { nexus: 'Nexus', pulse: 'Pulse', mirror: 'Mirror', ops: 'Ops', cta: 'Open console' },
    hero: { eyebrow: 'the AI intelligence stream', headlineA: 'Watch the AI world', headlineB: 'as it moves.', sub: 'monitor.ai pulls global AI intelligence — news, papers, open-source repos, model releases, and US–China macro context — into one live console you can read at a glance.', primary: 'Enter the console', secondary: 'View the mirror' },
    stream: { title: 'monitor.ai — live stream', rows: [
      { t: 'OpenAI ships new agent runtime', tag: 'news', src: 'HN', sev: 'live' },
      { t: 'Qwen3-Max tops the arena', tag: 'model', src: 'arena', sev: 'live' },
      { t: '128k-context paper published', tag: 'paper', src: 'huggingface', sev: 'ok' },
      { t: 'agent-framework trending on GitHub', tag: 'repo', src: 'github', sev: 'ok' },
    ] },
    stats: [
      { n: '4', label: 'signal sources' },
      { n: '7', label: 'macro indicators' },
      { n: '60s', label: 'auto refresh' },
      { n: '2', label: 'languages' },
    ],
    features: [
      { num: '01', title: 'NEXUS', head: 'One command center, the whole landscape.', body: 'A live map of AI agents across the globe. Every node carries its story — click in and it opens in the console. No switching tabs to see the big picture.', view: 'nexus' },
      { num: '02', title: 'PULSE', head: 'The stream never stops.', body: 'A real-time feed of news, papers, open-source repos, and model moves as they land. Watch the timeline scroll, or search it in one keystroke.', view: 'pulse' },
      { num: '03', title: 'MIRROR', head: 'US–China, side by side.', body: 'GDP, R&D spend, researchers, high-tech exports. Benchmark two economies against each other on the same indicators, same years, one screen.', view: 'mirror' },
      { num: '04', title: 'INSIGHTS', head: 'A reading of the day, machine-made.', body: 'An LLM turns the raw feed into a summary and a judgment — what matters, why, and how much to trust the source. Credibility is always on the table.', view: 'nexus' },
      { num: '05', title: 'OPS', head: 'Know when a source lies.', body: 'Every provider reports its own health. Live, cached, or stale is always visible, so a dead upstream never masquerades as silence in the signal.', view: 'ops' },
    ],
    cta: { head: 'Give your radar a home.', sub: 'One page. Everything the AI world is doing, while it is doing it.', primary: 'Enter the console', hint: 'no signup · runs self-hosted' },
    footer: { tag: 'built in the terminal', rights: '© 2026 monitor.ai', nexus: 'Nexus', pulse: 'Pulse', mirror: 'Mirror', ops: 'Ops' },
    viewLabel: 'OPEN',
  },
  zh: {
    nav: { nexus: '观测中枢', pulse: '情报脉冲', mirror: '中美镜像', ops: '源网监控', cta: '进入控制台' },
    hero: { eyebrow: 'AI 全球情报流', headlineA: '看 AI 世界', headlineB: '实时运转。', sub: 'monitor.ai 汇聚全球 AI 情报——新闻、论文、开源项目、模型发布与中美宏观环境——在一套实时控制台中一屏尽览。', primary: '进入控制台', secondary: '查看中美镜像' },
    stream: { title: 'monitor.ai — 实时流', rows: [
      { t: 'OpenAI 发布新一代 Agent 运行时', tag: '新闻', src: 'HN', sev: 'live' },
      { t: 'Qwen3-Max 登顶竞技场', tag: '模型', src: 'arena', sev: 'live' },
      { t: '128k 上下文论文发布', tag: '论文', src: 'huggingface', sev: 'ok' },
      { t: 'agent-framework 登上 GitHub 热榜', tag: '开源', src: 'github', sev: 'ok' },
    ] },
    stats: [
      { n: '4', label: '路数据源' },
      { n: '7', label: '项宏观指标' },
      { n: '60s', label: '自动刷新' },
      { n: '2', label: '语言切换' },
    ],
    features: [
      { num: '01', title: 'NEXUS', head: '一个中枢，纵览全貌。', body: '一张覆盖全球的 AI Agent 实时地图。每个节点都有自己的故事——点击即可在控制台展开，无需切换标签也能看清大局。', view: 'nexus' },
      { num: '02', title: 'PULSE', head: '信号流永不停歇。', body: '新闻、论文、开源与模型动态的实时时间线，一落地便呈现。看它滚动，或一键搜索。', view: 'pulse' },
      { num: '03', title: 'MIRROR', head: '中美镜像，同屏对照。', body: 'GDP、研发投入、科研人员、高技术出口。同一批指标、同一批年份，在同一个屏幕上比较两个经济体。', view: 'mirror' },
      { num: '04', title: 'INSIGHTS', head: '机器撰写的当日研判。', body: '大模型把原始信号提炼成摘要与判断——什么重要、为什么、可信度几何。信源可信度始终摆在台面上。', view: 'nexus' },
      { num: '05', title: 'OPS', head: '知道数据源何时说谎。', body: '每个数据源自报健康状态。实时、缓存或过期一目了然，上游宕机永远不会伪装成情报里的沉默。', view: 'ops' },
    ],
    cta: { head: '给你的雷达安一个家。', sub: '一页尽览。AI 世界此刻正在发生的一切。', primary: '进入控制台', hint: '无需注册 · 可自托管' },
    footer: { tag: '构建于终端', rights: '© 2026 monitor.ai', nexus: '观测中枢', pulse: '情报脉冲', mirror: '中美镜像', ops: '源网监控' },
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

/* ---- 02 信号流模拟 ---- */
function StreamMock() {
  return (
    <div className="rounded-lg border border-edge bg-base-50 font-mono text-[12px] overflow-hidden">
      <div className="px-3 py-1.5 border-b border-edge text-[10px] text-muted uppercase tracking-widest flex justify-between">
        <span>monitor.ai — live stream</span><span className="text-success">● live</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2"><span className="text-accent">●</span><span>OpenAI ships new agent runtime</span><Tag label="news" sev="live" /></div>
        <div className="flex items-center gap-2"><span className="text-accent">●</span><span>Qwen3-Max tops the arena</span><Tag label="model" sev="live" /></div>
        <div className="flex items-center gap-2 opacity-70"><span className="text-success">●</span><span>128k-context paper published</span><Tag label="paper" sev="ok" /></div>
        <div className="flex items-center gap-2 opacity-70"><span className="text-success">●</span><span>agent-framework trending</span><Tag label="repo" sev="ok" /></div>
      </div>
    </div>
  )
}

/* ---- 03 中美对照模拟 ---- */
function MirrorMock() {
  const rows = [
    { label: 'R&D / GDP', us: 72, cn: 64 },
    { label: 'GDP (T$)', us: 100, cn: 82 },
    { label: 'Hightech exp.', us: 46, cn: 88 },
  ]
  return (
    <div className="rounded-lg border border-edge bg-base-50 p-3 space-y-3">
      <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-muted">
        <span className="text-ink-2">US</span><span>research vs output</span><span className="text-accent">CN</span>
      </div>
      {rows.map(r => (
        <div key={r.label}>
          <div className="flex justify-between text-[10px] font-mono text-muted mb-1"><span>{r.label}</span></div>
          <div className="flex items-center gap-1">
            <div className="flex-1 flex justify-end"><div className="h-2 rounded bg-edge-light" style={{ width: `${r.us}%` }} /></div>
            <span className="w-1.5" />
            <div className="flex-1"><div className="h-2 rounded bg-accent" style={{ width: `${r.cn}%` }} /></div>
          </div>
        </div>
      ))}
      <div className="pt-1 border-t border-edge text-[10px] font-mono text-muted flex justify-between"><span>7 indicators</span><span className="text-accent">side by side →</span></div>
    </div>
  )
}

/* ---- 04 研判模拟 ---- */
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
  const mocks = [<MapMock key="m1" />, <StreamMock key="m2" />, <MirrorMock key="m3" />, <InsightMock key="m4" />, <OpsMock key="m5" />]

  return (
    <div className="min-h-screen bg-base text-ink overflow-x-hidden">
      {/* ===== 顶部导航 ===== */}
      <header className="sticky top-0 z-40 bg-base border-b border-edge">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold tracking-tight text-[15px]">
            <span className="text-accent">monitor</span><span>.ai</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {(['nexus', 'pulse', 'mirror'] as const).map(k => (
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
          <Link href="/mirror" className="text-[15px] font-medium text-ink-2 border border-edge rounded-md px-5 py-2.5 hover:border-edge-light hover:text-ink transition-colors">
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
                <Link href={`/${f.view}`} className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:text-accent-dim transition-colors">
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
            <Link href="/pulse" className="text-[12px] text-muted hover:text-ink">{t.footer.pulse}</Link>
            <Link href="/mirror" className="text-[12px] text-muted hover:text-ink">{t.footer.mirror}</Link>
            <Link href="/ops" className="text-[12px] text-muted hover:text-ink">{t.footer.ops}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
