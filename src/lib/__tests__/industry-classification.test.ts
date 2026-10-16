import { it, expect } from 'vitest'
import { normalizeHNSignal } from '@/lib/normalizer'
const classify=(title:string)=>normalizeHNSignal({id:1,title,url:'https://example.com',by:'a',score:1,descendants:0,time:1},'zh').category
it.each([
  'Investors dump data centre bonds as AI borrowers face Darwin moment',
  "Volta's $5B debt deal is a pulse check on the AI-financing boom",
  'Major AI Copyright Ruling Lawyer Explains',
  'Europe Is Financing the US AI Buildout',
  'Character.ai files for bankruptcy following suits',
  'Call Center Jobs Are Declining, but Humans Still Outperform AI',
])('recognizes industry headline: %s',title=>expect(classify(title)).toBe('industry'))
it('separates a demonstrated product from general model discussion',()=>{
  expect(classify('Show HN: Space – an AI agent sandbox')).toBe('products')
  expect(classify('AI Research Tools – Literature Discovery and LaTeX')).toBe('products')
  expect(classify('GPT model release')).toBe('models')
  expect(classify('How to build an LLM tutorial')).toBe('tips')
})
