import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Undo2, Receipt } from 'lucide-react'
import { getApi } from '@/api/provider'
import { PageHeader, Card } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Input, Select, Field } from '@/ui/Input'
import { Badge, SyncBadge } from '@/ui/Badge'
import { Amount } from '@/ui/Amount'
import { Modal } from '@/ui/Modal'
import { Textarea } from '@/ui/Input'
import { EmptyState, ErrorState, SkeletonTable } from '@/ui/States'
import { Pagination } from '@/ui/Pagination'
import { PeriodFilter, usePeriod } from '@/ui/PeriodFilter'
import { useToast } from '@/ui/Toast'
import { formatDate } from '@/lib/dates'
import { PAYMENT_METHOD_LABELS, TRANSACTION_TYPE_LABELS } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import type { Transaction, TransactionType, PaymentMethod } from '@/domain/types'

export default function TransactionsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<TransactionType | ''>('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [page, setPage] = useState(1)
  const { period, setPeriod, range } = usePeriod('this_month')
  const [reverseTarget, setReverseTarget] = useState<Transaction | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [busy, setBusy] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['transactions', search, type, method, period, page],
    queryFn: () =>
      getApi().listTransactions({
        search: search || undefined,
        type: type || undefined,
        method: method || undefined,
        range,
        page,
        pageSize: 30,
      }),
    placeholderData: (prev) => prev,
  })

  async function doReverse() {
    if (!reverseTarget) return
    if (!reverseReason.trim()) {
      toast.error('Reason required', 'Corrections must state a reason for the audit trail (PAY-008).')
      return
    }
    setBusy(true)
    try {
      await getApi().reverseTransaction(reverseTarget.id, { reason: reverseReason.trim(), date: new Date().toISOString().slice(0, 10) })
      qc.invalidateQueries({ queryKey: ['transactions'] }).catch(() => {})
      qc.invalidateQueries({ queryKey: ['account'] }).catch(() => {})
      qc.invalidateQueries({ queryKey: ['customer'] }).catch(() => {})
      toast.success('Reversal recorded', 'The original entry remains visible and traceable.')
      setReverseTarget(null)
      setReverseReason('')
    } catch (err) {
      toast.error('Could not reverse', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Transaction ledger"
        subtitle="All disbursements, receipts, adjustments and reversals across accounts."
        actions={
          <>
            <Link to="/payments/receipt">
              <Button size="sm">Record payment</Button>
            </Link>
            <Link to="/payments/disburse">
              <Button size="sm" variant="outline">Disburse</Button>
            </Link>
          </>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="mb-3">
          <PeriodFilter value={period} onChange={(p) => { setPeriod(p); setPage(1) }} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
            <Input
              type="search"
              placeholder="Search ID, reference, amount…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9"
              aria-label="Search transactions"
            />
          </div>
          <Select value={type} onChange={(e) => { setType(e.target.value as TransactionType | ''); setPage(1) }} aria-label="Filter by type">
            <option value="">All types</option>
            <option value="disbursement">Disbursement</option>
            <option value="receipt">Payment received</option>
            <option value="adjustment">Adjustment</option>
            <option value="reversal">Reversal</option>
          </Select>
          <Select value={method} onChange={(e) => { setMethod(e.target.value as PaymentMethod | ''); setPage(1) }} aria-label="Filter by method">
            <option value="">All methods</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </Select>
        </div>
      </Card>

      {isLoading && <SkeletonTable rows={8} cols={5} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load transactions.'} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <Card>
          <EmptyState title="No transactions match" description="Adjust the filters or date range." />
        </Card>
      )}

      {data && data.items.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-base text-left text-xs uppercase tracking-wide text-text-muted">
                  <th scope="col" className="px-3 py-2">Date</th>
                  <th scope="col" className="px-3 py-2">Type</th>
                  <th scope="col" className="px-3 py-2">Account</th>
                  <th scope="col" className="px-3 py-2">Method</th>
                  <th scope="col" className="px-3 py-2 text-right">Amount</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2 no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b border-border-base last:border-0 ${t.type === 'reversal' ? 'bg-amber-50/40 dark:bg-amber-950/25' : ''}`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-text-secondary">{formatDate(t.date)}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-text-primary">{TRANSACTION_TYPE_LABELS[t.type]}</span>
                      {t.reversalOfId && (
                        <Badge tone="warning" className="ml-1" title={t.reversalReason}>Correction</Badge>
                      )}
                      {t.reversedById && <Badge tone="danger" className="ml-1">Reversed</Badge>}
                      <p className="num text-[11px] text-text-muted">{t.id.slice(0, 16)}…</p>
                    </td>
                    <td className="px-3 py-2">
                      <Link to={`/accounts/${t.accountId}`} className="text-text-primary hover:underline" title={t.accountId}>
                        Account {t.accountId.slice(-6)}
                      </Link>
                      <p className="text-[11px] text-text-muted">{t.customerId.slice(0, 14)}…</p>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{PAYMENT_METHOD_LABELS[t.method]}</td>
                    <td className="px-3 py-2 text-right"><Amount value={t.amount} /></td>
                    <td className="px-3 py-2"><SyncBadge state={t.syncState} /></td>
                    <td className="px-3 py-2 no-print">
                      <div className="flex items-center gap-1">
                        <Link to={`/receipts/${t.id}`} title="Open receipt">
                          <Button variant="ghost" size="sm" icon={<Receipt className="size-3.5" aria-hidden />} aria-label="Open receipt" />
                        </Link>
                        {can('transactions:reverse') && t.type !== 'reversal' && !t.reversedById && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Undo2 className="size-3.5" aria-hidden />}
                            aria-label="Reverse transaction"
                            title="Reverse (traceable correction)"
                            onClick={() => setReverseTarget(t)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </Card>
      )}

      <Modal
        open={!!reverseTarget}
        onClose={() => setReverseTarget(null)}
        title="Reverse transaction"
        footer={
          <>
            <Button variant="outline" onClick={() => setReverseTarget(null)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={() => void doReverse()}>
              Record reversal
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          A reversal is a NEW linked entry — the original is never deleted or silently overwritten (PAY-008, BR-009).
        </p>
        {reverseTarget && (
          <div className="mt-3 rounded-md bg-surface-sunken p-3 text-sm">
            <p className="font-medium text-text-primary">{TRANSACTION_TYPE_LABELS[reverseTarget.type]}</p>
            <p className="num text-text-secondary">
              <Amount value={reverseTarget.amount} /> · {formatDate(reverseTarget.date)} · {PAYMENT_METHOD_LABELS[reverseTarget.method]}
            </p>
            <p className="num mt-1 text-[11px] text-text-muted">ID {reverseTarget.id}</p>
          </div>
        )}
        <div className="mt-3">
          <Field label="Reason for correction" htmlFor="rev-reason" required hint="Stored in the audit trail with your name and timestamp.">
            <Textarea
              id="rev-reason"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              placeholder="e.g. Amount entered incorrectly — actual payment was ₹2,000 not ₹20,000"
              rows={3}
            />
          </Field>
        </div>
      </Modal>
    </div>
  )
}