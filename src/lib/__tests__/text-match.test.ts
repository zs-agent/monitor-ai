import { describe, expect, it } from 'vitest'
import { entityTokens, keywordRegex, matchedKeywords, matchesKeyword, normEntityName, sameEntity } from '@/lib/text-match'

describe('text-match', () => {
  it('拉丁关键词要求词边界，不吃别的单词的子串', () => {
    expect(matchesKeyword('the laws of physics', 'aws')).toBe(false)
    expect(matchesKeyword('aws bedrock update', 'aws')).toBe(true)
    expect(matchesKeyword('how to cook apples', 'apple')).toBe(false)
    expect(matchesKeyword('apple intelligence ships', 'apple')).toBe(true)
    // 这次线上暴露的 case：pro 不该命中 improve / proposes
    expect(matchesKeyword('improved readability of leaflets', 'pro')).toBe(false)
    expect(matchesKeyword('the paper proposes a taxonomy', 'pro')).toBe(false)
    expect(matchesKeyword('deepseek pro released', 'pro')).toBe(true)
  })

  it('以连字符/数字结尾的关键词照常命中', () => {
    expect(matchesKeyword('shipping gpt-6 today', 'gpt-')).toBe(true)
    expect(keywordRegex('chatgpt').test('using chatgpt daily')).toBe(true)
    expect(keywordRegex('claude').test('declauded text')).toBe(false)
  })

  it('中日韩关键词按子串匹配', () => {
    expect(matchesKeyword('阿里发布新模型', '阿里')).toBe(true)
    expect(matchedKeywords('qwen 3 max beats gpt-6', ['alibaba', 'qwen', 'gpt-'])).toEqual(['qwen', 'gpt-'])
  })

  it('实体名切词会丢掉短 token 与停用词', () => {
    expect(entityTokens('DeepSeek-V4-Pro-Qwen3.5-9B-MTP-GGUF')).toEqual(['deepseek', 'qwen3'])
    expect(entityTokens('Role of Large Language Model-Artificial Intelligence in Care')).toEqual(['role', 'care'])
  })

  it('实体名归一化后可跨写法比对', () => {
    expect(normEntityName('DeepSeek-V3.2 系列')).toBe('deepseekv3.2')
    expect(sameEntity('DeepSeek-V3.2 系列', 'DeepSeek V3.2')).toBe(true)
    expect(sameEntity('Qwen3 系列', 'qwen3')).toBe(true)
    expect(sameEntity('GPT', 'GPT-6')).toBe(false)   // 太短，避免过度匹配
  })
})
