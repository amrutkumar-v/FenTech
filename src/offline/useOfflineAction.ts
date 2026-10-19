import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'
import { enqueueOp } from './db'
import type { OutboxOpKind } from '@/domain/types'
import { useSync } from './sync'
import { useAuth } from '@/features/auth/AuthProvider'

export interface ActionResult<T> {
  data: T | null
  /** true when saved locally only — NOT yet confirmed by the server (SRS 7.2). */
  pendingSync: boolean
  opId?: string
}

export interface OfflineActionOptions<TInput, TOut> {
  kind: OutboxOpKind
  /** Direct API call used when online. */
  online: (input: TInput) => Promise<TOut>
  /** Payload stored in the outbox for later sync — MUST match the server contract. */
  toPayload: (input: TInput) => unknown
  successMessage?: string | ((input: TInput, pending: boolean) => string)
  invalidate?: string[][]
}

/**
 * Runs a financial write action with offline-first semantics:
 *  - Online: straight to the API. Server is authoritative.
 *  - Offline: enqueued in IndexedDB with a STABLE opId. UI must present the
 *    record as "Pending sync" — never as confirmed.
 *
 * Duplicate submission is prevented by disabling the trigger while busy and
 * by the stable opId (server dedupes retries).
 */
export function useOfflineAction<TInput, TOut>(opts: OfflineActionOptions<TInput, TOut>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const qc = useQueryClient()
  const { status, flush } = useSync()
  const { user } = useAuth()

  const run = useCallback(
    async (input: TInput): Promise<ActionResult<TOut>> => {
      setBusy(true)
      setError(null)
      try {
        if (status.connectivity === 'offline') {
          const row = await enqueueOp(opts.kind, opts.toPayload(input), user?.id ?? 'unknown')
          qc.invalidateQueries({ queryKey: ['sync-badge'] }).catch(() => {})
          return { data: null, pendingSync: true, opId: row.opId }
        }
        const data = await opts.online(input)
        if (opts.invalidate) {
          for (const key of opts.invalidate) qc.invalidateQueries({ queryKey: key }).catch(() => {})
        }
        return { data, pendingSync: false }
      } catch (err) {
        if (err instanceof ApiError) setError(err)
        else
          setError(
            new ApiError('unknown', err instanceof Error ? err.message : 'Action failed.', { cause: err }),
          )
        throw err
      } finally {
        setBusy(false)
      }
    },
    [opts, qc, status.connectivity, user?.id],
  )

  /** After a pending save, try an immediate flush when back online. */
  const runAndFlush = useCallback(
    async (input: TInput): Promise<ActionResult<TOut>> => {
      const result = await run(input)
      if (result.pendingSync && status.connectivity === 'online') {
        void flush()
      }
      return result
    },
    [run, flush, status.connectivity],
  )

  return { run, runAndFlush, busy, error, resetError: () => setError(null) }
}
