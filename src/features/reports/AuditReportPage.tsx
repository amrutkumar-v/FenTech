import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getApi } from '@/api/provider'
import { Card, CardHeader } from '@/ui/Card'
import { Input, Field } from '@/ui/Input'
import { DataTable, type Column } from '@/ui/Table'
import { Badge } from '@/ui/Badge'
import { ErrorState, EmptyState, SkeletonTable } from '@/ui/States'
import { formatDateTime, todayISO } from '@/lib/dates'
import type { AuditEvent } from '@/domain/types'
import { ReportPage } from './ReportPage'

export default function AuditReportPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [entityType, setEntityType] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['audit', from, to, entityType, page],
    queryFn: () =>
      getApi().listAuditEvents({
        page,
        pageSize: 50,
        entityType: entityType || undefined,
        range: from && to ? { from, to } : undefined,
      }),
  })

  const columns: Column<AuditEvent>[] = [
    {
      key: 'timestamp',
      header: 'When',
      render: (e) => <span className="num text-xs">{formatDateTime(e.timestamp)}</span>,
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (e) => <span className="text-sm font-medium">{e.actorName}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      render: (e) => <Badge tone="info">{e.action}</Badge>,
    },
    {
      key: 'entity',
      header: 'Record',
      render: (e) => (
        <span className="text-xs text-text-secondary">
          {e.entityType}
          <span className="num ml-1 text-text-muted">{e.entityId.slice(0, 12)}…</span>
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (e) => e.reason ?? <span className="text-text-muted">—</span>,
    },
    {
      key: 'change',
      header: 'Change',
      render: (e) => e.beforeAfter ?? <span className="text-text-muted">—</span>,
      hideOnMobile: true,
    },
  ]

  return (
    <ReportPage
      title="Audit report"
      subtitle="Actor, action, timestamp, reason and affected record for important changes and reversals (AUD-*). Reversals require a reason and are never deletions."
    >
      <Card className="mb-6 no-print p-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label="From" htmlFor="audit-from">
            <Input id="audit-from" type="date" value={from} max={to || undefined} className="w-40" onChange={(e) => { setFrom(e.target.value); setPage(1) }} />
          </Field>
          <Field label="To" htmlFor="audit-to">
            <Input id="audit-to" type="date" value={to} min={from || undefined} max={todayISO()} className="w-40" onChange={(e) => { setTo(e.target.value); setPage(1) }} />
          </Field>
          <Field label="Record type" htmlFor="audit-entity">
            <Input id="audit-entity" value={entityType} placeholder="e.g. transaction, account" className="w-48" onChange={(e) => { setEntityType(e.target.value); setPage(1) }} />
          </Field>
        </div>
      </Card>

      {isLoading && <SkeletonTable rows={6} cols={5} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load audit events.'} onRetry={() => void refetch()} />}

      {data && (
        <Card className="overflow-hidden">
          <CardHeader title={`${data.total} event${data.total === 1 ? '' : 's'}`} subtitle="Page shows up to 50 events." />
          <DataTable
            caption="Audit events"
            columns={columns}
            rows={data.items}
            rowKey={(e) => e.id}
            empty={<EmptyState title="No audit events" description="No events match the current filters." />}
          />
          {data.total > 50 && (
            <div className="no-print flex items-center justify-between border-t border-border-base px-4 py-3 text-sm">
              <span className="text-text-muted">Page {data.page} of {Math.ceil(data.total / 50)}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border border-border-strong px-2.5 py-1 text-xs disabled:opacity-40">
                  Previous
                </button>
                <button type="button" disabled={page >= Math.ceil(data.total / 50)} onClick={() => setPage((p) => p + 1)} className="rounded border border-border-strong px-2.5 py-1 text-xs disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      )}
    </ReportPage>
  )
}
