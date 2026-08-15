import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTokenBucket, clientKey } from '@/lib/rate-limit'

describe('createTokenBucket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('允许容量内的突发，随后拒绝并给出重试秒数', () => {
    const limiter = createTokenBucket({ capacity: 2, refillPerMs: 1 / 60_000 })
    expect(limiter.take('a').allowed).toBe(true)
    expect(limiter.take('a').allowed).toBe(true)
    const third = limiter.take('a')
    expect(third.allowed).toBe(false)
    expect(third.retryAfterSec).toBeGreaterThan(0)
  })

  it('按时间补充令牌', () => {
    const limiter = createTokenBucket({ capacity: 1, refillPerMs: 1 / 1000 })
    expect(limiter.take('a').allowed).toBe(true)
    expect(limiter.take('a').allowed).toBe(false)
    vi.advanceTimersByTime(1100) // 补 1 个令牌
    expect(limiter.take('a').allowed).toBe(true)
  })

  it('不同 key 独立计数', () => {
    const limiter = createTokenBucket({ capacity: 1, refillPerMs: 1 / 60_000 })
    expect(limiter.take('a').allowed).toBe(true)
    expect(limiter.take('a').allowed).toBe(false)
    expect(limiter.take('b').allowed).toBe(true)
  })

  it('reset 清空指定 key 恢复配额', () => {
    const limiter = createTokenBucket({ capacity: 1, refillPerMs: 1 / 60_000 })
    limiter.take('a')
    expect(limiter.take('a').allowed).toBe(false)
    limiter.reset('a')
    expect(limiter.take('a').allowed).toBe(true)
  })
})

describe('clientKey', () => {
  it('优先取 x-forwarded-for 首段 IP', () => {
    const req = { headers: new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }) }
    expect(clientKey(req)).toBe('1.2.3.4')
  })

  it('回退 x-real-ip', () => {
    const req = { headers: new Headers({ 'x-real-ip': '9.9.9.9' }) }
    expect(clientKey(req)).toBe('9.9.9.9')
  })

  it('无任何 IP 头时回退 unknown', () => {
    const req = { headers: new Headers() }
    expect(clientKey(req)).toBe('unknown')
  })
})
