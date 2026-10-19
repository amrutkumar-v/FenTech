import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Receipt, WifiOff } from 'lucide-react'
import { getApi } from '@/api/provider'
import { newId } from '@/lib/ids'
import { todayISO } from '@/lib/dates'
import { parseUserAmount, canonicalMoney, d } from '@/lib/money'
import { PageHeader, Card, CardBody } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Field, Input, Select, Textarea } from '@/ui/Input'
import { Badge } from '@/ui/Badge'
import { useToast } from '@/ui/Toast'
import { useOfflineAction } from '@/offline/useOfflineAction'
import { useSync } from '@/offline/sync'
import { useCustomerAccounts, useAccountSummary, findOpenAccounts } from './hooks'
import { AllocationEditor, emptyAllocation, toAllocationLines } from './AllocationEditor'
import { OutstandingBreakdownView } from '@/ui/Amount'
import { LoadingState } from '@/ui/States'
import { FINANCE_TYPE_LABELS } from '@/lib/format'
import { useAuth } from '@/features/auth/AuthProvider'
import type { PaymentMethod, Transaction } from '@/domain/types'

export default function RecordPaymentPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const { status } = useSync()

  const preAccountId = params.get('accountId') ?? ''
  const preCustomerId = params.get('customerId') ?? ''

  const { data: customersData, isLoading: loadingCustomers } = useCustomerAccounts()
  const customers = useMemo(() => customersData?.items ?? [], [customersData])

  const [customerId, setCustomerId] = useState(preCustomerId)
  const [accountId, setAccountId] = useState(preAccountId)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [allocation, setAllocation] = useState(emptyAllocation())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<{ txnId: string | null; pending: boolean; opId?: string } | null>(null)

  // resolve customer when account preselected
  useEffect(() => {
    if (preAccountId && customers.length > 0 && !customerId) {
      const found = customers.find((c) => c.accounts.some((a) => a.id === preAccountId))
      if (found) setCustomerId(found.id)
    }
  }, [preAccountId, customers, customerId])

  const { data: account, isLoading: loadingAccount } = useAccountSummary(accountId || null)
  const customer = customers.find((c) => c.id === customerId)
  const openAccounts = customer ? findOpenAccounts(customer) : []

  const create = useOfflineAction<
    { id: string; customerId: string; accountId: string; amount: string; date: string; method: PaymentMethod; reference: string; notes: string; allocationLines: ReturnType<typeof toAllocationLines> },
    Transaction
  >({
    kind: 'create_transaction',
    online: (input) =>
      getApi().createTransaction({
        id: input.id,
        customerId: input.customerId,
        accountId: input.accountId,
        type: 'receipt',
        amount: input.amount,
        date: input.date,
        method: input.method,
        reference: input.reference || undefined,
        notes: input.notes || undefined,
        allocation: input.allocationLines,
      }),
    toPayload: (input) => ({
      id: input.id,
      customerId: input.customerId,
      accountId: input.accountId,
      type: 'receipt',
      amount: input.amount,
      date: input.date,
      method: input.method,
      reference: input.reference || undefined,
      notes: input.notes || undefined,
      allocation: input.allocationLines,
    }),
    invalidate: [['customers'], ['account', accountId], ['transactions'], ['customer', customerId]],
  })

  const allocLines = toAllocationLines(allocation)
  const allocSum = allocLines.reduce((s, l) => s + Number(l.amount), 0)
  const amtParsed = parseUserAmount(amount)
  const balanced = amtParsed !== null && d(amtParsed).gt(0) && Math.abs(allocSum - Number(amtParsed)) < 0.005

  function validate(): boolean {
    const fe: Record<string, string> = {}
    if (!customerId) fe.customer = 'Select a customer.'
    if (!accountId) fe.account = 'Select the account this payment belongs to.'
    if (!amount.trim()) fe.amount = 'Amount is required.'
    else if (!amtParsed) fe.amount = 'Enter a valid amount.'
    else if (d(amtParsed).lte(0)) fe.amount = 'Amount must be greater than zero.'
    if (!balanced) fe.allocation = 'Allocation must total the received amount (PAY-005).'
    if (!date) fe.date = 'Date is required.'
    if ((method === 'upi' || method === 'bank_transfer') && !reference.trim()) {
      fe.reference = 'Digital payments should record a reference/UTR (OD-017 — requirements to be confirmed).'
    }
    setFieldErrors(fe)
    return Object.keys(fe).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saved) return // double-submit guard
    if (!validate()) return
    try {
      const res = await create.run({
        id: newId('txn'),
        customerId,
        accountId,
        amount: canonicalMoney(amtParsed!),
        date,
        method,
        reference,
        notes,
        allocationLines: allocLines,
      })
      setSaved({ txnId: res.data?.id ?? null, pending: res.pendingSync, opId: res.opId })
      if (res.pendingSync) {
        toast.warning(
          'Payment saved on this device — PENDING SYNC',
          'This receipt is NOT yet confirmed by the central database. It will sync when you are online.',
        )
      } else {
        toast.success('Payment recorded')
      }
    } catch {
      toast.error('Could not record payment', create.error?.message)
    }
  }

  if (loadingCustomers && !preAccountId) return <LoadingState label="Loading customers…" />

  if (saved) {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader
          title={saved.pending ? 'Payment saved on this device' : 'Payment recorded'}
          subtitle={
            saved.pending
              ? 'Pending sync — not yet confirmed by the central database (SRS 7.2)'
              : 'Saved to the central database'
          }
        />
        <Card>
          <CardBody className="space-y-3">
            {saved.pending && (
              <div className="flex items-start gap-2 rounded-lg border border-violet-300 bg-violet-50 p-3 text-xs text-violet-900 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200">
                <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">Locally saved, not yet synced</p>
                  <p className="mt-0.5">
                    This payment has a stable ID ({saved.opId?.slice(0, 8)}…) and is queued. It will sync
                    automatically when the device comes online. Do NOT record the same payment again —
                    retries are idempotent and will not create duplicates.
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              {saved.txnId && (
                <Link to={`/receipts/${saved.txnId}`}>
                  <Button icon={<Receipt className="size-4" aria-hidden />}>View receipt</Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => navigate(`/customers/${customerId}`)}>
                Customer profile
              </Button>
              {!saved.pending && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSaved(null)
                    setAmount('')
                    setAllocation(emptyAllocation())
                    setReference('')
                    setNotes('')
                  }}
                >
                  Record another
                </Button>
              )}
            </div>
            {status.connectivity === 'offline' && (
              <p className="text-xs text-text-muted">
                You are offline. Open{' '}
                <Link to="/settings/sync" className="underline">
                  Sync status
                </Link>{' '}
                to watch this record sync.
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Record payment received"
        subtitle="Cash is the default. Partial payments are allowed (PAY-004)."
        back={
          <Link
            to={accountId ? `/accounts/${accountId}` : '/collections'}
            className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden /> Back
          </Link>
        }
      />

      <Card>
        <CardBody>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer" htmlFor="customer" required error={fieldErrors.customer}>
                <Select
                  id="customer"
                  value={customerId}
                  invalid={!!fieldErrors.customer}
                  onChange={(e) => {
                    setCustomerId(e.target.value)
                    setAccountId('')
                  }}
                >
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.phone}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Account" htmlFor="account" required error={fieldErrors.account}>
                <Select
                  id="account"
                  value={accountId}
                  invalid={!!fieldErrors.account}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={!customerId}
                >
                  <option value="">Select account…</option>
                  {openAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {FINANCE_TYPE_LABELS[a.financeType]} — outstanding {formatSimple(a.outstanding.total)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {account && loadingAccount && <LoadingState label="Loading account…" />}
            {account && !loadingAccount && (
              <div className="rounded-lg bg-surface-sunken p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-text-muted">
                    {account.customerName} · {FINANCE_TYPE_LABELS[account.financeType]} account
                  </p>
                  <Badge tone={account.status === 'overdue' ? 'danger' : 'success'}>{account.status}</Badge>
                </div>
                <div className="mt-2">
                  <OutstandingBreakdownView outstanding={account.outstanding} />
                </div>
                <p className="mt-1 text-[11px] text-text-muted">
                  Outstanding figures are sums of recorded allocations. Interest is never auto-calculated.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount received (₹)" htmlFor="amount" required error={fieldErrors.amount}>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  invalid={!!fieldErrors.amount}
                  placeholder="e.g. 3000"
                  className="num text-base font-semibold"
                />
              </Field>
              <Field label="Date" htmlFor="date" required error={fieldErrors.date}>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} invalid={!!fieldErrors.date} />
              </Field>
            </div>

            <Field label="Payment method" htmlFor="method" hint="Cash is prioritised; digital methods stay distinguishable in reports (PAY-002, PAY-010).">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Payment method">
                {(
                  [
                    { id: 'cash', label: 'Cash' },
                    { id: 'upi', label: 'UPI' },
                    { id: 'bank_transfer', label: 'Bank transfer' },
                    { id: 'other', label: 'Other' },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={method === m.id}
                    onClick={() => setMethod(m.id)}
                    className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors
                      ${method === m.id ? 'border-brand-600 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100' : 'border-border-strong bg-surface text-text-secondary hover:bg-ink-50 dark:hover:bg-ink-800'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Field>

            {method !== 'cash' && (
              <Field label="Reference / UTR" htmlFor="reference" required error={fieldErrors.reference}>
                <Input
                  id="reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  invalid={!!fieldErrors.reference}
                  placeholder="e.g. UPI ref 4451…"
                />
              </Field>
            )}

            {amount && amtParsed && d(amtParsed).gt(0) && accountId && (
              <AllocationEditor
                amount={canonicalMoney(amtParsed)}
                value={allocation}
                onChange={setAllocation}
                outstanding={
                  account
                    ? { principal: account.outstanding.principal, interest: account.outstanding.interest, other: account.outstanding.other }
                    : undefined
                }
              />
            )}
            {fieldErrors.allocation && (
              <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
                {fieldErrors.allocation}
              </p>
            )}

            <Field label="Notes" htmlFor="notes" hint="Optional">
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </Field>

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" loading={create.busy} disabled={!!saved} icon={<Receipt className="size-4" aria-hidden />}>
                Save payment
              </Button>
              <Link to={accountId ? `/accounts/${accountId}` : '/collections'}>
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
              {status.connectivity === 'offline' && (
                <span className="text-xs text-text-muted">Will be saved on this device (pending sync)</span>
              )}
            </div>
            <p className="text-[11px] text-text-muted">
              Signed in as {user?.name}. The operator is recorded on every transaction.
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}

function formatSimple(value: string): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value))
}
