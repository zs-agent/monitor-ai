import { createTokenBucket } from '@/lib/rate-limit'

/**
 * /api/insights 的限流配置（进程内内存令牌桶）。
 * POST（强制重新生成）代价最高：5 分类 × 1 次 LLM 调用，公开可打，配置 Key 即产生真实费用。
 * 双保险：按 IP 限流 + 全局总量限流，未配置 Key 时同样不可刷。
 */
export const postPerIp = createTokenBucket({ capacity: 3, refillPerMs: 1 / 60_000 }) // 3 次突发，随后 1 次/分钟/IP
export const postGlobal = createTokenBucket({ capacity: 12, refillPerMs: 1 / 30_000 }) // 全局 12 次突发，随后 2 次/分钟

/** GET 已有 30min 快照 + 单飞锁兜底，放宽限流只拦明显滥用（自动刷新为 5 分钟一次） */
export const getPerIp = createTokenBucket({ capacity: 60, refillPerMs: 1 / 1000 }) // 60 次突发，随后 1 次/秒/IP

/** 供测试重置限流状态 */
export function resetInsightsRateLimiters(): void {
  postPerIp.reset()
  postGlobal.reset()
  getPerIp.reset()
}
