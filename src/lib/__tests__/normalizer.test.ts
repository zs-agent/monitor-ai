import { describe, it, expect } from 'vitest'
import { normalizeHNSignal, normalizeHFPaper, normalizeGitHubRepo, normalizeS2Paper, inferCountry, sourceCredibility } from '@/lib/normalizer'

describe('inferCountry', () => {
  it('detects Chinese content', () => {
    expect(inferCountry('中文标题')).toBe('CN')
  })
  it('detects US companies', () => {
    expect(inferCountry('Anthropic releases Claude')).toBe('US')
    expect(inferCountry('OpenAI GPT-5')).toBe('US')
    expect(inferCountry('Google Gemini')).toBe('US')
  })
  it('returns UN for unknown', () => {
    expect(inferCountry('General tech news')).toBe('UN')
  })
})

describe('sourceCredibility', () => {
  it('returns correct credibility for known sources', () => {
    expect(sourceCredibility('hackernews')).toBe(3)
    expect(sourceCredibility('huggingface')).toBe(4)
    expect(sourceCredibility('github')).toBe(3)
    expect(sourceCredibility('semanticscholar')).toBe(4)
  })
  it('returns 2 for unknown sources', () => {
    expect(sourceCredibility('unknown')).toBe(2)
  })
})

describe('normalizeHNSignal', () => {
  const item = { id: 123, title: 'Anthropic releases Claude', url: 'https://example.com', by: 'user1', score: 250, descendants: 50, time: 1720000000 }
  const signal = normalizeHNSignal(item, 'en')
  it('creates valid signal id', () => {
    expect(signal.id).toBe('hn-123')
  })
  it('includes country and credibility', () => {
    expect(signal.country).toBe('US')
    expect(signal.credibility).toBe(3)
  })
  it('sets correct category based on keywords', () => {
    expect(signal.category).toBe('models')
  })
})

describe('normalizeHFPaper', () => {
  const paper = { id: 'hf-abc', title: 'Deep Learning Advances', url: 'https://huggingface.co/papers/abc', upvotes: 300, createdAt: '2026-07-25T00:00:00Z' }
  const signal = normalizeHFPaper(paper, 'en')
  it('creates valid signal', () => {
    expect(signal.id).toBe('hf-abc')
    expect(signal.category).toBe('papers')
    expect(signal.credibility).toBe(4)
  })
})

describe('normalizeGitHubRepo', () => {
  const repo = { id: 1, name: 'user/repo', description: 'An AI tool', url: 'https://github.com/user/repo', stars: 500, language: 'Python', avatar: null, pushedAt: '2026-07-24T00:00:00Z' }
  const signal = normalizeGitHubRepo(repo, 'en')
  it('creates valid signal', () => {
    expect(signal.id).toBe('gh-1')
    expect(signal.source).toBe('GitHub')
    expect(signal.country).toBe('UN')
  })
})

describe('normalizeS2Paper', () => {
  const paper = { id: 'abc123', title: 'LLM Survey', url: 'https://semanticscholar.org/paper/abc123', date: '2026-07-01', citations: 150, authors: ['Alice', 'Bob'], summary: 'A comprehensive survey.' }
  const signal = normalizeS2Paper(paper, 'en')
  it('creates valid signal', () => {
    expect(signal.id).toBe('s2-abc123')
    expect(signal.source).toBe('Semantic Scholar')
    expect(signal.credibility).toBe(4)
  })
})
