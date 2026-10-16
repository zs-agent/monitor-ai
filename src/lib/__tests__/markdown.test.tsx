import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/markdown'

// 手写渲染器的边界最容易出回归（LLM 报告里标题/列表/表格/代码块混排），
// 这里锁住"块级识别 + 行内替换 + 不乱吃行"三类行为。
function html(source: string): string {
  return renderToStaticMarkup(<>{renderMarkdown(source)}</>)
}

describe('renderMarkdown', () => {
  it('模型生成的非HTTP链接不具有可执行href', () => {
    expect(html('[恶意](javascript:alert)')).not.toContain('href=')
    expect(html('[恶意](data:text/html,x)')).not.toContain('href=')
    expect(html('[来源](https://example.com)')).toContain('href="https://example.com"')
  })
  it('渲染多级标题', () => {
    const out = html('# 一级\n\n## 二级\n\n### 三级')
    expect(out).toContain('一级')
    expect(out).toContain('text-[14px] font-semibold')  // 二级带下边框
    expect(out).toContain('uppercase')                  // 三级为小标签
  })

  it('渲染无序与有序列表', () => {
    expect(html('- 甲\n- 乙')).toContain('<ul')
    const ordered = html('1. 甲\n2. 乙')
    expect(ordered).toContain('<ol')
    expect(ordered.match(/<li/g)?.length).toBe(2)
  })

  it('列表续行并入上一项，不另起段落', () => {
    const out = html('- 甲段落\n  换行续写\n- 乙')
    expect(out.match(/<li/g)?.length).toBe(2)
    expect(out).toContain('甲段落 换行续写')
  })

  it('表格：有分隔行才当表格，并去掉外框竖线', () => {
    const out = html('| 指标 | 值 |\n| --- | --- |\n| 良率 | 92% |')
    expect(out).toContain('<table')
    expect(out).toContain('<th')
    expect(out).toContain('良率')
    expect(out).not.toContain('| 良率')

    // 没有分隔行的竖线只是普通文本
    expect(html('A | B')).not.toContain('<table')
  })

  it('代码块保留原文，mermaid 走图示通道', () => {
    const code = html('```python\nprint("hi")\n```')
    expect(code).toContain('<pre')
    expect(code).toContain('print(&quot;hi&quot;)')

    const mermaid = html('```mermaid\ngraph TD\n  A-->B\n```')
    expect(mermaid).toContain('<figure')
    expect(mermaid).toContain('渲染图示')  // effect 未跑（静态渲染）时的占位
  })

  it('行内样式：粗体、行内码、链接', () => {
    const out = html('见 **重点** 与 `code` 以及 [来源](https://example.com/a?b=1)')
    expect(out).toContain('<strong')
    expect(out).toContain('<code')
    expect(out).toContain('href="https://example.com/a?b=1"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('target="_blank"')
  })

  it('引用与分隔线', () => {
    expect(html('> 结论要有来源')).toContain('<blockquote')
    expect(html('甲\n\n---\n\n乙')).toContain('<hr')
  })

  it('不认识的残行也会被消费（不死循环、不丢内容）', () => {
    const out = html('普通段落\n\n#\n\n尾段')
    expect(out).toContain('普通段落')
    expect(out).toContain('尾段')
  })
})
