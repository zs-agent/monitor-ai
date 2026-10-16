import { it, expect, vi, afterEach } from 'vitest'
import type { Signal } from '@/types/signal'
const mocks = vi.hoisted(() => ({ aggregate: vi.fn(), generate: vi.fn() }))
vi.mock('@/lib/aggregate',()=>({ aggregateSignals:mocks.aggregate }))
vi.mock('@/lib/insights/llm',()=>({ generateInsight:mocks.generate }))
import { getInsights, resetInsights } from '@/lib/insights/pipeline'
const row=(id:string):Signal=>({id,title:'model '+id,summary:'',source:'test',sourceUrl:'https://example.com/'+id,publishedAt:new Date().toISOString(),category:'models',country:'UN',credibility:3,tags:[],importance:4,sourcesCount:1,language:'zh'})
afterEach(()=>{resetInsights();vi.restoreAllMocks()})
it('feed changes invalidate a fresh insight cache and true force regenerates',async()=>{
  let rows=[row('a')]
  mocks.aggregate.mockImplementation(async()=>({signals:rows,fromCache:true,staleUsed:false,fallbackMock:false,sourceHealth:{},fetchedAt:Date.now()}))
  mocks.generate.mockResolvedValue('a summary')
  const first=await getInsights('zh',false,'all','model')
  expect(first.insights[0].coveredCount).toBe(1)
  rows=[...rows,row('b')]
  mocks.generate.mockResolvedValue('updated summary')
  const second=await getInsights('zh',false,'all','model')
  expect(second.insights[0].coveredCount).toBe(2)
  expect(second.insights[0].text).toBe('updated summary')
  mocks.generate.mockResolvedValue('forced summary')
  expect((await getInsights('zh',true,'all','model')).insights[0].text).toBe('forced summary')
})
it('summary source IDs include only the actual sample sent to the model',async()=>{
  const rows=Array.from({length:30},(_,i)=>row(String(i)))
  mocks.aggregate.mockResolvedValue({signals:rows,fromCache:true,staleUsed:false,fallbackMock:false,sourceHealth:{},fetchedAt:Date.now()})
  mocks.generate.mockResolvedValue('summary')
  const result=await getInsights('zh',true,'all','model')
  expect(result.insights[0].coveredCount).toBe(30)
  expect(result.insights[0].basedOnSignalIds).toHaveLength(20)
  expect(result.insights[0].summarizedCount).toBe(20)
  expect(mocks.generate.mock.calls.at(-1)?.[1]).toHaveLength(20)
})
