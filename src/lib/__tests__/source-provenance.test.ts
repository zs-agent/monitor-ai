import { describe, it, expect, vi, afterEach } from 'vitest'
import { huggingfaceProvider } from '@/lib/sources/huggingface'
import { normalizeRssItem } from '@/lib/sources/rss'
import { normalizeGitHubRepo } from '@/lib/normalizer'
import { signalsToReports } from '@/lib/model-report-mapping'
afterEach(() => vi.unstubAllGlobals())
describe('source provenance and dates', () => {
  it('uses the actual nested HF publication date rather than the ingestion time', async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify([
      {publishedAt:'2026-10-14T20:00:00Z',paper:{id:'2601.12345',title:'Real paper',publishedAt:'2026-10-15T00:00:00Z',upvotes:12}},
      {paper:{id:'2601.23456',title:'Unknown publication date'}},
    ]))))
    const rows=await huggingfaceProvider.fetchSignals('zh')
    expect(rows[0].publishedAt).toBe('2026-10-15T00:00:00Z')
    expect(rows[1].publishedAt).toBe('')
    expect(rows[0].sourcesCount).toBe(1)
    expect(signalsToReports(rows)[0].name).toBe('Real paper')
  })
  it('RSS IDs do not collide for titles sharing a long prefix',()=>{
    const route={route:'/arxiv/cs.AI',category:'papers' as const,credibility:4}
    const a=normalizeRssItem({title:'The same long prefix for article one',link:'https://example.com/1'},route,'en')
    const b=normalizeRssItem({title:'The same long prefix for article two',link:'https://example.com/2'},route,'en')
    expect(a.id).not.toBe(b.id)
    expect(a.publishedAt).toBe('')
  })
  it('a repository is a product even when its description mentions a market or research',()=>{
    expect(normalizeGitHubRepo({id:1,name:'camel-ai/camel',description:'Multi-agent research for a prediction market',url:'https://github.com/camel-ai/camel',stars:100,language:'Python',avatar:null},'zh').category).toBe('products')
  })
})
