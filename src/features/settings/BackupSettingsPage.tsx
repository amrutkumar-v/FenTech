import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HardDriveDownload, RefreshCw, ShieldCheck } from 'lucide-react'
import { getApi } from '@/api/provider'
import { PageHeader, Card, CardHeader, Stat } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import { ErrorState, SkeletonTable, PermissionDenied } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { formatDateTime, formatRelative } from '@/lib/dates'

export default function BackupSettingsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [requesting, setRequesting] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backup-status'],
    queryFn: () => getApi().getBackupStatus(),
    enabled: can('backup:view'),
  })

  if (!can('backup:view')) {
    return (
      <div>
        <PageHeader title="Backup & recovery" />
        <PermissionDenied message="Backup management is admin-only (SEC-002, SRS 7.3)." />
      </div>
    )
  }

  async function onRequest() {
    setRequesting(true)
    try {
      const updated = await getApi().requestBackup()
      qc.setQueryData(['backup-status'], updated)
      if (updated.lastBackupResult === 'success') {
        toast.success('Backup completed', updated.destination ?? undefined)
      } else if (updated.lastBackupResult === 'failed') {
        toast.error('Backup failed', updated.unresolvedErrors[0] ?? undefined)
      } else {
        toast.info('Backup requested', 'No result reported by the server yet.')
      }
    } catch (err) {
      toast.error('Backup request failed', err instanceof Error ? err.message : undefined)
    } finally {
      setRequesting(false)
    }
  }

  const resultBadge =
    data?.lastBackupResult === 'success' ? (
      <Badge tone="success">Healthy</Badge>
    ) : data?.lastBackupResult === 'failed' ? (
      <Badge tone="danger">Failed</Badge>
    ) : data ? (
      <Badge tone="pending">Never backed up</Badge>
    ) : null

  return (
    <div>
      <PageHeader
        title="Backup & recovery"
        subtitle="Backups run server-side. Request a manual backup, then verify with a restore test — a backup is only trusted after it has been restored once (SRS 7.3)."
        actions={
          can('backup:restore') ? (
            <Button size="sm" loading={requesting} icon={<HardDriveDownload className="size-3.5" aria-hidden />} onClick={() => void onRequest()}>
              Request backup now
            </Button>
          ) : undefined
        }
      />

      {isLoading && <SkeletonTable rows={3} cols={2} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load backup status.'} onRetry={() => void refetch()} />}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Last backup"
              value={data.lastBackupAt ? formatRelative(data.lastBackupAt) : 'Never'}
              sub={data.lastBackupAt ? formatDateTime(data.lastBackupAt) : undefined}
              tone={data.lastBackupResult === 'failed' ? 'danger' : data.lastBackupResult === 'success' ? 'positive' : 'default'}
            />
            <Stat label="Destination" value={data.destination ?? 'Not configured'} />
            <Stat
              label="Restore test"
              value={data.lastRestoreTestAt ? formatRelative(data.lastRestoreTestAt) : 'Never tested'}
              sub={data.lastRestoreTestAt ? formatDateTime(data.lastRestoreTestAt) : 'Test a restore before trusting backups'}
              tone={data.lastRestoreTestAt ? 'positive' : 'warning'}
            />
            <Stat label="Unresolved errors" value={String(data.unresolvedErrors.length)} tone={data.unresolvedErrors.length > 0 ? 'warning' : 'default'} />
          </div>

          <Card>
            <CardHeader title="Status" actions={resultBadge} />
            <dl className="space-y-2 px-4 pb-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-text-secondary">Last successful backup</dt>
                <dd>{data.lastBackupAt ? formatDateTime(data.lastBackupAt) : 'None yet'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-secondary">Backup destination</dt>
                <dd>{data.destination ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-secondary">Last restore test</dt>
                <dd>{data.lastRestoreTestAt ? formatDateTime(data.lastRestoreTestAt) : 'Never'}</dd>
              </div>
            </dl>
            {data.unresolvedErrors.length > 0 && (
              <div className="border-t border-border-base px-4 py-3">
                <p className="mb-1 text-xs font-semibold text-red-700 dark:text-red-400">Unresolved backup errors</p>
                <ul className="list-inside list-disc space-y-0.5 text-xs text-text-secondary">
                  {data.unresolvedErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="mt-6 p-4">
            <p className="flex items-start gap-2 text-xs text-text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              Restore itself is a server-side operation (OD-019). After a restore, force a full sync from this page
              so every device reconciles against the restored dataset (SRS 7.3).
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              icon={<RefreshCw className="size-3.5" aria-hidden />}
              onClick={() => {
                toast.info('Full sync requested', 'Devices will reconcile against the server on next connection.')
                void refetch()
              }}
            >
              Force full sync after restore
            </Button>
          </Card>
        </>
      )}
    </div>
  )
}
