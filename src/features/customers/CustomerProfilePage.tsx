import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Plus, Receipt, Printer } from 'lucide-react'
import { getApi } from '@/api/provider'
import { PageHeader, Card, CardHeader, CardBody, Stat } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge, StatusBadge, SyncBadge } from '@/ui/Badge'
import { Amount, OutstandingBreakdownView } from '@/ui/Amount'
import { LoadingState, ErrorState, EmptyState } from '@/ui/States'
import { formatDate, formatDateTime } from '@/lib/dates'
import { PAYMENT_METHOD_LABELS, TRANSACTION_TYPE_LABELS, FINANCE_TYPE_LABELS, accountLabel } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'

export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { can } = useAuth()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => getApi().getCustomer(id!),
    enabled: !!id,
  })

  if (isLoading) return <LoadingState label="Loading customer…" />
  if (error || !data) {
    return <ErrorState message={error instanceof Error ? error.message : 'Customer not found.'} onRetry={() => void refetch()} />
  }

  const c = data

  return (
    <div>
      <PageHeader
        back={
          <Link to="/customers" className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary">
            <ArrowLeft className="size-3.5" aria-hidden /> Customers
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {c.name}
            {c.status === 'inactive' && <StatusBadge status="inactive" />}
            {c.name.startsWith('Demo') && <Badge tone="info">Demo fixture</Badge>}
            <SyncBadge state={c.syncState} />
          </span>
        }
        subtitle={`${c.phone}${c.address ? ` · ${c.address}` : ''}`}
        actions={
          <>
            <Link to={`/reports/customer/${c.id}`}>
              <Button variant="outline" size="sm" icon={<Printer className="size-3.5" aria-hidden />}>
                Statement
              </Button>
            </Link>
            {can('customers:write') && (
              <Link to={`/customers/${c.id}/edit`}>
                <Button variant="outline" size="sm" icon={<Pencil className="size-3.5" aria-hidden />}>
                  Edit
                </Button>
              </Link>
            )}
            {can('transactions:record') && (
              <Link to={`/payments/receipt?customerId=${c.id}`}>
                <Button size="sm" icon={<Receipt className="size-3.5" aria-hidden />}>
                  Record payment
                </Button>
              </Link>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active accounts" value={c.activeAccountCount} sub={`${c.accounts.length} total (incl. closed)`} />
        <Stat
          label="Total outstanding"
          value={<Amount value={c.totalOutstanding.total} strong />}
          sub="Principal + interest + other"
        />
        <Stat label="Outstanding principal" value={<Amount value={c.totalOutstanding.principal} />} />
        <Stat label="Outstanding interest" value={<Amount value={c.totalOutstanding.interest} />} />
      </div>

      {c.notes && (
        <Card className="mb-6">
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{c.notes}</p>
          </CardBody>
        </Card>
      )}

      {/* Accounts */}
      <Card className="mb-6 overflow-hidden">
        <CardHeader
          title="Finance accounts"
          subtitle="One account per finance type per customer (BR-003)"
          actions={
            can('accounts:write') ? (
              <Link to={`/accounts/new?customerId=${c.id}`}>
                <Button size="sm" variant="outline" icon={<Plus className="size-3.5" aria-hidden />}>
                  New account
                </Button>
              </Link>
            ) : undefined
          }
        />
        {c.accounts.length === 0 ? (
          <EmptyState
            title="No accounts yet"
            description="Create a finance account (Free Hand, Gold, Papers, Property or Other) to start recording disbursements."
            action={
              can('accounts:write') ? (
                <Link to={`/accounts/new?customerId=${c.id}`}>
                  <Button icon={<Plus className="size-4" aria-hidden />}>New account</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border-base">
            {c.accounts.map((a) => (
              <li key={a.id}>
                <Link
                  to={`/accounts/${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-ink-50/70 dark:hover:bg-ink-900/40"
                >
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {FINANCE_TYPE_LABELS[a.financeType]}
                      {a.collateralBacked && (
                        <Badge tone="info" className="ml-2" title="Collateral-backed account">
                          Collateral
                        </Badge>
                      )}
                    </p>
                    <p className="num text-xs text-text-muted">
                      Disbursed <Amount value={a.disbursedAmount} muted /> · started {formatDate(a.startDate)}
                      {a.overdueDays > 0 && ` · ${a.overdueDays}d overdue`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[11px] text-text-muted">Outstanding</p>
                      <Amount value={a.outstanding.total} strong />
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Transactions */}
        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader title="Payment history" subtitle={`${c.transactions.length} transactions — newest first`} />
          {c.transactions.length === 0 ? (
            <EmptyState title="No transactions yet" description="Disbursements and receipts will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-base text-left text-xs uppercase tracking-wide text-text-muted">
                    <th scope="col" className="px-4 py-2">Date</th>
                    <th scope="col" className="px-4 py-2">Type</th>
                    <th scope="col" className="px-4 py-2">Method</th>
                    <th scope="col" className="px-4 py-2 text-right">Amount</th>
                    <th scope="col" className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {c.transactions.slice(0, 30).map((t) => (
                    <tr key={t.id} className="border-b border-border-base last:border-0">
                      <td className="px-4 py-2 text-text-secondary">{formatDate(t.date)}</td>
                      <td className="px-4 py-2">
                        <Link to={`/receipts/${t.id}`} className="font-medium text-text-primary hover:underline">
                          {TRANSACTION_TYPE_LABELS[t.type]}
                        </Link>
                        {t.reversalOfId && (
                          <Badge tone="warning" className="ml-1" title="Traceable correction — original entry retained">
                            Correction
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2 text-text-secondary">{PAYMENT_METHOD_LABELS[t.method]}</td>
                      <td className="px-4 py-2 text-right"><Amount value={t.amount} /></td>
                      <td className="px-4 py-2"><SyncBadge state={t.syncState} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Collateral + outstanding breakdown */}
        <div className="space-y-6">
          <Card>
            <CardBody>
              <OutstandingBreakdownView outstanding={c.totalOutstanding} />
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Collateral"
              actions={
                <Link to="/collateral">
                  <Button variant="ghost" size="sm">Register</Button>
                </Link>
              }
            />
            {c.collaterals.length === 0 ? (
              <p className="px-4 py-4 text-xs text-text-muted">No collateral recorded.</p>
            ) : (
              <ul className="divide-y divide-border-base">
                {c.collaterals.map((col) => (
                  <li key={col.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">{col.description}</p>
                        <p className="text-xs text-text-muted">
                          {accountLabel(
                            c.accounts.find((a) => a.id === col.accountId)?.financeType ?? 'other',
                            col.accountId,
                          )}{' '}
                          · recorded {formatDate(col.recordedAt)}
                        </p>
                      </div>
                      <Badge tone={col.status === 'held' ? 'info' : 'neutral'}>{col.status}</Badge>
                    </div>
                    {col.photos.length > 0 && (
                      <div className="mt-2 flex gap-2">
                        {col.photos.map((p) => (
                          <span key={p.id} className="inline-flex items-center rounded bg-ink-100 px-1.5 py-0.5 text-[10px] text-text-muted dark:bg-ink-800">
                            📷 {p.fileName}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardBody>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Due schedule</p>
              {c.scheduleItems.length === 0 ? (
                <p className="mt-2 text-xs text-text-muted">
                  No schedule configured. Schedule calendar behaviour is pending business approval (OD-006).
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {c.scheduleItems.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                      <div>
                        <p className="font-medium text-text-primary">{formatDate(s.dueDate)}</p>
                        <p className="text-text-muted">
                          Expected <Amount value={s.expectedAmount} muted /> · paid <Amount value={s.paidAmount} muted />
                        </p>
                      </div>
                      <StatusBadge status={s.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <p className="mt-6 text-[11px] text-text-muted">
        History is retained for closed accounts (CUS-006). Last updated {formatDateTime(c.updatedAt)}.
      </p>
    </div>
  )
}
