/**
 * 内存令牌桶限流：按 key（如客户端 IP）限速，用于无鉴权公开接口的兜底防刷。
 * 注意：仅进程内有效，standalone 单进程部署下够用；多实例部署请改用 Redis 等共享存储。
 */
interface TokenBucket {
  tokens: number
  lastRefill: number
}

export interface RateLimitResult {
  allowed: boolean
  /** 被拒时应返回给客户端的 Retry-After 秒数 */
  retryAfterSec?: number
}

export interface RateLimiter {
  take(key: string): RateLimitResult
  reset(key?: string): void
}

export function createTokenBucket(options: { capacity: number; refillPerMs: number }): RateLimiter {
  const buckets = new Map<string, TokenBucket>()

  return {
    take(key: string): RateLimitResult {
      const now = Date.now()
      let bucket = buckets.get(key)
      if (!bucket) {
        bucket = { tokens: options.capacity, lastRefill: now }
        buckets.set(key, bucket)
      }

      // 按时间补充令牌（封顶到容量）
      const elapsed = now - bucket.lastRefill
      bucket.tokens = Math.min(options.capacity, bucket.tokens + elapsed * options.refillPerMs)
      bucket.lastRefill = now

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1
        return { allowed: true }
      }
      const retryAfterSec = Math.max(1, Math.ceil((1 - bucket.tokens) / options.refillPerMs / 1000))
      return { allowed: false, retryAfterSec }
    },

    reset(key?: string): void {
      if (key) buckets.delete(key)
      else buckets.clear()
    },
  }
}

/** 从请求头提取客户端标识：优先 x-forwarded-for 首段真实 IP，缺省回退 x-real-ip / unknown */
export function clientKey(req: { headers: Headers }): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0].trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip') || 'unknown'
}
