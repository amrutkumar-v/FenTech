import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getApi } from '@/api/provider'
import { Card, CardHeader } from '@/ui/Card'
import { Field, Select } from '@/ui/Input'
import { DataTable, type Column } from '@/ui/Table'
import { StatusBadge } from '@/ui/Badge'
import { Amount, OutstandingBreakdownView } from '@/ui/Amount'
import { ErrorState, EmptyState, SkeletonTable } from '@/ui/States'
import { FINANCE_TYPE_LABELS, ACCOUNT_STATUS_LABELS } from '@/lib/format'
import type { AccountSummary, FinanceType } from '@/domain/types'
import { ReportPage } from './ReportPage'

export default function OutstandingReportPage() {
  const [financeType, setFinanceType] = useState('')
  const [status, setStatus] = useState('')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['outstanding', financeType, status],
    queryFn: () =>
      getApi().getOutstandingReport({
        financeType: (financeType || undefined) as FinanceType | undefined,
        status: status || undefined,
      }),
  })

  const columns: Column<AccountSummary>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (a) => (
        <Link to={`/accounts/${a.id}`} className="font-medium text-text-primary hover:underline">
          {a.customerName}
        </Link>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (a) => FINANCE_TYPE_LABELS[a.financeType],
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => <StatusBadge status={a.status} />,
    },
    {
      key: 'principal',
      header: 'Principal',
      render: (a) => <Amount value={a.outstanding.principal} />,
      align: 'right',
    },
    {
      key: 'interest',
      header: 'Interest',
      render: (a) => <Amount value={a.outstanding.interest} />,
      align: 'right',
      hideOnMobile: true,
    },
    {
      key: 'other',
      header: 'Other',
      render: (a) => <Amount value={a.outstanding.other} />,
      align: 'right',
      hideOnMobile: true,
    },
    {
      key: 'total',
      header: 'Total',
      render: (a) => <Amount value={a.outstanding.total} strong />,
      align: 'right',
    },
    {
      key: 'overdue',
      header: 'Overdue',
      render: (a) => (a.overdueDays > 0 ? <span className="num text-red-600">{a.overdueDays}d</span> : <span className="text-text-muted">—</span>),
      align: 'right',
    },
  ]

  return (
    <ReportPage
      title="Outstanding breakdown"
      subtitle="Principal, interest, other dues and totals — by finance type and account status (RPT-008). Every figure is a sum of recorded ledger allocations; no interest is auto-calculated (INT-006)."
    >
      <Card className="mb-6 no-print p-4">
        <div className="flex flex-wrap gap-4">
          <Field label="Finance type" htmlFor="out-type">
            <Select id="out-type" value={financeType} onChange={(e) => setFinanceType(e.target.value)} className="w-48">
              <option value="">All types</option>
              {(Object.keys(FINANCE_TYPE_LABELS) as FinanceType[]).map((t) => (
                <option key={t} value={t}>{FINANCE_TYPE_LABELS[t]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Account status" htmlFor="out-status">
            <Select id="out-status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="settled">Settled</option>
              <option value="closed">Closed</option>
            </Select>
          </Field>
        </div>
      </Card>

      {isLoading && <SkeletonTable rows={5} cols={6} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load report.'} onRetry={() => void refetch()} />}

      {data && (
        <>
          <div className="mb-6 grid gap-3 lg:grid-cols-3">
            <Card>
              <OutstandingBreakdownView outstanding={data.total} title="Total outstanding (all accounts)" />
            </Card>
            <Card>
              <CardHeader title="By finance type" />
              <ul className="space-y-1.5 text-sm">
                {data.byFinanceType.map((b) => (
                  <li key={b.financeType} className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary">
                      {FINANCE_TYPE_LABELS[b.financeType]}{' '}
                      <span className="text-[11px] text-text-muted">({b.accountCount})</span>
                    </span>
                    <Amount value={b.outstanding.total} strong />
                  </li>
                ))}
                {data.byFinanceType.length === 0 && <li className="text-xs text-text-muted">No accounts.</li>}
              </ul>
            </Card>
            <Card>
              <CardHeader title="By account status" />
              <ul className="space-y-1.5 text-sm">
                {data.byStatus.map((b) => (
                  <li key={b.status} className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary">
                      {ACCOUNT_STATUS_LABELS[b.status]}{' '}
                      <span className="text-[11px] text-text-muted">({b.accountCount})</span>
                    </span>
                    <Amount value={b.outstanding.total} strong />
                  </li>
                ))}
                {data.byStatus.length === 0 && <li className="text-xs text-text-muted">No accounts.</li>}
              </ul>
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader title={`Accounts (${data.accounts.length})`} subtitle="Principal, interest and other dues shown separately." />
            <DataTable
              caption="Outstanding by account"
              columns={columns}
              rows={data.accounts}
              rowKey={(a) => a.id}
              empty={<EmptyState title="No accounts match" description="Adjust the filters above." />}
            />
          </Card>

          <p className="print-only mt-4 text-[10px] text-text-muted">Generated {data.generatedAt}</p>
        </>
      )}
    </ReportPage>
  )
}
