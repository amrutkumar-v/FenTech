import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Wallet, Calculator } from 'lucide-react'
import { getApi } from '@/api/provider'
import { newId } from '@/lib/ids'
import { todayISO, formatDate } from '@/lib/dates'
import { parseUserAmount, canonicalMoney, d } from '@/lib/money'
import { PageHeader, Card, CardHeader, CardBody, Stat } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Field, Input, Select, Textarea } from '@/ui/Input'
import { Modal } from '@/ui/Modal'
import { Amount, AmountLine } from '@/ui/Amount'
import { EmptyState, ErrorState, SkeletonTable } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { useOfflineAction } from '@/offline/useOfflineAction'
import { useAuth } from '@/features/auth/AuthProvider'
import { PAYMENT_METHOD_LABELS } from '@/lib/format'
import type { ExpenseCategory, PaymentMethod } from '@/domain/types'

const CATEGORIES: ExpenseCategory[] = [
  'rent', 'salary', 'travel', 'supplies', 'utilities', 'fuel', 'food', 'maintenance', 'other',
]

export default function CashbookPage() {
  const toast = useToast()
  const qc = useQueryClient()
  const { can } = useAuth()
  const [date, setDate] = useState(todayISO())
  const [tab, setTab] = useState<'cashbook' | 'expenses'>('cashbook')

  const [openingAmount, setOpeningAmount] = useState('')
  const [openingNote, setOpeningNote] = useState('')
  const [showOpening, setShowOpening] = useState(false)

  const [countAmount, setCountAmount] = useState('')
  const [countNote, setCountNote] = useState('')
  const [showCount, setShowCount] = useState(false)

  const [expOpen, setExpOpen] = useState(false)
  const [expAmount, setExpAmount] = useState('')
  const [expDate, setExpDate] = useState(todayISO())
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('travel')
  const [expMethod, setExpMethod] = useState<PaymentMethod>('cash')
  const [expNotes, setExpNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const { data: cashbook, isLoading, error, refetch } = useQuery({
    queryKey: ['cashbook', date],
    queryFn: () => getApi().getCashbook(date),
  })

  const { data: expenses } = useQuery({
    queryKey: ['expenses', date],
    queryFn: () => getApi().listExpenses({ range: { from: date, to: date } }),
  })

  async function saveOpening() {
    const amt = parseUserAmount(openingAmount)
    if (!amt || d(amt).lt(0)) {
      toast.error('Invalid amount', 'Enter the physical opening cash for this day.')
      return
    }
    setBusy(true)
    try {
      await getApi().setOpeningCash({ date, amount: canonicalMoney(amt), note: openingNote || undefined })
      qc.invalidateQueries({ queryKey: ['cashbook'] }).catch(() => {})
      toast.success('Opening cash saved')
      setShowOpening(false)
      setOpeningAmount('')
      setOpeningNote('')
    } catch (err) {
      toast.error('Could not save', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  async function saveCount() {
    const amt = parseUserAmount(countAmount)
    if (!amt || d(amt).lt(0)) {
      toast.error('Invalid amount', 'Enter the actual cash counted in the drawer.')
      return
    }
    setBusy(true)
    try {
      await getApi().recordCashCount(date, { actualCountedCash: canonicalMoney(amt), note: countNote || undefined })
      qc.invalidateQueries({ queryKey: ['cashbook'] }).catch(() => {})
      toast.success('Cash count recorded')
      setShowCount(false)
      setCountNote('')
    } catch (err) {
      toast.error('Could not save count', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  const createExpense = useOfflineAction<
    { amount: string; category: ExpenseCategory; method: PaymentMethod; notes: string },
    unknown
  >({
    kind: 'create_expense',
    online: (input) =>
      getApi().createExpense({
        id: newId('exp'),
        date: expDate,
        amount: input.amount,
        category: input.category,
        method: input.method,
        notes: input.notes || undefined,
      }),
    toPayload: (input) => ({
      id: newId('exp'),
      date: expDate,
      amount: input.amount,
      category: input.category,
      method: input.method,
      notes: input.notes || undefined,
    }),
    invalidate: [['expenses'], ['cashbook']],
  })

  async function saveExpense() {
    const amt = parseUserAmount(expAmount)
    if (!amt || d(amt).lte(0)) {
      toast.error('Invalid amount', 'Expense amount must be greater than zero.')
      return
    }
    try {
      const res = await createExpense.run({
        amount: canonicalMoney(amt),
        category: expCategory,
        method: expMethod,
        notes: expNotes,
      })
      toast.success(
        res.pendingSync ? 'Expense saved on this device (pending sync)' : 'Expense recorded',
        'Expenses are kept separate from customer loan transactions (CASH-003).',
      )
      setExpOpen(false)
      setExpAmount('')
      setExpNotes('')
    } catch {
      toast.error('Could not record expense', createExpense.error?.message)
    }
  }

  return (
    <div>
      <PageHeader
        title="Cashbook"
        subtitle="Physical cash position, movements and business expenses (CASH-001…007)."
        actions={
          <>
            <div className="flex items-center gap-2">
              <label htmlFor="cb-date" className="sr-only">Cashbook date</label>
              <Input id="cb-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            </div>
            {can('expenses:write') && (
              <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => setExpOpen(true)}>
                Add expense
              </Button>
            )}
          </>
        }
      />

      <div className="mb-4 inline-flex rounded-md border border-border-strong bg-surface p-0.5" role="tablist" aria-label="Cashbook sections">
        {(
          [
            { id: 'cashbook', label: 'Cashbook' },
            { id: 'expenses', label: 'Expenses' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded px-3 py-1.5 text-xs font-medium ${tab === t.id ? 'bg-brand-700 text-white' : 'text-text-secondary hover:bg-ink-100 dark:hover:bg-ink-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cashbook' && (
        <>
          {isLoading && <SkeletonTable rows={5} cols={3} />}
          {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load cashbook.'} onRetry={() => void refetch()} />}
          {cashbook && (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Opening cash" value={<Amount value={cashbook.openingCash} />} sub={formatDate(date)} />
                <Stat label="Cash received" value={<Amount value={cashbook.cashReceived} />} tone="positive" />
                <Stat label="Cash disbursed + expenses" value={<Amount value={cashbook.cashDisbursed} />} tone="warning" />
                <Stat label="Expected closing cash" value={<Amount value={cashbook.expectedClosingCash} strong />} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader
                    title="Day summary"
                    subtitle="Physical cash only — digital balances are tracked separately (CASH-006, BR-007)."
                    actions={
                      <>
                        <Button variant="outline" size="sm" onClick={() => { setOpeningAmount(cashbook.openingCash === '0.00' ? '' : cashbook.openingCash); setShowOpening(true) }}>
                          Set opening
                        </Button>
                        <Button size="sm" icon={<Calculator className="size-3.5" aria-hidden />} onClick={() => { setCountAmount(cashbook.actualCountedCash ?? ''); setShowCount(true) }}>
                          Count cash
                        </Button>
                      </>
                    }
                  />
                  <CardBody>
                    <AmountLine label="Opening cash" value={cashbook.openingCash} />
                    <AmountLine label="+ Cash received" value={cashbook.cashReceived} />
                    <AmountLine label="− Cash disbursed" value={cashbook.cashDisbursed} />
                    <AmountLine label="− Expenses paid in cash" value={cashbook.expensesPaidInCash} />
                    <AmountLine label="= Expected closing cash" value={cashbook.expectedClosingCash} strong />
                    <div className="mt-3 border-t border-border-base pt-3">
                      <AmountLine label="Actual cash counted" value={cashbook.actualCountedCash ?? '0'} />
                      {cashbook.difference !== null ? (
                        <div className={`mt-1 rounded-md px-3 py-2 text-sm ${d(cashbook.difference).isZero() ? 'bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100' : 'bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100'}`}>
                          <div className="flex justify-between">
                            <span>Difference</span>
                            <span className="num font-semibold"><Amount value={cashbook.difference} signed strong /></span>
                          </div>
                          {!d(cashbook.difference).isZero() && (
                            <p className="mt-1 text-xs">
                              Cash count does not match expected cash. Investigate before closing the day
                              (discrepancy handling is a TBD business rule — OD-009).
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-text-muted">
                          No cash count recorded for this day yet (CASH-005).
                        </p>
                      )}
                    </div>
                  </CardBody>
                </Card>

                <Card className="overflow-hidden">
                  <CardHeader title="Movements" subtitle={`${cashbook.movements.length} recorded cash movements`} />
                  {cashbook.movements.length === 0 ? (
                    <EmptyState icon={<Wallet className="size-8" aria-hidden />} title="No cash movements today" description="Cash receipts, disbursements and cash expenses appear here automatically." />
                  ) : (
                    <ul className="divide-y divide-border-base">
                      {cashbook.movements.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary">{m.note ?? m.kind}</p>
                            <p className="text-[11px] text-text-muted">{m.kind.replace('_', ' ')}</p>
                          </div>
                          <Amount
                            value={m.kind === 'cash_out' ? `-${m.amount}` : m.amount}
                            signed
                            strong
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'expenses' && (
        <Card className="overflow-hidden">
          <CardHeader
            title="Business expenses"
            subtitle="Recorded separately from customer transactions (CASH-003). Never counted as loan interest or income."
            actions={
              <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => setExpOpen(true)}>
                Add expense
              </Button>
            }
          />
          {expenses && expenses.items.length === 0 ? (
            <EmptyState title="No expenses" description="Rent, travel, supplies and other business costs can be recorded here." />
          ) : (
            <ul className="divide-y divide-border-base">
              {(expenses?.items ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary capitalize">{e.category.replace('_', ' ')}</p>
                    <p className="text-xs text-text-muted">
                      {formatDate(e.date)} · {PAYMENT_METHOD_LABELS[e.method]} · {e.actorName}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </p>
                  </div>
                  <Amount value={e.amount} strong />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* Opening cash modal */}
      <Modal
        open={showOpening}
        onClose={() => setShowOpening(false)}
        title="Set opening cash"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowOpening(false)}>Cancel</Button>
            <Button loading={busy} onClick={() => void saveOpening()}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">Physical cash in the drawer at the start of {formatDate(date)} (CASH-001).</p>
          <Field label="Opening cash (₹)" htmlFor="opening" required>
            <Input id="opening" inputMode="decimal" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} className="num" />
          </Field>
          <Field label="Note / reference" htmlFor="opening-note" hint="Optional">
            <Input id="opening-note" value={openingNote} onChange={(e) => setOpeningNote(e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* Cash count modal */}
      <Modal
        open={showCount}
        onClose={() => setShowCount(false)}
        title="Record actual cash count"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCount(false)}>Cancel</Button>
            <Button loading={busy} onClick={() => void saveCount()}>Save count</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">
            Count the physical cash now. The difference against expected closing cash is shown immediately (CASH-005).
          </p>
          <Field label="Actual cash counted (₹)" htmlFor="count" required>
            <Input id="count" inputMode="decimal" value={countAmount} onChange={(e) => setCountAmount(e.target.value)} className="num" />
          </Field>
          <Field label="Note" htmlFor="count-note" hint="Optional — e.g. reason for discrepancy">
            <Input id="count-note" value={countNote} onChange={(e) => setCountNote(e.target.value)} />
          </Field>
        </div>
      </Modal>

      {/* Expense modal */}
      <Modal
        open={expOpen}
        onClose={() => setExpOpen(false)}
        title="Record business expense"
        footer={
          <>
            <Button variant="outline" onClick={() => setExpOpen(false)}>Cancel</Button>
            <Button loading={createExpense.busy} onClick={() => void saveExpense()}>
              Save expense
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount (₹)" htmlFor="exp-amount" required>
              <Input id="exp-amount" inputMode="decimal" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="num" />
            </Field>
            <Field label="Date" htmlFor="exp-date" required>
              <Input id="exp-date" type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category" htmlFor="exp-cat" required>
              <Select id="exp-cat" value={expCategory} onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </Select>
            </Field>
            <Field label="Paid by" htmlFor="exp-method" required>
              <Select id="exp-method" value={expMethod} onChange={(e) => setExpMethod(e.target.value as PaymentMethod)}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="other">Other</option>
              </Select>
            </Field>
          </div>
          <Field label="Notes" htmlFor="exp-notes" hint="Optional">
            <Textarea id="exp-notes" value={expNotes} onChange={(e) => setExpNotes(e.target.value)} rows={2} />
          </Field>
          <p className="text-[11px] text-text-muted">
            Expenses are business costs — they are NOT customer payments and never count as interest income (BR-008).
          </p>
        </div>
      </Modal>
    </div>
  )
}