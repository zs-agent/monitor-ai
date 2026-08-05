export class FetchTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`)
    this.name = 'FetchTimeoutError'
  }
}

/** fetch 封装：带超时与统一 User-Agent。超时抛出 FetchTimeoutError。 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const headers = new Headers(init.headers)
    if (!headers.has('User-Agent')) headers.set('User-Agent', 'monitor-ai/1.0')
    return await fetch(url, { ...init, headers, signal: controller.signal })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new FetchTimeoutError(timeoutMs)
    throw e
  } finally {
    clearTimeout(timer)
  }
}
