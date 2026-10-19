import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Pencil, Receipt, Banknote, Printer, Lock } from 'lucide-react'
import { getApi } from '@/api/provider'
import { PageHeader, Card, CardHeader, CardBody, Stat } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge, StatusBadge, SyncBadge } from '@/ui/Badge'
import { Amount, OutstandingBreakdownView } from '@/ui/Amount'
import { LoadingState, ErrorState, EmptyState } from '@/ui/States'
import { PhotoGallery } from '@/ui/Photo'
import { formatDate, formatDateTime } from '@/lib/dates'
import { PAYMENT_METHOD_LABELS, TRANSACTION_TYPE_LABELS, FINANCE_TYPE_LABELS } from '@/lib/format'
import { addMoney, d } from '@/lib/money'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Transaction } from '@/domain/types'

interface LedgerRow {
  txn: Transaction
  principalDelta: string
  interestDelta: string
  otherDelta: string
  runningPrincipal: string
  runningInterest: string
  runningOther: string
  runningTotal: string
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { can } = useAuth()

  const { data: account, isLoading, error, refetch } = useQuery({
    queryKey: ['account', id],
    queryFn: () => getApi().getAccount(id!),
    enabled: !!id,
  })

  const { data: txns } = useQuery({
    queryKey: ['transactions', 'account', id],
    queryFn: () => getApi().listTransactions({ accountId: id, pageSize: 200 }),
    enabled: !!id,
  })

  const { data: termsHistory } = useQuery({
    queryKey: ['terms', id],
    queryFn: () => getApi().listTermsHistory(id!),
    enabled: !!id,
  })

  const { data: collaterals } = useQuery({
    queryKey: ['collateral', 'account', id],
    queryFn: () => getApi().listCollateral({ accountId: id }),
    enabled: !!id,
  })

  const ledger = useMemo<LedgerRow[]>(() => {
    const items = [...(txns?.items ?? [])].sort((a, b) => (a.datetime < b.datetime ? -1 : 1))
    let rp = '0'
    let ri = '0'
    let ro = '0'
    return items.map((txn) => {
      // reversals carry negative allocation lines; treat type 'reversal' as opposite of its sign already baked in
      const sign =
        txn.type === 'disbursement' ? 1 : txn.type === 'reversal' ? -1 : txn.type === 'adjustment' ? 1 : -1
      let pd = '0'
      let id_ = '0'
      let od = '0'
      for (const line of txn.allocation) {
        const signed = d(line.amount).times(sign).toString()
        if (line.component === 'principal') pd = addMoney(pd, signed)
        else if (line.component === 'interest') id_ = addMoney(id_, signed)
        else od = addMoney(od, signed)
      }
      rp = addMoney(rp, pd)
      ri = addMoney(ri, id_)
      ro = addMoney(ro, od)
      return {
        txn,
        principalDelta: pd,
        interestDelta: id_,
        otherDelta: od,
        runningPrincipal: rp,
        runningInterest: ri,
        runningOther: ro,
        runningTotal: addMoney(rp, ri, ro),
      }
    })
  }, [txns])

  if (isLoading) return <LoadingState label="Loading account…" />
  if (error || !account) return <ErrorState message={error instanceof Error ? error.message : 'Account not found.'} onRetry={() => void refetch()} />

  const a = account
  const isOpen = a.status === 'active' || a.status === 'overdue'

