import { beforeEach, describe, expect, it, vi } from 'vitest'
const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }))
vi.mock('@/lib/fetch-with-timeout', () => ({ fetchWithTimeout: mockFetch }))
import { huggingfaceModelsProvider } from '@/lib/sources/huggingface-models'
beforeEach(() => { mockFetch.mockReset() })
describe('public model records', () => {
  it('ingests concrete model metadata with a stable URL, revision and date', async () => {
    const model = { id: 'lab/Atlas-2', private: false, sha: 'revision123', lastModified: '2026-10-16T00:00:00Z', downloads: 200000, likes: 40, pipeline_tag: 'text-generation', tags: ['license:apache-2.0', 'int4', 'model', 'text-generation'] }
    for (let i = 0; i < 2; i++) mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([model, { ...model, id: 'lab/private', private: true }])))
    const rows = await huggingfaceModelsProvider.fetchSignals('zh')
    expect(rows).toHaveLength(1)
    expect(rows[0].sourceUrl).toBe('https://huggingface.co/lab/Atlas-2')
    expect(new Set(rows[0].tags).size).toBe(rows[0].tags.length)
    expect(rows[0].category).toBe('models')
    expect(rows[0].language).toBe('zh')
    expect(rows[0].summary).toContain('revision123')
    expect(rows[0].publishedAt).toBe(model.lastModified)
    expect(rows[0].importance).toBeGreaterThanOrEqual(4)
  })
  it('does not replace failed acquisition with invented model records', async () => {
    mockFetch.mockRejectedValue(new Error('offline'))
    await expect(huggingfaceModelsProvider.fetchSignals('zh')).rejects.toThrow()
  })
})
