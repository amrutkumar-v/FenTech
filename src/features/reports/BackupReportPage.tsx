import { useQuery } from '@tanstack/react-query'
import { getApi } from '@/api/provider'
import { Card, CardHeader, Stat } from '@/ui/Card'
import { Badge } from '@/ui/Badge'
import { ErrorState, SkeletonTable } from '@/ui/States'
import { formatDateTime, formatRelative } from '@/lib/dates'
import { ReportPage } from './ReportPage'

export default function BackupReportPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backup-status'],
    queryFn: () => getApi().getBackupStatus(),
  })

  const resultBadge =
    data?.lastBackupResult === 'success' ? (
      <Badge tone="success">Last backup succeeded</Badge>
    ) : data?.lastBackupResult === 'failed' ? (
      <Badge tone="danger">Last backup failed</Badge>
    ) : data ? (
      <Badge tone="pending">No backup yet</Badge>
    ) : null

  return (
    <ReportPage
      title="Backup status"
      subtitle="Last successful backup, destination, restore test and unresolved errors (SRS 7.3, RPT-011)."
    >
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
            <Stat label="Destination" value={data.destination ?? 'Not configured'} sub="Where backups are written" />
            <Stat
              label="Restore test"
              value={data.lastRestoreTestAt ? formatRelative(data.lastRestoreTestAt) : 'Never tested'}
              sub={data.lastRestoreTestAt ? formatDateTime(data.lastRestoreTestAt) : 'A backup is only trusted after a restore test'}
            />
            <Stat
              label="Unresolved errors"
              value={String(data.unresolvedErrors.length)}
              tone={data.unresolvedErrors.length > 0 ? 'warning' : 'default'}
            />
          </div>

          <Card>
            <CardHeader title="Overview" actions={resultBadge} />
            <dl className="space-y-2 px-4 pb-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-text-secondary">Last successful backup</dt>
                <dd className="text-right">{data.lastBackupAt ? formatDateTime(data.lastBackupAt) : 'None yet'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-secondary">Backup destination</dt>
                <dd className="text-right">{data.destination ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-secondary">Last restore test</dt>
                <dd className="text-right">{data.lastRestoreTestAt ? formatDateTime(data.lastRestoreTestAt) : 'Never'}</dd>
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
            <p className="px-4 pb-4 text-[11px] text-text-muted">
              Backup runs server-side. Manage backups and restore tests from Settings → Backup (SRS 7.3).
            </p>
          </Card>
        </>
      )}
    </ReportPage>
  )
}
