import { useQuery } from '@tanstack/react-query'
import { getApi } from '@/api/provider'
import { Card, CardHeader } from '@/ui/Card'
import { Amount } from '@/ui/Amount'
import { ErrorState, SkeletonTable } from '@/ui/States'
import { formatDate } from '@/lib/dates'
import { ReportPage } from './ReportPage'

export default function MonthlyReportPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['monthly-comparison'],
    queryFn: () => getApi().getMonthlyComparison(),
  })

  const rows: { label: string; thisMonth: string; lastMonth: string; whole?: boolean }[] = data
    ? [
        { label: 'Disbursed', thisMonth: data.thisMonth.disbursed, lastMonth: data.lastMonth.disbursed },
        { label: 'Collected', thisMonth: data.thisMonth.collected, lastMonth: data.lastMonth.collected },
        { label: 'Expenses', thisMonth: data.thisMonth.expenses, lastMonth: data.lastMonth.expenses },
        { label: 'Outstanding total', thisMonth: data.thisMonth.outstandingTotal, lastMonth: data.lastMonth.outstandingTotal },
        { label: 'Accounts opened', thisMonth: String(data.thisMonth.accountsOpened), lastMonth: String(data.lastMonth.accountsOpened), whole: true },
        { label: 'Accounts closed', thisMonth: String(data.thisMonth.accountsClosed), lastMonth: String(data.lastMonth.accountsClosed), whole: true },
      ]
    : []

  return (
    <ReportPage
      title="Monthly comparison"
      subtitle="This month vs last month — money movement, activity and outstanding (RPT-004). Compared from recorded entries only."
    >
      {isLoading && <SkeletonTable rows={5} cols={3} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load comparison.'} onRetry={() => void refetch()} />}

      {data && (
        <>
          <Card className="mb-6 overflow-hidden">
            <CardHeader
              title={`${data.thisMonth.label} vs ${data.lastMonth.label}`}
              subtitle={`${formatDate(data.thisMonth.range.from)} – ${formatDate(data.thisMonth.range.to)}  ·  ${formatDate(data.lastMonth.range.from)} – ${formatDate(data.lastMonth.range.to)}`}
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-base text-left">
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Metric</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">{data.thisMonth.label}</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-text-muted">{data.lastMonth.label}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="border-b border-border-base last:border-0">
                      <td className="px-4 py-2.5 text-text-secondary">{r.label}</td>
                      <td className="px-4 py-2.5 text-right font-medium">
                        {r.whole ? <span className="num">{r.thisMonth}</span> : <Amount value={r.thisMonth} strong />}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.whole ? <span className="num text-text-muted">{r.lastMonth}</span> : <Amount value={r.lastMonth} muted />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">This month</p>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-text-secondary">Disbursed</dt><dd><Amount value={data.thisMonth.disbursed} /></dd></div>
                <div className="flex justify-between"><dt className="text-text-secondary">Collected</dt><dd><Amount value={data.thisMonth.collected} /></dd></div>
                <div className="flex justify-between"><dt className="text-text-secondary">Expenses</dt><dd><Amount value={data.thisMonth.expenses} /></dd></div>
                <div className="flex justify-between border-t border-border-base pt-1.5"><dt className="font-medium">Outstanding</dt><dd><Amount value={data.thisMonth.outstandingTotal} strong /></dd></div>
              </dl>
            </Card>
            <Card>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Last month</p>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-text-secondary">Disbursed</dt><dd><Amount value={data.lastMonth.disbursed} muted /></dd></div>
                <div className="flex justify-between"><dt className="text-text-secondary">Collected</dt><dd><Amount value={data.lastMonth.collected} muted /></dd></div>
                <div className="flex justify-between"><dt className="text-text-secondary">Expenses</dt><dd><Amount value={data.lastMonth.expenses} muted /></dd></div>
                <div className="flex justify-between border-t border-border-base pt-1.5"><dt className="font-medium">Outstanding</dt><dd><Amount value={data.lastMonth.outstandingTotal} strong muted /></dd></div>
              </dl>
            </Card>
          </div>

          <p className="mt-4 text-[11px] text-text-muted">
            Collected cash is not interest income or profit — principal repayment never inflates income (RPT-009, BR-008).
            No interest or penalty is calculated by the frontend (INT-006).
          </p>
        </>
      )}
    </ReportPage>
  )
}
