import { useQuery } from '@tanstack/react-query'
import { getApi } from '@/api/provider'
import { Card, CardHeader, Stat } from '@/ui/Card'
import { Amount } from '@/ui/Amount'
import { PeriodFilter, usePeriod } from '@/ui/PeriodFilter'
import { ErrorState, EmptyState, SkeletonTable } from '@/ui/States'
import { periodLabel } from '@/lib/dates'
import { PAYMENT_METHOD_LABELS, TRANSACTION_TYPE_LABELS } from '@/lib/format'
import type { MethodTotals } from '@/domain/types'
import { ReportPage } from './ReportPage'

function MethodRow({ totals }: { totals: MethodTotals }) {
  return (
    <ul className="space-y-1 text-sm">
      <li className="flex justify-between"><span className="text-text-secondary">Cash</span><Amount value={totals.cash} /></li>
      <li className="flex justify-between"><span className="text-text-secondary">UPI</span><Amount value={totals.upi} /></li>
      <li className="flex justify-between"><span className="text-text-secondary">Bank transfer</span><Amount value={totals.bankTransfer} /></li>
      <li className="flex justify-between"><span className="text-text-secondary">Other</span><Amount value={totals.other} /></li>
      <li className="flex justify-between border-t border-border-base pt-1"><span className="font-medium">Total</span><Amount value={totals.total} strong /></li>
    </ul>
  )
}

export default function DailyReportPage() {
  const { period, setPeriod, range } = usePeriod('today')

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['daily-report', period],
    queryFn: () => getApi().getDailyReport(range),
  })

  return (
    <ReportPage
      title="Daily activity"
      subtitle={data ? periodLabel(data.range) : 'Disbursements, receipts, expenses, account openings and cash totals (RPT-002).'}
      actions={<PeriodFilter value={period} onChange={setPeriod} />}
    >
      {isLoading && <SkeletonTable rows={5} cols={4} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load report.'} onRetry={() => void refetch()} />}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Disbursed" value={<Amount value={data.disbursements.totals.total} strong />} sub={`${data.disbursements.count} txn`} />
            <Stat label="Collected" value={<Amount value={data.receipts.totals.total} strong />} sub={`${data.receipts.count} txn`} tone="positive" />
            <Stat label="Expenses" value={<Amount value={data.expenses.totals.total} />} sub={`${data.expenses.count} entries`} tone="warning" />
            <Stat label="Expected closing cash" value={<Amount value={data.expectedClosingCash} strong />} sub={`Opening ${data.openingCash}`} />
          </div>

          <div className="mb-6 grid gap-3 lg:grid-cols-3">
            <Card>
              <CardHeader title="Disbursements by method" />
              <div className="px-4 pb-4"><MethodRow totals={data.disbursements.totals} /></div>
            </Card>
            <Card>
              <CardHeader title="Receipts by method" />
              <div className="px-4 pb-4"><MethodRow totals={data.receipts.totals} /></div>
            </Card>
            <Card>
              <CardHeader title="Expenses by method" />
              <div className="px-4 pb-4"><MethodRow totals={data.expenses.totals} /></div>
            </Card>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="New accounts" value={String(data.newAccounts)} />
            <Stat label="Accounts closed" value={String(data.closedAccounts)} />
            <Stat label="Due today" value={String(data.dueTodayCount)} />
            <Stat label="Overdue" value={String(data.overdueCount)} tone={data.overdueCount > 0 ? 'warning' : 'default'} />
          </div>

          <Card className="mb-6 overflow-hidden">
            <CardHeader title="Transactions" subtitle="Every figure below derives from recorded entries only." />
            {data.transactions.length === 0 ? (
              <EmptyState title="No transactions" description="Nothing was recorded in this period." />
            ) : (
              <ul className="divide-y divide-border-base">
                {data.transactions.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary">
                        {TRANSACTION_TYPE_LABELS[t.type]}
                        <span className="ml-2 text-xs font-normal text-text-muted">{PAYMENT_METHOD_LABELS[t.method]}</span>
                      </p>
                      <p className="text-[11px] text-text-muted">{t.date} · {t.accountId.slice(0, 18)}…</p>
                    </div>
                    <Amount value={t.amount} strong />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Expenses" subtitle="Business expenses — never counted as interest income (BR-008)." />
            {data.expenseList.length === 0 ? (
              <EmptyState title="No expenses" description="No business expenses were recorded in this period." />
            ) : (
              <ul className="divide-y divide-border-base">
                {data.expenseList.map((x) => (
                  <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary">{x.category.replace('_', ' ')}</p>
                      <p className="text-[11px] text-text-muted">{x.date} · {PAYMENT_METHOD_LABELS[x.method]}{x.notes ? ` · ${x.notes}` : ''}</p>
                    </div>
                    <Amount value={x.amount} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <p className="print-only mt-4 text-[10px] text-text-muted">
            Generated {data.generatedAt} · Collections are not profit; no interest is calculated by this app.
          </p>
        </>
      )}
    </ReportPage>
  )
}

