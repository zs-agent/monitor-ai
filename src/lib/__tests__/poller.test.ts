import { afterEach, expect, it, vi } from 'vitest'
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn(async (...args: unknown[]) => { void args; return { signals: [], fetchedAt: 0, sourceHealth: {} } }) }))
vi.mock('@/lib/aggregate', () => ({ refreshLocale: refresh }))
vi.mock('@/lib/sources', () => ({ providers: [{ id: 'one', pollIntervalMs: 1000, fetchSignals: async () => [] }] }))
import { ensurePollerStarted } from '@/lib/poller'

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  delete (globalThis as typeof globalThis & { __monitorSignalPoller?: unknown }).__monitorSignalPoller
  refresh.mockClear()
})
it('does not duplicate polling intervals across repeated setup', async () => {
  vi.useFakeTimers()
  ensurePollerStarted()
  ensurePollerStarted()
  expect(vi.getTimerCount()).toBe(1)
  expect(refresh).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(1000)
  expect(refresh).toHaveBeenCalledTimes(4)
})
it('hot-reload rebinds callbacks and invalidates an obsolete in-flight generation', async () => {
  vi.useFakeTimers()
  ensurePollerStarted()
  const guard = refresh.mock.calls[0]?.[2] as unknown as () => boolean
  expect(guard()).toBe(true)
  vi.resetModules()
  const fresh = await import('@/lib/poller')
  // A new compiled aggregate module function would invalidate the old guard.
  const store = globalThis as typeof globalThis & { __monitorSignalPoller: { refresh: unknown } }
  store.__monitorSignalPoller.refresh = () => Promise.resolve()
  fresh.ensurePollerStarted()
  expect(guard()).toBe(false)
  expect(vi.getTimerCount()).toBe(1)
})
