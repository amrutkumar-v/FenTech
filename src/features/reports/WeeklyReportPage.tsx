import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getApi } from '@/api/provider'
import { Card, CardHeader, Stat } from '@/ui/Card'
import { Amount } from '@/ui/Amount'
import { PeriodFilter, usePeriod } from '@/ui/PeriodFilter'
import { ErrorState, EmptyState, SkeletonTable } from '@/ui/States'
import { periodLabel } from '@/lib/dates'
import { ReportPage } from './ReportPage'

export default function WeeklyReportPage() {
  const { period, setPeriod, range } = usePeriod('this_week')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['weekly-report', period],
    queryFn: () => getApi().getWeeklyReport(range),
  })

  return (
    <ReportPage
      title="Weekly collections"
      subtitle={data ? periodLabel(data.range) : 'Collections, customers who paid, new accounts, disbursements and pending dues (RPT-003).'}
      actions={<PeriodFilter value={period} onChange={setPeriod} />}
    >
      {isLoading && <SkeletonTable rows={5} cols={4} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load report.'} onRetry={() => void refetch()} />}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Collections" value={<Amount value={data.receipts.totals.total} strong />} sub="Cash + digital — not profit (RPT-009)" tone="positive" />
            <Stat label="Disbursed" value={<Amount value={data.disbursements.totals.total} strong />} sub={`${data.disbursements.count} txn`} />
            <Stat label="New accounts" value={String(data.newAccounts)} />
            <Stat label="Expected closing cash" value={<Amount value={data.expectedClosingCash} />} />
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Pending dues" value={<Amount value={data.pendingDuesAmount} />} sub={`${data.pendingDuesCount} schedule items`} tone="warning" />
            <Stat label="Overdue dues" value={<Amount value={data.overdueDuesAmount} />} sub={`${data.overdueDuesCount} schedule items`} tone="danger" />
            <Stat label="Accounts closed" value={String(data.closedAccounts)} />
            <Stat label="Overdue count" value={String(data.overdueCount)} tone={data.overdueCount > 0 ? 'warning' : 'default'} />
          </div>

          <div className="mb-6 grid gap-3 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader title="Receipts by method" />
              <ul className="divide-y divide-border-base text-sm">
                <li className="flex justify-between px-4 py-2"><span className="text-text-secondary">Cash</span><Amount value={data.receipts.totals.cash} /></li>
                <li className="flex justify-between px-4 py-2"><span className="text-text-secondary">UPI</span><Amount value={data.receipts.totals.upi} /></li>
                <li className="flex justify-between px-4 py-2"><span className="text-text-secondary">Bank transfer</span><Amount value={data.receipts.totals.bankTransfer} /></li>
                <li className="flex justify-between px-4 py-2"><span className="text-text-secondary">Other</span><Amount value={data.receipts.totals.other} /></li>
                <li className="flex justify-between px-4 py-2 font-medium"><span>Total collected</span><Amount value={data.receipts.totals.total} strong /></li>
              </ul>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader title="Customers who paid" subtitle={`${data.customersWhoPaid.length} customer${data.customersWhoPaid.length === 1 ? '' : 's'}`} />
              {data.customersWhoPaid.length === 0 ? (
                <EmptyState title="No payments" description="No receipts were recorded in this period." />
              ) : (
                <ul className="divide-y divide-border-base text-sm">
                  {data.customersWhoPaid.map((c) => (
                    <li key={c.customerId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <Link to={`/customers/${c.customerId}`} className="truncate font-medium text-text-primary hover:underline">
                        {c.customerName}
                      </Link>
                      <Amount value={c.amount} strong />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden">
            <CardHeader title="Disbursements" subtitle={`${data.disbursements.count} transaction${data.disbursements.count === 1 ? '' : 's'} in period`} />
            <ul className="divide-y divide-border-base text-sm">
              <li className="flex justify-between px-4 py-2"><span className="text-text-secondary">Cash</span><Amount value={data.disbursements.totals.cash} /></li>
              <li className="flex justify-between px-4 py-2"><span className="text-text-secondary">UPI</span><Amount value={data.disbursements.totals.upi} /></li>
              <li className="flex justify-between px-4 py-2"><span className="text-text-secondary">Bank transfer</span><Amount value={data.disbursements.totals.bankTransfer} /></li>
              <li className="flex justify-between px-4 py-2 font-medium"><span>Total disbursed</span><Amount value={data.disbursements.totals.total} strong /></li>
            </ul>
          </Card>

          <p className="print-only mt-4 text-[10px] text-text-muted">
            Generated {data.generatedAt} · Dues reflect approved schedule entries only; schedule rules remain a business decision (OD-006).
          </p>
        </>
      )}
    </ReportPage>
  )
}

