import { describe, expect, it } from 'vitest'
import { readIndexCount, mergeIndexResult } from '@/lib/public-coverage'

describe('public source totals', () => {
  it('reads index totals rather than a sampled result length', () => {
    expect(readIndexCount('papers', { meta: { count: 3651378 }, results: [{}] }).count).toBe(3651378)
    expect(readIndexCount('projects', { total_count: 51496, incomplete_results: true, items: [{}] })).toEqual({ count: 51496, approximate: true })
    expect(readIndexCount('models', '<div data-props="{&quot;numTotalItems&quot;:3157508}">').count).toBe(3157508)
  })
  it('rejects absent, negative and unsafe totals instead of inventing zero', () => {
    for (const count of [undefined, -1, 1.2, Infinity, '12', Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => readIndexCount('papers', { meta: { count } })).toThrow()
    }
    expect(() => readIndexCount('models', '<div>30 models on page</div>')).toThrow()
    expect(() => readIndexCount('models', '<div>{"numTotalItems":3.1}</div>')).toThrow()
    expect(readIndexCount('papers', { meta: { count: 0 } }).count).toBe(0)
  })
  it('retains last successful observation and marks refresh failures stale', () => {
    const old = mergeIndexResult('papers', { count: 200, approximate: false }, undefined, '2026-10-15T00:00:00Z')
    const failed = mergeIndexResult('papers', null, old, '2026-10-16T00:00:00Z')
    expect(failed.count).toBe(200)
    expect(failed.observedAt).toBe(old.observedAt)
    expect(failed.status).toBe('stale')
    expect(mergeIndexResult('projects', null, undefined, '2026-10-16T00:00:00Z').count).toBeNull()
  })
})
