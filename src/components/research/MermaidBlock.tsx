'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Mermaid } from 'mermaid'

// visualizer 智能体会在报告里塞一段 mermaid 代码块，这里把它真正画成图。
// 动态 import：mermaid 只在页面里出现图示时才加载，不拖累首屏。
let mermaidModule: Promise<Mermaid> | null = null

function loadMermaid(theme: string) {
  if (!mermaidModule) {
    mermaidModule = import('mermaid').then(m => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: theme === 'light' ? 'default' : 'dark',
        fontFamily: 'var(--font-ui)',
      })
      return m.default
    })
  }
  return mermaidModule.then(m => {
    m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'light' ? 'default' : 'dark', fontFamily: 'var(--font-ui)' })
    return m
  })
}

export default function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState('')
  const [failed, setFailed] = useState('')
  const [theme, setTheme] = useState('dark')
  const seq = useRef(0)
  // 同一页面可能有多张图，render 的 id 必须唯一
  const uid = useMemo(() => `mmd-${Math.random().toString(36).slice(2, 9)}`, [])

  useEffect(() => {
    const el = document.documentElement
    const read = () => setTheme(el.getAttribute('data-theme') || 'dark')
    read()
    const obs = new MutationObserver(read)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const id = seq.current++
    let cancelled = false
    setFailed('')
    loadMermaid(theme)
      .then(m => m.render(`${uid}-${id}`, code))
      .then(({ svg: rendered }) => { if (!cancelled) setSvg(rendered) })
      .catch(e => { if (!cancelled) setFailed(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [code, theme, uid])

  if (failed) {
    return (
      <figure className="my-4">
        <pre className="px-3 py-2.5 rounded-md bg-elevated border border-edge overflow-x-auto text-[12px] font-mono text-ink-2">
          {code}
        </pre>
        <figcaption className="mt-1.5 text-[10px] text-muted">
          图示渲染失败（{failed.slice(0, 80)}），已回退为源码
        </figcaption>
      </figure>
    )
  }

  return (
    <figure className="my-5">
      {svg
        ? <div className="overflow-x-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        : <div className="py-6 text-[11px] text-muted font-mono">渲染图示…</div>}
    </figure>
  )
}
