import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Banknote, WifiOff } from 'lucide-react'
import { getApi } from '@/api/provider'
import { newId } from '@/lib/ids'
import { todayISO } from '@/lib/dates'
import { parseUserAmount, canonicalMoney, d } from '@/lib/money'
import { PageHeader, Card, CardBody } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Field, Input, Select, Textarea } from '@/ui/Input'
import { useToast } from '@/ui/Toast'
import { useOfflineAction } from '@/offline/useOfflineAction'
import { useCustomerAccounts, findOpenAccounts } from './hooks'
import { AllocationEditor, toAllocationLines } from './AllocationEditor'
import { LoadingState } from '@/ui/States'
import { FINANCE_TYPE_LABELS } from '@/lib/format'
import type { PaymentMethod, Transaction } from '@/domain/types'

export default function RecordDisbursementPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()

  const preAccountId = params.get('accountId') ?? ''

  const { data: customersData, isLoading } = useCustomerAccounts()
  const customers = useMemo(() => customersData?.items ?? [], [customersData])

  const [customerId, setCustomerId] = useState('')
  const [accountId, setAccountId] = useState(preAccountId)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [allocation, setAllocation] = useState<Record<string, string>>({ principal: '', interest: '', other: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<{ txnId: string | null; pending: boolean } | null>(null)

  useEffect(() => {
    if (preAccountId && customers.length > 0 && !customerId) {
      const found = customers.find((c) => c.accounts.some((a) => a.id === preAccountId))
      if (found) setCustomerId(found.id)
    }
  }, [preAccountId, customers, customerId])

  const customer = customers.find((c) => c.id === customerId)
  const openAccounts = customer ? findOpenAccounts(customer) : []

  const create = useOfflineAction<Record<string, unknown>, Transaction>({
    kind: 'create_transaction',
    online: (input) => getApi().createTransaction(input as never),
    toPayload: (input) => input,
    invalidate: [['customers'], ['transactions'], ['account', accountId]],
  })

  const allocLines = toAllocationLines(allocation as never)
  const amtParsed = parseUserAmount(amount)

  function validate(): boolean {
    const fe: Record<string, string> = {}
    if (!customerId) fe.customer = 'Select a customer.'
    if (!accountId) fe.account = 'Select the account to disburse against.'
    if (!amount.trim()) fe.amount = 'Amount is required.'
    else if (!amtParsed || d(amtParsed).lte(0)) fe.amount = 'Enter a valid positive amount.'
    if (allocLines.length === 0) fe.allocation = 'State the allocation (usually all principal) for this disbursement.'
    if ((method === 'upi' || method === 'bank_transfer') && !reference.trim()) {
      fe.reference = 'Digital disbursements should record a transfer reference.'
    }
    setFieldErrors(fe)
    return Object.keys(fe).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (saved) return
    if (!validate()) return
    const id = newId('txn')
    try {
      const res = await create.run({
        id,
        customerId,
        accountId,
        type: 'disbursement',
        amount: canonicalMoney(amtParsed!),
        date,
        method,
        reference: reference || undefined,
        notes: notes || undefined,
        allocation: allocLines,
      })
      setSaved({ txnId: res.data?.id ?? id, pending: res.pendingSync })
      if (res.pendingSync) {
        toast.warning('Disbursement saved on this device — PENDING SYNC', 'Not yet confirmed by the central database.')
      } else {
        toast.success('Disbursement recorded')
      }
    } catch {
      toast.error('Could not record disbursement', create.error?.message)
    }
  }

  if (isLoading && !preAccountId) return <LoadingState />

  if (saved) {
    return (
      <div className="mx-auto max-w-lg">
        <PageHeader
          title={saved.pending ? 'Disbursement saved on this device' : 'Disbursement recorded'}
          subtitle={saved.pending ? 'Pending sync — not yet confirmed by the server' : 'Saved to the central database'}
        />
        <Card>
          <CardBody className="flex flex-wrap gap-2">
            {saved.pending && (
              <p className="mb-2 flex w-full items-center gap-2 rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                <WifiOff className="size-4" aria-hidden /> Queued for sync. Do not re-enter this disbursement.
              </p>
            )}
            {saved.txnId && (
              <Link to={`/receipts/${saved.txnId}`}>
                <Button icon={<Banknote className="size-4" aria-hidden />}>View record</Button>
              </Link>
            )}
            <Button variant="outline" onClick={() => navigate(`/accounts/${accountId}`)}>
              Account ledger
            </Button>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Record disbursement"
        subtitle="Money given to the customer against the selected account (PAY-001)."
        back={
          <Link
            to={accountId ? `/accounts/${accountId}` : '/customers'}
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
                <Select id="account" value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={!customerId} invalid={!!fieldErrors.account}>
                  <option value="">Select account…</option>
                  {openAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {FINANCE_TYPE_LABELS[a.financeType]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount disbursed (₹)" htmlFor="amount" required error={fieldErrors.amount}>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    // default allocation: all principal
                    const parsed = parseUserAmount(e.target.value)
                    if (parsed) setAllocation({ principal: parsed, interest: '', other: '' })
                  }}
                  invalid={!!fieldErrors.amount}
                  className="num text-base font-semibold"
                  placeholder="e.g. 50000"
                />
              </Field>
              <Field label="Date" htmlFor="date" required>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>

            <Field label="Method" htmlFor="method" hint="Cash-first interface; digital methods remain supported (PAY-002).">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Disbursement method">
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
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${method === m.id ? 'border-brand-600 bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100' : 'border-border-strong bg-surface text-text-secondary hover:bg-ink-50 dark:hover:bg-ink-800'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </Field>

            {method !== 'cash' && (
              <Field label="Transfer reference" htmlFor="reference" required error={fieldErrors.reference}>
                <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} invalid={!!fieldErrors.reference} />
              </Field>
            )}

            {amount && amtParsed && d(amtParsed).gt(0) && (
              <>
                <AllocationEditor
                  amount={canonicalMoney(amtParsed)}
                  value={allocation as never}
                  onChange={(v) => setAllocation(v)}
                />
                {fieldErrors.allocation && (
                  <p className="text-xs font-medium text-red-600" role="alert">
                    {fieldErrors.allocation}
                  </p>
                )}
              </>
            )}

            <Field label="Notes" htmlFor="notes" hint="Optional">
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </Field>

            <div className="flex gap-2">
              <Button type="submit" loading={create.busy} disabled={!!saved}>
                Save disbursement
              </Button>
              <Link to={accountId ? `/accounts/${accountId}` : '/customers'}>
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
