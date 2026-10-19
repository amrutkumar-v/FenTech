import { useEffect, useState } from 'react'
import { CloudUpload, RefreshCw, Trash2, AlertTriangle, CheckCircle2, WifiOff, Wifi } from 'lucide-react'
import { PageHeader, Card, CardHeader, Stat } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { SyncBadge } from '@/ui/Badge'
import { EmptyState, PermissionDenied } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { useSync } from '@/offline/sync'
import { useAuth } from '@/features/auth/AuthProvider'
import type { OutboxRow } from '@/offline/db'

export default function SyncSettingsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const { status, flush, retry, discard, listOps, refresh, resolveConflictKeepLocal } = useSync()
  const [ops, setOps] = useState<OutboxRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  async function reload() {
    setOps(await listOps())
    await refresh()
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.pending, status.failed, status.conflicts])

  if (!can('settings:sync')) {
    return (
      <div>
        <PageHeader title="Sync status" />
        <PermissionDenied message="Sync administration is admin-only (SEC-002, OD-014)." />
      </div>
    )
  }

  const conflictOps = ops.filter((o) => o.syncState === 'conflict')

  async function onFlush() {
    await flush()
    await reload()
    toast.success('Sync attempt complete', status.lastError ?? undefined)
  }

  async function onRetry(opId: string) {
    setBusy(opId)
    try {
      await retry(opId)
      await reload()
      toast.success('Op requeued for sync')
    } finally {
      setBusy(null)
    }
  }

  async function onDiscard(opId: string) {
    if (!window.confirm('Discard this unsynced operation? Data captured offline will be lost and cannot be recovered.')) return
    setBusy(opId)
    try {
      await discard(opId)
      await reload()
      toast.warning('Operation discarded', 'The local change was removed without reaching the server.')
    } finally {
      setBusy(null)
    }
  }

  async function onKeepLocal(opId: string) {
    setBusy(opId)
    try {
      await resolveConflictKeepLocal(opId)
      await reload()
      toast.success('Local version kept', 'The server will be updated with your version after review.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Sync status"
        subtitle="Offline-first: records saved on this device are queued with a stable client-side opId and pushed when online (BR-011, BR-012). Conflicts are never auto-resolved."
        actions={
          <Button size="sm" icon={<RefreshCw className="size-3.5" aria-hidden />} loading={status.syncing} onClick={() => void onFlush()}>
            Sync now
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Connectivity"
          value={
            status.connectivity === 'online' ? (
              <span className="inline-flex items-center gap-1.5 text-brand-700 dark:text-brand-300"><Wifi className="size-4" aria-hidden /> Online</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300"><WifiOff className="size-4" aria-hidden /> Offline</span>
            )
          }
          sub={status.connectivity === 'offline' ? 'Records stay queued until reconnect' : undefined}
        />
        <Stat label="Pending" value={String(status.pending)} sub="Not yet confirmed by the server" />
        <Stat label="Failed" value={String(status.failed)} tone={status.failed > 0 ? 'danger' : 'default'} />
        <Stat label="Conflicts" value={String(status.conflicts)} tone={status.conflicts > 0 ? 'danger' : 'default'} />
      </div>

      {status.lastError && (
        <Card className="mb-6 border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
          <p className="flex items-center gap-2 text-xs text-red-900 dark:text-red-100">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            {status.lastError}
          </p>
        </Card>
      )}

      {conflictOps.length > 0 && (
        <Card className="mb-6 overflow-hidden border-amber-300 dark:border-amber-800">
          <CardHeader
            title="Conflicts need human review"
            subtitle="Another device changed the same record. Nothing is overwritten automatically — choose what to keep."
          />
          <ul className="divide-y divide-border-base">
            {conflictOps.map((op) => (
              <li key={op.opId} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{op.kind.replace(/_/g, ' ')}</p>
                    <p className="text-[11px] text-text-muted">opId {op.opId} · created {op.createdAt}</p>
                    {op.lastError && <p className="mt-1 text-xs text-red-700 dark:text-red-400">{op.lastError}</p>}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-brand-700 dark:text-brand-300">Review payload</summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-ink-50 p-2 text-[11px] dark:bg-ink-900">
                        {JSON.stringify(op.payload, null, 2)}
                      </pre>
                    </details>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" loading={busy === op.opId} icon={<CheckCircle2 className="size-3.5" aria-hidden />} onClick={() => void onKeepLocal(op.opId)}>
                      Keep my version
                    </Button>
                    <Button variant="outline" size="sm" icon={<Trash2 className="size-3.5" aria-hidden />} onClick={() => void onDiscard(op.opId)}>
                      Discard mine
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          title="Operation queue"
          subtitle="Every offline mutation is an idempotent operation with a stable opId; the server acknowledges each one by opId (BR-011)."
          actions={
            <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
              <CloudUpload className="size-3.5" aria-hidden />
              {ops.length} op{ops.length === 1 ? '' : 's'} in outbox
            </span>
          }
        />
        {ops.length === 0 ? (
          <EmptyState
            title="Queue is empty"
            description="All local changes are confirmed by the server. Records made while offline will appear here until synced."
          />
        ) : (
          <ul className="divide-y divide-border-base">
            {ops.map((op) => (
              <li key={op.opId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {op.kind.replace(/_/g, ' ')}
                    <SyncBadge state={op.syncState} />
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {op.createdAt} · attempts {op.attempts}
                    {op.serverId ? ` · server ${op.serverId.slice(0, 12)}…` : ''}
                  </p>
                  {op.lastError && <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">{op.lastError}</p>}
                </div>
                <div className="flex gap-2">
                  {(op.syncState === 'failed' || op.syncState === 'conflict') && (
                    <Button size="sm" variant="outline" loading={busy === op.opId} onClick={() => void onRetry(op.opId)}>
                      Retry
                    </Button>
                  )}
                  {op.syncState !== 'synced' && op.syncState !== 'syncing' && (
                    <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" aria-hidden />} onClick={() => void onDiscard(op.opId)}>
                      Discard
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6 p-4">
        <p className="text-xs text-text-muted">
          Last sync: {status.lastSyncAt ?? 'never'} · Pending records are labeled “not yet confirmed by the server”
          throughout the app until the server acknowledges their opId (SRS 7.2).
        </p>
      </Card>
    </div>
  )
}
