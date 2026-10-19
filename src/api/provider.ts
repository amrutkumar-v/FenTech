import type { ApiClient } from './contracts'
import { MockAdapter } from './mock/adapter'
import { HttpAdapter } from './http/adapter'

/**
 * API mode selection.
 *  - VITE_API_MODE=mock (or .env.mock) → in-browser mock server with DEMO fixtures
 *  - VITE_API_MODE=http               → real backend at VITE_API_BASE_URL
 * Defaults to mock until a backend exists, so the app is never silently
 * pointed at a missing server. A persistent banner reminds the user when the
 * mock adapter is active.
 */
const mode = (import.meta.env.VITE_API_MODE as string | undefined) ?? 'mock'

let client: ApiClient | null = null

export function getApi(): ApiClient {
  if (!client) {
    client = mode === 'http' ? new HttpAdapter() : new MockAdapter()
  }
  return client
}

export function isMockMode(): boolean {
  return getApi().mode === 'mock'
}

/** Test hook. */
export function __setApiForTests(c: ApiClient | null): void {
  client = c
}
