import type { ReactNode } from 'react'
import MermaidBlock from '@/components/research/MermaidBlock'

// 轻量 Markdown → React 渲染器。
// 只覆盖 LLM 报告实际会产出的语法（标题/段落/列表/表格/引用/代码块/行内样式），
// 不引第三方 markdown 依赖，也不用 dangerouslySetInnerHTML（mermaid 出图除外，见 MermaidBlock）。

const INLINE_RE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g

const BLOCK_START = /^\s*(#{1,4}\s|```|>\s?|[-*+]\s|\d+[.)]\s)/
const TABLE_DIVIDER = /^\s*\|?[\s:|-]*-[\s:|-]*\|[\s:|-]*$/

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let cursor = 0
  let i = 0
  let match: RegExpExecArray | null
  INLINE_RE.lastIndex = 0
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index))
    const token = match[0]
    const key = `${keyBase}-${i++}`
    if (token.startsWith('**') || token.startsWith('__')) {
      nodes.push(<strong key={key} className="font-semibold text-ink">{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="font-mono text-[12px] px-1 py-px rounded bg-elevated border border-edge text-ink-2">
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const close = token.indexOf('](')
      nodes.push(
        <a
          key={key}
          href={/^https?:\/\//i.test(token.slice(close + 2, -1)) ? token.slice(close + 2, -1) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-accent-30 underline-offset-2 hover:decoration-accent break-words"
        >
          {token.slice(1, close)}
        </a>,
      )
    } else {
      nodes.push(<em key={key} className="italic text-ink-2">{token.slice(1, -1)}</em>)
    }
    cursor = match.index + token.length
  }
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

export function renderMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let k = 0
  const nextKey = (prefix: string) => `${prefix}-${k++}`

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i++; continue }

    // 代码块 / mermaid 图
    const fence = line.match(/^\s*```(\S*)/)
    if (fence) {
      const lang = (fence[1] || '').toLowerCase()
      const buf: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) { buf.push(lines[i]); i++ }
      i++
      const code = buf.join('\n')
      blocks.push(
        lang === 'mermaid'
          ? <MermaidBlock key={nextKey('mermaid')} code={code} />
          : (
            <pre
              key={nextKey('code')}
              className="my-4 px-3 py-2.5 rounded-md bg-elevated border border-edge overflow-x-auto text-[12px] font-mono text-ink-2"
            >
              {code}
            </pre>
          ),
      )
      continue
    }

    // 标题
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const cls =
        level === 1
          ? 'text-[18px] font-bold text-ink leading-snug mt-1 mb-4'
          : level === 2
            ? 'text-[14px] font-semibold text-ink mt-7 mb-3 pb-1.5 border-b border-edge'
            : 'text-[12px] font-semibold text-ink-2 uppercase tracking-[0.08em] mt-6 mb-2'
      blocks.push(<div key={nextKey('h')} className={cls}>{renderInline(heading[2], nextKey('hi'))}</div>)
      i++
      continue
    }

    // 分隔线
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push(<hr key={nextKey('hr')} className="my-6 border-0 border-t border-edge" />)
      i++
      continue
    }

    // 引用
    if (/^\s*>/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      blocks.push(
        <blockquote key={nextKey('q')} className="my-4 pl-3 border-l border-edge text-[12.5px] text-muted">
          {renderInline(buf.join(' '), nextKey('qi'))}
        </blockquote>,
      )
      continue
    }

    // 表格
    if (line.includes('|') && line.trim() && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      const header = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim())
      const rows: string[][] = []
      i += 2
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(lines[i].replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim()))
        i++
      }
      blocks.push(
        <div key={nextKey('tw')} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr>
                {header.map((cell, ci) => (
                  <th key={ci} className="text-left font-semibold text-ink-2 px-2 py-1.5 border-b border-edge whitespace-nowrap">
                    {renderInline(cell, `th-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="align-top">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1.5 border-b border-edge/60 text-ink-2">
                      {renderInline(cell, `td-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    // 列表（支持一层缩进）
    const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)
    if (listMatch) {
      const ordered = /\d/.test(listMatch[2])
      const items: { depth: number; text: string }[] = []
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)
        if (!m) {
          // 列表项的续行：缩进且不是新的列表标记
          if (items.length && /^\s{2,}\S/.test(lines[i]) && !BLOCK_START.test(lines[i])) {
            items[items.length - 1].text += ` ${lines[i].trim()}`
            i++
            continue
          }
          break
        }
        items.push({ depth: Math.min(Math.floor(m[1].length / 2), 1), text: m[3] })
        i++
      }
      const ListTag = ordered ? 'ol' : 'ul'
      blocks.push(
        <ListTag
          key={nextKey('list')}
          className={`my-3 space-y-1.5 pl-5 text-[13px] ${ordered ? 'list-decimal' : 'list-disc'} marker:text-muted`}
        >
          {items.map((item, ii) => (
            <li key={ii} className={item.depth > 0 ? 'ml-4' : undefined}>
              {renderInline(item.text, `li-${ii}`)}
            </li>
          ))}
        </ListTag>,
      )
      continue
    }

    // 段落
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) {
      if (lines[i].includes('|') && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) break
      buf.push(lines[i].trim())
      i++
    }
    if (buf.length === 0) { i++; continue }  // 兜底：不认识的行也要消费掉，避免死循环
    blocks.push(<p key={nextKey('p')} className="my-3">{renderInline(buf.join(' '), nextKey('pi'))}</p>)
  }

  return blocks
}
