import type { Signal } from '@/types/signal'

export interface SignalProvider {
  /** 数据源唯一标识，如 'hackernews' */
  readonly id: string
  /** 展示名称，如 'Hacker News' */
  readonly name: string
  /** 拉取并归一化为 Signal 数组。失败时应抛出异常（由聚合层降级），不要返回 mock。 */
  fetchSignals(locale: 'zh' | 'en'): Promise<Signal[]>
}
