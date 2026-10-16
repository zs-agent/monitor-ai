import { beforeEach, describe, expect, it, vi } from 'vitest'
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }))
vi.mock('@/lib/fetch-with-timeout', () => ({ fetchWithTimeout: mockFetch }))

const model = { name: 'Test Model', modelCreatorName: 'Test Lab', intelligenceIndex: 30, deprecated: false,
  terminalBench40: .6, tau2: .8, price1mInputTokens: .1, price1mOutputTokens: .4, contextWindowTokens: 100000, isOpenWeights: true }
function html(rows: unknown[]) {
  return '<script>self.__next_f.push([1,' + JSON.stringify('x:{"models":' + JSON.stringify(rows) + ',"messages":{}}') + '])</script>'
}
async function boards(rows: unknown[]) {
  mockFetch.mockResolvedValue(new Response(html(rows)))
  const { GET } = await import('@/app/api/arena/route')
  return (await (await GET()).json()).boards
}
beforeEach(() => { vi.resetModules(); mockFetch.mockReset() })

describe('Artificial Analysis current page fields', () => {
  it('renders coding results from the current Terminal-Bench version', async () => {
    const result = await boards([model])
    const board = result.find((b: { dimension: string }) => b.dimension === '编程能力')
    expect(board.entries[0]?.score).toBe('60.0%')
    expect(board.source).toContain('Terminal-Bench 4.0')
  })
  it('renders tool use with the actual benchmark name and success rate', async () => {
    const result = await boards([model])
    const board = result.find((b: { dimension: string }) => b.dimension === 'Agent 工具调用')
    expect(board.entries[0]?.score).toBe('80.0%')
    expect(board.source).toContain('Telecom')
  })
  it('shows input and output prices without inventing a blended rate', async () => {
    const result = await boards([model])
    const board = result.find((b: { dimension: string }) => b.dimension === 'API 成本')
    expect(board.entries[0]?.score).toContain('$0.1')
    expect(board.entries[0]?.score).toContain('$0.4')
    expect(board.methodology).toContain('输入')
    expect(board.methodology).not.toContain('7:2:1')
  })
  it('does not treat missing measurements as zero or keep deprecated entries', async () => {
    const result = await boards([model, { ...model, name: 'Retired', deprecated: true, terminalBench40: 1 },
      { ...model, name: 'Unmeasured', terminalBench40: '$undefined' }])
    expect(result.find((b: { dimension: string }) => b.dimension === '编程能力').entries.map((e: { model: string }) => e.model)).toEqual(['Test Model'])
  })
  it('reports unavailable metrics rather than silently presenting an empty live board', async () => {
    const result = await boards([{ name: 'Only overall', intelligenceIndex: 20 }])
    const board = result.find((b: { dimension: string }) => b.dimension === 'Agent 工具调用')
    expect(board.entries).toEqual([])
    expect(board.unavailableReason).toBeTruthy()
  })
})
