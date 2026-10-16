import { describe, it, expect, vi } from 'vitest'
import { filterSignalScope, matchesQueries, selectFocusSignals, modelCatalog } from '@/lib/browse-data'
import { validBrowseViews } from '@/lib/saved-browse-view'
import { mentionsEntity, sameEntity } from '@/lib/text-match'
import { normalizeHNSignal } from '@/lib/normalizer'
import { buildCategory } from '@/lib/insights/pipeline'
import * as llm from '@/lib/insights/llm'
import type { Signal } from '@/types/signal'
const now = Date.parse('2026-10-16T08:00:00Z')
const signal = (id: string, extra: Partial<Signal> = {}): Signal => ({
  id, title: id, summary: '', source: 'test', sourceUrl: 'https://example.com/'+id,
  publishedAt: new Date(now-1000).toISOString(), category: 'models', country: 'UN',
  credibility: 3, tags: [], importance: 4, sourcesCount: 1, language: 'zh', ...extra,
})
describe('dashboard retrieval regressions', () => {
  it('rejects corrupt saved views before they can crash rendering', () => {
    expect(validBrowseViews({})).toBe(false)
    expect(validBrowseViews([{}])).toBe(false)
    expect(validBrowseViews([])).toBe(true)
  })
  it('combines independent filters without requiring a contiguous phrase', () => {
    expect(matchesQueries('Qwen launches a new release', 'release', 'qwen')).toBe(true)
    expect(matchesQueries('Qwen launch', 'release', 'qwen')).toBe(false)
  })
  it('time windows exclude future and unknown dates', () => {
    const rows = [signal('recent'), signal('future',{publishedAt:new Date(now+86400000).toISOString()}),signal('unknown',{publishedAt:''}),signal('old',{publishedAt:new Date(now-8*86400000).toISOString()})]
    expect(filterSignalScope(rows,'7d',now).map(s=>s.id)).toEqual(['recent'])
    expect(filterSignalScope(rows,'all',now)).toHaveLength(4)
  })
  it('focus defaults to six and supports a larger selection', () => {
    const rows=Array.from({length:12},(_,i)=>signal(String(i)))
    expect(selectFocusSignals(rows).length).toBe(6)
    expect(selectFocusSignals(rows,10).length).toBe(10)
  })
  it('model catalog separates historical references and excludes generic papers', () => {
    const model={id:'m',name:'Qwen3',vendor:'Qwen',type:'开源权重' as const,date:'2026-10-16',sourceUrl:'https://huggingface.co/Qwen/Qwen3',keyChange:'',usageImpact:''}
    const paper={...model,id:'p',type:'论文' as const,sourceUrl:'https://arxiv.org/abs/1'}
    expect(modelCatalog([model,paper],[{...model,id:'old',sourceUrl:'https://example.com/old'}]).map(m=>m.id)).toEqual(['m'])
    expect(modelCatalog([model],[{...model,id:'old'}],true)).toHaveLength(1)
  })
  it('does not borrow scores from another version or variant', () => {
    expect(sameEntity('DeepSeek V3','DeepSeek V3.2')).toBe(false)
    expect(sameEntity('DeepSeek V3.2','DeepSeek V32')).toBe(false)
    expect(sameEntity('Claude Opus 4.5','Claude Opus 4.5.1')).toBe(false)
    expect(sameEntity('Qwen3-8B','Qwen3-8B-AWQ')).toBe(false)
    expect(mentionsEntity('DeepSeek V3.2 changes', 'DeepSeek-V3.2')).toBe(true)
    expect(mentionsEntity('DeepSeek V3.2 changes', 'DeepSeek-V3')).toBe(false)
    expect(mentionsEntity('Qwen30 is here','Qwen3')).toBe(false)
    expect(sameEntity('DeepSeek-V3.2 系列','DeepSeek V3.2')).toBe(true)
  })
  it('separates tutorials and industry news from model name mentions', () => {
    const hn=(title:string)=>normalizeHNSignal({id:1,title,url:'https://example.com',by:'a',score:800,descendants:12,time:now/1000},'zh')
    expect(hn('How to build an LLM agent tutorial').category).toBe('tips')
    expect(hn('GPT company raises funding').category).toBe('industry')
    expect(hn('Investigating a flaw in an app').category).not.toBe('industry')
    expect(hn('Popular GPT release').sourcesCount).toBe(1)
  })
})
describe('insight evidence and refresh', () => {
  it('a changed input never relabels an old summary as based on new evidence', async()=>{
    const spy=vi.spyOn(llm,'generateInsight').mockResolvedValue(null)
    try {
      const result=await buildCategory('models',[signal('new')],{category:'models',text:'old claim',generatedAt:'2025-01-01',basedOnSignalIds:['old'],coveredCount:1})
      expect(result.text).toBe('')
      expect(result.signalTitles).toContain('new')
    } finally { spy.mockRestore() }
  })
  it('force refresh actually regenerates unchanged content',async()=>{
    const spy=vi.spyOn(llm,'generateInsight').mockResolvedValue('first')
    try {
      const first=await buildCategory('models',[signal('a')],undefined)
      spy.mockResolvedValue('second')
      const second=await buildCategory('models',[signal('a')],first,true)
      expect(second.text).toBe('second')
      expect(spy).toHaveBeenCalledTimes(2)
    } finally { spy.mockRestore() }
  })
})