  return (
    <div>
      <PageHeader
        back={
          <Link to={`/customers/${a.customerId}`} className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary">
            <ArrowLeft className="size-3.5" aria-hidden /> {a.customerName}
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            {FINANCE_TYPE_LABELS[a.financeType]} account
            <StatusBadge status={a.status} />
            <SyncBadge state={a.syncState} />
          </span>
        }
        subtitle={`Account ${a.id} · started ${formatDate(a.startDate)} · ${a.customerName} (${a.customerPhone})`}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<Printer className="size-3.5" aria-hidden />} onClick={() => window.print()}>
              Print
            </Button>
            {can('transactions:record') && isOpen && (
              <Link to={`/payments/receipt?accountId=${a.id}`}>
                <Button size="sm" icon={<Receipt className="size-3.5" aria-hidden />}>
                  Record payment
                </Button>
              </Link>
            )}
            {can('transactions:record') && isOpen && (
              <Link to={`/payments/disburse?accountId=${a.id}`}>
                <Button variant="outline" size="sm" icon={<Banknote className="size-3.5" aria-hidden />}>
                  Disburse
                </Button>
              </Link>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Disbursed" value={<Amount value={a.disbursedTotal} />} />
        <Stat label="Received" value={<Amount value={a.receivedTotal} />} />
        <Stat label="Total outstanding" value={<Amount value={a.outstanding.total} strong />} tone={d(a.outstanding.total).gt(0) ? 'warning' : 'positive'} />
        <Stat
          label={a.overdueDays > 0 ? `Overdue (${a.overdueDays}d)` : 'Next due'}
          value={a.nextDueDate ? formatDate(a.nextDueDate) : 'No schedule'}
          tone={a.overdueDays > 0 ? 'danger' : 'default'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Ledger */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Account ledger"
              subtitle="Chronological entries with running balances. Principal, interest and other dues tracked separately (PAY-009)."
            />
            {ledger.length === 0 ? (
              <EmptyState title="No transactions yet" description="Record the disbursement to open this ledger." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-base text-left text-xs uppercase tracking-wide text-text-muted">
                      <th scope="col" className="px-3 py-2">Date</th>
                      <th scope="col" className="px-3 py-2">Entry</th>
                      <th scope="col" className="px-3 py-2 text-right">Principal Δ</th>
                      <th scope="col" className="px-3 py-2 text-right">Interest Δ</th>
                      <th scope="col" className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => (
                      <tr
                        key={row.txn.id}
                        className={`border-b border-border-base last:border-0 ${row.txn.type === 'reversal' ? 'bg-amber-50/50 dark:bg-amber-950/30' : ''}`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-text-secondary">{formatDate(row.txn.date)}</td>
                        <td className="px-3 py-2">
                          <Link to={`/receipts/${row.txn.id}`} className="font-medium text-text-primary hover:underline">
                            {TRANSACTION_TYPE_LABELS[row.txn.type]}
                          </Link>
                          <span className="num ml-2 text-xs text-text-muted">
                            <Amount value={row.txn.amount} muted />
                          </span>
                          <span className="ml-2 text-xs text-text-muted">
                            {PAYMENT_METHOD_LABELS[row.txn.method]}
                          </span>
                          {row.txn.reversalOfId && (
                            <Badge tone="warning" className="ml-1" title={row.txn.reversalReason}>
                              Reversal
                            </Badge>
                          )}
                          {row.txn.reversedById && (
                            <Badge tone="danger" className="ml-1" title="This entry was reversed; it remains visible for traceability (PAY-008).">
                              Reversed
                            </Badge>
                          )}
                          <SyncBadge state={row.txn.syncState} />
                        </td>
                        <td className="num px-3 py-2 text-right"><Amount value={row.principalDelta} signed muted /></td>
                        <td className="num px-3 py-2 text-right"><Amount value={row.interestDelta} signed muted /></td>
                        <td className="num px-3 py-2 text-right"><Amount value={row.runningTotal} strong /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Terms history */}
          <Card className="overflow-hidden">
            <CardHeader
              title="Agreement terms"
              subtitle="Versioned — changes never rewrite past calculations (ACC-008, INT-005)"
              actions={
                can('terms:write') && isOpen ? (
                  <Link to={`/accounts/${a.id}/terms`}>
                    <Button size="sm" variant="outline" icon={<Pencil className="size-3.5" aria-hidden />}>
                      Change terms
                    </Button>
                  </Link>
                ) : undefined
              }
            />
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Current terms (v{a.currentTerms.versionNo})</p>
                  <dl className="mt-2 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-muted">Effective from</dt>
                      <dd className="num text-text-primary">{formatDate(a.currentTerms.effectiveFrom)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-muted">Interest method</dt>
                      <dd className="capitalize text-text-primary">{a.currentTerms.interestMethod.replace('_', ' ')}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-muted">Rate</dt>
                      <dd className="num text-text-primary">
                        {a.currentTerms.rateValue === '0' ? '—' : `${a.currentTerms.rateValue} (${a.currentTerms.rateUnit.replace('_', ' ')})`}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-text-muted">Repayment</dt>
                      <dd className="capitalize text-text-primary">{a.currentTerms.repaymentFrequency}</dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Agreement text</p>
                  <p className="mt-2 whitespace-pre-wrap rounded-md bg-surface-sunken p-3 text-sm text-text-secondary">
                    {a.currentTerms.agreementTerms}
                  </p>
                </div>
              </div>
              {(termsHistory?.length ?? 0) > 1 && (
                <div className="mt-4 border-t border-border-base pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Previous versions</p>
                  <ul className="space-y-1.5">
                    {termsHistory!.filter((t) => t.id !== a.currentTerms.id).map((t) => (
                      <li key={t.id} className="text-xs text-text-secondary">
                        <span className="font-medium">v{t.versionNo}</span> · {formatDate(t.effectiveFrom)} – {t.effectiveTo ? formatDate(t.effectiveTo) : 'current'}
                        {t.changedReason && <span className="text-text-muted"> — {t.changedReason}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardBody>
              <OutstandingBreakdownView outstanding={a.outstanding} />
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Collateral"
              actions={
                <Link to="/collateral">
                  <Button variant="ghost" size="sm">Manage</Button>
                </Link>
              }
            />
            {(collaterals?.items.length ?? 0) === 0 ? (
              <p className="px-4 py-3 text-xs text-text-muted">
                {a.collateralBacked ? 'Collateral expected — add photos in the register.' : 'No collateral (Free Hand / not collateral-backed).'}
              </p>
            ) : (
              <ul className="divide-y divide-border-base">
                {collaterals!.items.map((entry) => (
                  <li key={entry.collateral.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">{entry.collateral.description}</p>
                        <p className="text-xs text-text-muted">
                          {entry.collateral.reference ? `Ref ${entry.collateral.reference} · ` : ''}
                          recorded {formatDate(entry.collateral.recordedAt)}
                        </p>
                      </div>
                      <Badge tone={entry.collateral.status === 'held' ? 'info' : 'neutral'}>{entry.collateral.status}</Badge>
                    </div>
                    <div className="mt-2">
                      <PhotoGallery photos={entry.collateral.photos} emptyLabel="No photos attached" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {can('accounts:close') && (
            <Card>
              <CardBody>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  <Lock className="size-3.5" aria-hidden /> Closure
                </p>
                {isOpen ? (
                  <>
                    <p className="mt-2 text-xs text-text-secondary">
                      An account can be closed only after all approved dues are settled and confirmed (ACC-007, BR-006).
                    </p>
                    <Link to={`/accounts/${a.id}/close`} className="mt-3 block">
                      <Button variant="outline" size="sm" className="w-full">
                        Review settlement & close
                      </Button>
                    </Link>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-text-secondary">
                    This account is {a.status}. History is permanently retained.
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          <p className="text-[11px] text-text-muted">
            Last updated {formatDateTime(a.updatedAt)}.
            {a.syncState !== 'synced' && ' This account record has local changes pending sync.'}
          </p>
        </div>
      </div>
    </div>
  )
}
