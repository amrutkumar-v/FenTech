import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getApi } from '@/api/provider'
import { Card, CardHeader, Stat } from '@/ui/Card'
import { Input } from '@/ui/Input'
import { DataTable, type Column } from '@/ui/Table'
import { StatusBadge } from '@/ui/Badge'
import { Amount, OutstandingBreakdownView } from '@/ui/Amount'
import { ErrorState, EmptyState, SkeletonTable, LoadingState } from '@/ui/States'
import { formatDate, todayISO } from '@/lib/dates'
import {
  FINANCE_TYPE_LABELS, PAYMENT_METHOD_LABELS, TRANSACTION_TYPE_LABELS, accountLabel,
} from '@/lib/format'
import type { CustomerDetail, Transaction } from '@/domain/types'
import { ReportPage } from './ReportPage'

function CustomerPicker() {
  const [q, setQ] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['customers', 'picker', q],
    queryFn: () => getApi().listCustomers({ search: q || undefined, page: 1, pageSize: 25 }),
  })

  return (
    <ReportPage
      title="Customer statement"
      subtitle="Pick a customer to generate a full statement: accounts, terms, chronological ledger, dues and collateral (RPT-005)."
    >
      <Card className="mb-4 no-print p-4">
        <label htmlFor="cust-search" className="mb-1 block text-xs font-medium text-text-muted">
          Search customers
        </label>
        <Input
          id="cust-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name or phone…"
          className="max-w-sm"
        />
      </Card>
      {isLoading && <SkeletonTable rows={5} cols={3} />}
      {data && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border-base">
            {data.items.map((c) => (
              <li key={c.id}>
                <Link to={`/reports/customer/${c.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-ink-50/60 dark:hover:bg-ink-900/40">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{c.name}</p>
                    <p className="text-[11px] text-text-muted">{c.phone} · {c.activeAccountCount} active account{c.activeAccountCount === 1 ? '' : 's'}</p>
                  </div>
                  <Amount value={c.totalOutstanding.total} strong />
                </Link>
              </li>
            ))}
            {data.items.length === 0 && (
              <li><EmptyState title="No customers found" description="Try a different search, or add the customer first." /></li>
            )}
          </ul>
        </Card>
      )}
    </ReportPage>
  )
}

function Statement({ customer }: { customer: CustomerDetail }) {
  const txnColumns: Column<Transaction>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (t) => <span className="num">{formatDate(t.date)}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (t) => TRANSACTION_TYPE_LABELS[t.type],
    },
    {
      key: 'method',
      header: 'Method',
      render: (t) => PAYMENT_METHOD_LABELS[t.method],
      hideOnMobile: true,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (t) => <Amount value={t.amount} strong />,
      align: 'right',
    },
    {
      key: 'link',
      header: 'Receipt',
      render: (t) => (
        <Link to={`/receipts/${t.id}`} className="text-xs text-brand-700 hover:underline dark:text-brand-300">
          View
        </Link>
      ),
      align: 'right',
      className: 'no-print',
    },
  ]

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total outstanding" value={<Amount value={customer.totalOutstanding.total} strong />} tone="warning" />
        <Stat label="Principal" value={<Amount value={customer.totalOutstanding.principal} />} />
        <Stat label="Interest dues" value={<Amount value={customer.totalOutstanding.interest} />} />
        <Stat label="Other dues" value={<Amount value={customer.totalOutstanding.other} />} />
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader title="Customer" />
          <dl className="space-y-1.5 px-4 pb-4 text-sm">
            <div className="flex justify-between"><dt className="text-text-secondary">Name</dt><dd className="font-medium">{customer.name}</dd></div>
            <div className="flex justify-between"><dt className="text-text-secondary">Phone</dt><dd className="num">{customer.phone}</dd></div>
            {customer.address && <div className="flex justify-between"><dt className="text-text-secondary">Address</dt><dd className="max-w-[60%] text-right">{customer.address}</dd></div>}
            <div className="flex justify-between"><dt className="text-text-secondary">Since</dt><dd>{formatDate(customer.createdAt.slice(0, 10))}</dd></div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Outstanding" />
          <div className="px-4 pb-4">
            <OutstandingBreakdownView outstanding={customer.totalOutstanding} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Collateral held" subtitle={`${customer.collaterals.length} item${customer.collaterals.length === 1 ? '' : 's'}`} />
          {customer.collaterals.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-text-muted">No collateral recorded.</p>
          ) : (
            <ul className="divide-y divide-border-base text-sm">
              {customer.collaterals.map((col) => (
                <li key={col.id} className="flex items-center justify-between gap-2 px-4 py-2">
                  <div>
                    <p className="font-medium">{col.description || '—'}</p>
                    <p className="text-[11px] text-text-muted">{col.reference || 'No reference'}</p>
                  </div>
                  <StatusBadge status={col.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mb-6 overflow-hidden">
        <CardHeader title={`Accounts (${customer.accounts.length})`} />
        <ul className="divide-y divide-border-base text-sm">
          {customer.accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link to={`/accounts/${a.id}`} className="font-medium text-text-primary hover:underline">
                  {accountLabel(a.financeType, a.id)}
                </Link>
                <p className="text-[11px] text-text-muted">
                  {FINANCE_TYPE_LABELS[a.financeType]} · disbursed {formatDate(a.startDate)} · rate {a.currentTerms.rateValue}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={a.status} />
                <div className="text-right">
                  <p className="text-[11px] text-text-muted">Disbursed <Amount value={a.disbursedTotal} muted /></p>
                  <Amount value={a.outstanding.total} strong />
                </div>
              </div>
            </li>
          ))}
          {customer.accounts.length === 0 && <li><EmptyState title="No accounts" description="This customer has no finance accounts yet." /></li>}
        </ul>
      </Card>

      <Card className="mb-6 overflow-hidden">
        <CardHeader title="Scheduled dues" subtitle={`${customer.scheduleItems.length} schedule item${customer.scheduleItems.length === 1 ? '' : 's'} — approved schedules only (OD-006)`} />
        {customer.scheduleItems.length === 0 ? (
          <EmptyState title="No schedule" description="No schedule entries exist for this customer's accounts." />
        ) : (
          <ul className="divide-y divide-border-base text-sm">
            {customer.scheduleItems.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div>
                  <p className="font-medium">{formatDate(s.dueDate)}</p>
                  <p className="text-[11px] text-text-muted">Expected <Amount value={s.expectedAmount} muted /></p>
                </div>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Transaction ledger" subtitle="Chronological, all recorded entries — reversals appear as linked entries, never deletions." />
        <DataTable
          caption="Customer transaction ledger"
          columns={txnColumns}
          rows={customer.transactions}
          rowKey={(t) => t.id}
          empty={<EmptyState title="No transactions" description="Nothing has been recorded on this customer's accounts." />}
        />
      </Card>
    </>
  )
}

export default function CustomerStatementPage() {
  const { id } = useParams<{ id: string }>()
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customer-statement', id, custom],
    queryFn: () =>
      getApi().getCustomerStatement(
        id!,
        custom ? { from: custom.from, to: custom.to } : undefined,
      ),
    enabled: !!id && id !== 'pick',
  })

  if (!id || id === 'pick') return <CustomerPicker />

  return (
    <ReportPage
      title="Customer statement"
      subtitle={data ? `${data.name} · ${data.phone}` : undefined}
      actions={
        <div className="flex items-end gap-2 no-print">
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={custom !== null}
              onChange={(e) =>
                setCustom(e.target.checked ? { from: todayISO(), to: todayISO() } : null)
              }
              className="size-3.5 rounded border-border-strong accent-brand-600"
            />
            Filter by date
          </label>
          {custom && (
            <>
              <div>
                <label htmlFor="stmt-from" className="mb-1 block text-xs font-medium text-text-muted">From</label>
                <Input id="stmt-from" type="date" value={custom.from} max={custom.to} className="w-36" onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
              </div>
              <div>
                <label htmlFor="stmt-to" className="mb-1 block text-xs font-medium text-text-muted">To</label>
                <Input id="stmt-to" type="date" value={custom.to} min={custom.from} className="w-36" onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
              </div>
            </>
          )}
        </div>
      }
    >
      {isLoading && <LoadingState label="Loading statement…" />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load statement.'} onRetry={() => void refetch()} />}
      {data && <Statement customer={data} />}
    </ReportPage>
  )
}
