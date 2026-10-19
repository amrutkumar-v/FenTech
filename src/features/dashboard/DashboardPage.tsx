import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, AlertTriangle, CloudUpload } from 'lucide-react'
import { getApi } from '@/api/provider'
import { PageHeader, Card, CardHeader, Stat } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge } from '@/ui/Badge'
import { Amount } from '@/ui/Amount'
import { ErrorState, SkeletonTable } from '@/ui/States'
import { PeriodFilter, usePeriod } from '@/ui/PeriodFilter'
import { periodLabel } from '@/lib/dates'
import { PAYMENT_METHOD_LABELS, TRANSACTION_TYPE_LABELS } from '@/lib/format'
import { useSync } from '@/offline/sync'
import { pendingCount } from '@/offline/db'
import { useAuth } from '@/features/auth/AuthProvider'

export default function DashboardPage() {
  const { can } = useAuth()
  const { status } = useSync()
  const { period, setPeriod, range } = usePeriod('today')

  const { data: report, isLoading, error, refetch } = useQuery({
    queryKey: ['daily-report', period],
    queryFn: () => getApi().getDailyReport(range),
  })

  const { data: outstanding } = useQuery({
    queryKey: ['outstanding', 'all'],
    queryFn: () => getApi().getOutstandingReport({}),
  })

  const { data: dueItems } = useQuery({
    queryKey: ['due-items', 'dashboard'],
    queryFn: () => getApi().listDueItems({ includeUpcoming: true }),
  })

  const { data: pending } = useQuery({
    queryKey: ['sync-badge'],
    queryFn: () => pendingCount(),
    refetchInterval: 15000,
  })

  const overdue = (dueItems ?? []).filter((d) => d.status === 'overdue' || (d.status === 'partially_paid' && d.overdueDays > 0))
  const recent = (report?.transactions ?? []).slice(0, 8)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={report ? periodLabel(report.range) : undefined}
        actions={<PeriodFilter value={period} onChange={setPeriod} />}
      />

      {isLoading && <SkeletonTable rows={4} cols={4} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load dashboard.'} onRetry={() => void refetch()} />}

      {report && (
        <>
          {/* Alerts */}
          {(overdue.length > 0 || (pending ?? 0) > 0 || status.conflicts > 0) && (
            <div className="mb-4 space-y-2">
              {overdue.length > 0 && (
                <Link
                  to="/collections"
                  className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
                >
                  <AlertTriangle className="size-4 shrink-0" aria-hidden />
                  <span>
                    <strong>{overdue.length}</strong> overdue payment{overdue.length === 1 ? '' : 's'} —{' '}
                    <span className="num font-semibold">
                      <Amount value={overdue.reduce((s, i) => s + Number(i.balanceAmount), 0).toString()} />
                    </span>{' '}
                    outstanding on due items
                  </span>
                  <ArrowRight className="ml-auto size-4 shrink-0" aria-hidden />
                </Link>
              )}
              {((pending ?? 0) > 0 || status.conflicts > 0) && (
                <Link
                  to="/settings/sync"
                  className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-900 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-100"
                >
                  <CloudUpload className="size-4 shrink-0" aria-hidden />
                  <span>
                    {(pending ?? 0) > 0 && (
                      <>
                        <strong>{pending}</strong> record{(pending ?? 0) === 1 ? '' : 's'} pending sync — not yet confirmed by the server.
                      </>
                    )}
                    {status.conflicts > 0 && <> <strong>{status.conflicts}</strong> conflict(s) need review.</>}
                  </span>
                  <ArrowRight className="ml-auto size-4 shrink-0" aria-hidden />
                </Link>
              )}
            </div>
          )}

          {/* Key figures — money movement, NOT income */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Disbursed"
              value={<Amount value={report.disbursements.totals.total} strong />}
              sub={`${report.disbursements.count} transaction${report.disbursements.count === 1 ? '' : 's'}`}
            />
            <Stat
              label="Collected"
              value={<Amount value={report.receipts.totals.total} strong />}
              sub="Cash + digital receipts — not profit (RPT-009)"
              tone="positive"
            />
            <Stat
              label="Expenses"
              value={<Amount value={report.expenses.totals.total} />}
              sub={`${report.expenses.count} entr${report.expenses.count === 1 ? 'y' : 'ies'}`}
              tone="warning"
            />
            <Stat
              label="Expected closing cash"
              value={<Amount value={report.expectedClosingCash} strong />}
              sub="Physical cash position (CASH-004)"
            />
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Outstanding principal" value={<Amount value={outstanding?.total.principal ?? '0'} />} />
            <Stat label="Outstanding interest" value={<Amount value={outstanding?.total.interest ?? '0'} />} />
            <Stat label="Other dues" value={<Amount value={outstanding?.total.other ?? '0'} />} />
            <Stat
              label="Total outstanding"
              value={<Amount value={outstanding?.total.total ?? '0'} strong />}
              sub={outstanding ? `Across ${outstanding.accounts.length} accounts` : undefined}
              tone="warning"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 overflow-hidden">
              <CardHeader
                title="Recent transactions"
                subtitle="Newest first for the selected period"
                actions={
                  <Link to="/transactions">
                    <Button variant="ghost" size="sm" icon={<ArrowRight className="size-3.5" aria-hidden />}>
                      Full ledger
                    </Button>
                  </Link>
                }
              />
              {recent.length === 0 ? (
                <p className="px-4 py-6 text-sm text-text-muted">No transactions in this period.</p>
              ) : (
                <ul className="divide-y divide-border-base">
                  {recent.map((t) => (
                    <li key={t.id}>
                      <Link to={`/receipts/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-ink-50/60 dark:hover:bg-ink-900/40">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary">
                            {TRANSACTION_TYPE_LABELS[t.type]}
                            <span className="ml-2 text-xs font-normal text-text-muted">{PAYMENT_METHOD_LABELS[t.method]}</span>
                          </p>
                          <p className="text-[11px] text-text-muted">{t.customerId.slice(0, 18)}… · {t.date}</p>
                        </div>
                        <Amount value={t.amount} strong />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="space-y-6">
              <Card className="overflow-hidden">
                <CardHeader
                  title="Due & overdue"
                  actions={
                    <Link to="/collections">
                      <Button variant="ghost" size="sm">Open</Button>
                    </Link>
                  }
                />
                <ul className="divide-y divide-border-base">
                  {(dueItems ?? []).filter((i) => i.status !== 'paid').slice(0, 6).map((i) => (
                    <li key={i.scheduleItemId} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-text-primary">{i.customerName}</p>
                        <p className="text-[11px] text-text-muted">
                          {i.dueDate}
                          {i.overdueDays > 0 && ` · ${i.overdueDays}d overdue`}
                        </p>
                      </div>
                      <Amount value={i.balanceAmount} strong />
                    </li>
                  ))}
                  {(dueItems ?? []).filter((i) => i.status !== 'paid').length === 0 && (
                    <li className="px-4 py-4 text-xs text-text-muted">No pending dues.</li>
                  )}
                </ul>
              </Card>

              <Card>
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Activity</p>
                  <div className="mt-2 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">New accounts</span>
                      <span className="num font-medium">{report.newAccounts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Accounts closed</span>
                      <span className="num font-medium">{report.closedAccounts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Due today</span>
                      <span className="num font-medium">{report.dueTodayCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Overdue</span>
                      <span className={`num font-medium ${report.overdueCount > 0 ? 'text-red-600' : ''}`}>{report.overdueCount}</span>
                    </div>
                  </div>
                  {can('reports:view') && (
                    <Link to="/reports" className="mt-3 block">
                      <Button variant="outline" size="sm" className="w-full">
                        All reports
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>

              <div className="flex flex-wrap gap-2">
                {can('transactions:record') && (
                  <>
                    <Link to="/payments/receipt">
                      <Button size="sm">Record payment</Button>
                    </Link>
                    <Link to="/payments/disburse">
                      <Button variant="outline" size="sm">Disburse</Button>
                    </Link>
                  </>
                )}
              </div>

              <Badge tone="info" className="!text-[11px]">
                Collections ≠ income. Principal repayment is never reported as profit (RPT-009, BR-008).
              </Badge>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
