import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/fetch-with-timeout'

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('passes headers and returns response on success', async () => {
    const mockRes = new Response('ok', { status: 200 })
    global.fetch = vi.fn().mockResolvedValue(mockRes)
    const res = await fetchWithTimeout('https://example.com', {}, 5000)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toBe('ok')
    // Verify User-Agent header was set
    const callArgs = (global.fetch as any).mock.calls[0]
    expect(callArgs[1].headers.get('User-Agent')).toBe('monitor-ai/1.0')
  })

  it('throws FetchTimeoutError with correct timeout value', () => {
    const err = new FetchTimeoutError(5000)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('FetchTimeoutError')
    expect(err.timeoutMs).toBe(5000)
    expect(err.message).toContain('5000')
  })
})
