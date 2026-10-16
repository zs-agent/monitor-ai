import { beforeEach, describe, expect, it, vi } from 'vitest'
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }))
vi.mock('@/lib/fetch-with-timeout', () => ({ fetchWithTimeout: mockFetch }))
vi.mock('@/lib/star-snapshot', () => ({ createStarSnapshot: () => ({ record: () => 0 }) }))
import { huggingfaceProvider } from '@/lib/sources/huggingface'
import { hackernewsProvider } from '@/lib/sources/hackernews'
import { githubProvider } from '@/lib/sources/github'
import { semanticscholarProvider } from '@/lib/sources/semanticscholar'
beforeEach(() => { mockFetch.mockReset() })

describe('expanded feeds', () => {
  it('keeps HF papers beyond 15 and returns only the requested language', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ paper: { id: '2601.' + i, title: 'Paper ' + i, createdAt: '2026-10-16T00:00:00Z' } })))))
    const records = await huggingfaceProvider.fetchSignals('zh')
    expect(records).toHaveLength(50)
    expect(new Set(records.map(row => row.language))).toEqual(new Set(['zh']))
  })
  it('uses the HN search index and does not match ai inside unrelated words', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ hits: [
      { objectID: '1', title: 'AI tools', author: 'a', created_at_i: 1792000000 },
      { objectID: '2', title: 'Chair design', author: 'b', created_at_i: 1792000000 },
    ] })))
    const records = await hackernewsProvider.fetchSignals('zh')
    expect(records).toHaveLength(1)
    expect(records[0].language).toBe('zh')
    expect(mockFetch.mock.calls[0][0]).toContain('hitsPerPage=100')
  })
  it('loads 100 GitHub projects using valid topic queries', async () => {
    for (const offset of [0, 50]) mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      items: Array.from({ length: 50 }, (_, i) => ({
        id: i + offset, full_name: 'org/repo' + (i + offset), html_url: 'https://github.com/org/repo' + (i + offset), pushed_at: '2026-10-16T00:00:00Z', stargazers_count: 1,
      })),
    })))
    expect(await githubProvider.fetchSignals('zh')).toHaveLength(100)
    expect(mockFetch.mock.calls.every(([url]) => !decodeURIComponent(url).includes(' OR '))).toBe(true)
  })
  it('requests an expanded S2 batch instead of silently staying at 10', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ data: [] })))
    await semanticscholarProvider.fetchSignals('zh')
    expect(mockFetch.mock.calls[0][0]).toContain('limit=100')
  })
})
