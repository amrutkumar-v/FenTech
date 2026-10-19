import Dexie, { type Table } from 'dexie'
import type { OutboxOp, OutboxOpKind } from '@/domain/types'

/**
 * Offline persistence layer (IndexedDB via Dexie).
 *
 * BR-011/BR-012, SRS §7.2:
 *  - Outbox entries get a STABLE unique opId before enqueue — they survive
 *    app restarts and device reboots.
 *  - Sync is idempotent: the server acknowledges by opId; retries never
 *    create duplicates.
 *  - Locally cached entities are labelled provisional until acknowledged.
 */

export interface OutboxRow extends OutboxOp {
  localSeq: number
}

export interface CacheRow {
  key: string
  value: unknown
  updatedAt: string
  provisional: boolean
}

export interface PhotoRow {
  id: string
  blob: Blob
  fileName: string
  contentType: string
  sizeBytes: number
  createdAt: string
  synced: boolean
}

export interface MetaRow {
  key: string
  value: unknown
}

export class OfflineDb extends Dexie {
  outbox!: Table<OutboxRow, number>
  cache!: Table<CacheRow, string>
  photos!: Table<PhotoRow, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('fms-offline')
    this.version(1).stores({
      outbox: '++localSeq, opId, kind, syncState, createdAt',
      cache: 'key, updatedAt',
      photos: 'id, synced, createdAt',
      meta: 'key',
    })
  }
}

export const offlineDb = new OfflineDb()

export function newOpId(): string {
  return crypto.randomUUID()
}

export async function enqueueOp(
  kind: OutboxOpKind,
  payload: unknown,
  actorId: string,
): Promise<OutboxRow> {
  const row: OutboxRow = {
    localSeq: 0, // auto
    opId: newOpId(),
    kind,
    payload,
    createdAt: new Date().toISOString(),
    syncState: 'pending',
    attempts: 0,
    actorId,
  }
  const localSeq = await offlineDb.outbox.add(row)
  return { ...row, localSeq }
}

export async function pendingOps(): Promise<OutboxRow[]> {
  return offlineDb.outbox.where('syncState').anyOf('pending', 'failed', 'conflict').sortBy('localSeq')
}

export async function pendingCount(): Promise<number> {
  return offlineDb.outbox.where('syncState').anyOf('pending', 'syncing', 'failed').count()
}

export async function markOpSynced(opId: string, serverId?: string): Promise<void> {
  await offlineDb.outbox.where('opId').equals(opId).modify({
    syncState: 'synced',
    serverId,
    lastError: undefined,
  })
}

export async function markOpFailed(opId: string, error: string): Promise<void> {
  await offlineDb.outbox.where('opId').equals(opId).modify((row) => {
    row.syncState = 'failed'
    row.attempts += 1
    row.lastError = error
  })
}

export async function markOpConflict(opId: string, error: string): Promise<void> {
  await offlineDb.outbox.where('opId').equals(opId).modify((row) => {
    row.syncState = 'conflict'
    row.attempts += 1
    row.lastError = error
  })
}

export async function resetOpForRetry(opId: string): Promise<void> {
  await offlineDb.outbox.where('opId').equals(opId).modify({ syncState: 'pending', lastError: undefined })
}

export async function discardOp(opId: string): Promise<void> {
  await offlineDb.outbox.where('opId').equals(opId).delete()
}

export async function cacheSet(key: string, value: unknown, provisional = false): Promise<void> {
  await offlineDb.cache.put({ key, value, updatedAt: new Date().toISOString(), provisional })
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const row = await offlineDb.cache.get(key)
  return row?.value as T | undefined
}

export async function cacheMeta(): Promise<{ pending: number; conflicts: number; failed: number }> {
  const [pending, conflicts, failed] = await Promise.all([
    offlineDb.outbox.where('syncState').equals('pending').count(),
    offlineDb.outbox.where('syncState').equals('conflict').count(),
    offlineDb.outbox.where('syncState').equals('failed').count(),
  ])
  return { pending, conflicts, failed }
}
