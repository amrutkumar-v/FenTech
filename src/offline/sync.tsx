import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getApi } from '@/api/provider'
import { ApiError } from '@/api/errors'
import {
  offlineDb,
  pendingOps,
  markOpSynced,
  markOpFailed,
  markOpConflict,
  resetOpForRetry,
  discardOp,
  cacheMeta,
  type OutboxRow,
} from './db'

/**
 * Sync engine.
 *
 * - Flushes the outbox FIFO whenever the device comes online or the user
 *   triggers a sync.
 * - Each op carries its stable opId; the server acks by opId (idempotent),
 *   so retries never duplicate payments (BR-011, PAY-007, AC-012).
 * - Failures are retried with backoff; conflicts are NEVER auto-resolved —
 *   they wait for operator review (SRS §7.2).
 */

export type Connectivity = 'online' | 'offline' | 'unsupported'

export interface SyncStatus {
  connectivity: Connectivity
  syncing: boolean
  pending: number
  syncingCount: number
  failed: number
  conflicts: number
  lastSyncAt: string | null
  lastError: string | null
}

export interface SyncContextValue {
  status: SyncStatus
  flush: () => Promise<void>
  retry: (opId: string) => Promise<void>
  discard: (opId: string) => Promise<void>
  resolveConflictKeepLocal: (opId: string) => Promise<void>
  listOps: () => Promise<OutboxRow[]>
  refresh: () => Promise<void>
  simulateConflict: (opId: string) => Promise<void>
}

const SyncContext = createContext<SyncContextValue | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [counts, setCounts] = useState({ pending: 0, failed: 0, conflicts: 0, syncingCount: 0 })
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)
  const [connectivity, setConnectivity] = useState<Connectivity>(
    typeof navigator === 'undefined' || 'onLine' in navigator
      ? navigator.onLine
        ? 'online'
        : 'offline'
      : 'unsupported',
  )
  const flushingRef = useRef(false)

  const refresh = useCallback(async () => {
    const meta = await cacheMeta()
    const syncingCount = await offlineDb.outbox.where('syncState').equals('syncing').count()
    setCounts({ ...meta, syncingCount })
  }, [])

  const flush = useCallback(async () => {
    if (flushingRef.current) return
    if (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine) {
      setLastError('Device is offline. Pending records stay queued until you reconnect.')
      return
    }
    flushingRef.current = true
    setSyncing(true)
    setLastError(null)
    try {
      const ops = (await pendingOps()).filter((o) => o.syncState === 'pending' || o.syncState === 'failed')
      if (ops.length === 0) {
        setLastSyncAt(new Date().toISOString())
        return
      }
      // Mark as syncing
      for (const op of ops) {
        await offlineDb.outbox.where('opId').equals(op.opId).modify({ syncState: 'syncing' })
      }
      await refresh()
      const acks = await getApi().syncOperations(
        ops.map((o) => ({ opId: o.opId, kind: o.kind, payload: o.payload, createdAt: o.createdAt })),
      )
      for (const ack of acks) {
        if (ack.status === 'accepted') {
          await markOpSynced(ack.opId, ack.serverId)
        } else if (ack.status === 'conflict') {
          await markOpConflict(
            ack.opId,
            ack.message ?? 'Another device changed this record. Review required — nothing was overwritten.',
          )
        } else {
          await markOpFailed(ack.opId, ack.message ?? 'Server rejected this operation.')
        }
      }
      setLastSyncAt(new Date().toISOString())
      qc.invalidateQueries().catch(() => {})
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Sync failed'
      setLastError(msg)
      for (const op of opsSafe(await pendingOps())) {
        if (op.syncState === 'syncing') await markOpFailed(op.opId, msg)
      }
    } finally {
      flushingRef.current = false
      setSyncing(false)
      await refresh()
    }
  }, [qc, refresh])

  function opsSafe(ops: OutboxRow[]): OutboxRow[] {
    return ops.filter((o) => o.syncState === 'syncing')
  }

  /* connectivity listeners */
  useEffect(() => {
    const on = () => {
      setConnectivity('online')
      void flush()
    }
    const off = () => setConnectivity('offline')
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [flush])

  /* initial + periodic refresh */
  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 15000)
    return () => window.clearInterval(id)
  }, [refresh])

  const retry = useCallback(
    async (opId: string) => {
      await resetOpForRetry(opId)
      await refresh()
      await flush()
    },
    [flush, refresh],
  )

  const discard = useCallback(
    async (opId: string) => {
      await discardOp(opId)
      await refresh()
    },
    [refresh],
  )

  /**
   * Conflict resolution: re-submits the LOCAL payload with force so the
   * server overwrites after explicit human confirmation. The real backend
   * must require this explicit confirmation flag (OD-011).
   */
  const resolveConflictKeepLocal = useCallback(
    async (opId: string) => {
      const row = await offlineDb.outbox.where('opId').equals(opId).first()
      if (!row) return
      await offlineDb.outbox.where('opId').equals(opId).modify({
        syncState: 'pending',
        lastError: undefined,
        payload: { ...(row.payload as object), _forceResolution: 'local_wins_after_review' },
      })
      await refresh()
      await flush()
    },
    [flush, refresh],
  )

  const listOps = useCallback(async () => {
    return offlineDb.outbox.orderBy('localSeq').reverse().toArray()
  }, [])

  /** Dev helper: flag an op as conflicted so the conflict-review UI can be exercised honestly. */
  const simulateConflict = useCallback(
    async (opId: string) => {
      await markOpConflict(
        opId,
        'Simulated conflict (development): another device changed this account while this record was pending.',
      )
      await refresh()
    },
    [refresh],
  )

  const value = useMemo<SyncContextValue>(
    () => ({
      status: { connectivity, syncing, ...counts, lastSyncAt, lastError },
      flush,
      retry,
      discard,
      resolveConflictKeepLocal,
      listOps,
      refresh,
      simulateConflict,
    }),
    [connectivity, syncing, counts, lastSyncAt, lastError, flush, retry, discard, resolveConflictKeepLocal, listOps, refresh, simulateConflict],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync must be used within SyncProvider')
  return ctx
}
