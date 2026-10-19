import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { getApi } from '@/api/provider'
import { newId } from '@/lib/ids'
import { todayISO } from '@/lib/dates'
import { parseUserAmount, canonicalMoney } from '@/lib/money'
import { PageHeader, Card, CardBody } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Field, Input, Select, Textarea } from '@/ui/Input'
import { PhotoInput } from '@/ui/Photo'
import { Badge } from '@/ui/Badge'
import { useToast } from '@/ui/Toast'
import { useOfflineAction } from '@/offline/useOfflineAction'
import { LoadingState, ErrorState } from '@/ui/States'
import { FINANCE_TYPE_LABELS } from '@/lib/format'
import type { FinanceType, InterestMethod, RateUnit, RepaymentFrequency, FinanceAccount } from '@/domain/types'

const TYPES: FinanceType[] = ['free_hand', 'gold', 'papers', 'property', 'other']

const TYPE_HELP: Record<FinanceType, string> = {
  free_hand: 'Free Hand accounts do NOT require a collateral photo (COL-002).',
  gold: 'Gold accounts require at least one photo of the pledged item (COL-001).',
  papers: 'Papers accounts require at least one photo of the documents (COL-001).',
  property: 'Property accounts require at least one photo of the property documents (COL-001).',
  other: 'Other accounts require a collateral photo only when marked collateral-backed (OD-016).',
}

export default function AccountFormPage() {
  const [params] = useSearchParams()
  const customerId = params.get('customerId') ?? ''
  const navigate = useNavigate()
  const toast = useToast()

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getApi().getCustomer(customerId),
    enabled: !!customerId,
  })

  const [financeType, setFinanceType] = useState<FinanceType>('free_hand')
  const [collateralBacked, setCollateralBacked] = useState(false)
  const [disbursed, setDisbursed] = useState('')
  const [startDate, setStartDate] = useState(todayISO())
  const [interestMethod, setInterestMethod] = useState<InterestMethod>('unspecified')
  const [rateValue, setRateValue] = useState('')
  const [rateUnit, setRateUnit] = useState<RateUnit>('per_month')
  const [repaymentFrequency, setRepaymentFrequency] = useState<RepaymentFrequency>('monthly')
  const [agreementTerms, setAgreementTerms] = useState('')
  const [notes, setNotes] = useState('')
  const [collateralDesc, setCollateralDesc] = useState('')
  const [collateralRef, setCollateralRef] = useState('')
  const [collateralPhotos, setCollateralPhotos] = useState<File[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setCollateralBacked(financeType !== 'free_hand')
  }, [financeType])

  // existing types for this customer → duplicate flag (BR-003)
  const existingType = customer?.accounts.find(
    (a) => a.financeType === financeType && a.status !== 'cancelled',
  )

  const create = useOfflineAction<Record<string, unknown>, FinanceAccount>({
    kind: 'create_account',
    online: (input) => getApi().createAccount(input as never),
    toPayload: (input) => input,
    invalidate: [['customers'], ['accounts'], ['customer', customerId]],
  })

  const needsCollateralPhoto = collateralBacked && financeType !== 'free_hand'

  function validate(): boolean {
    const fe: Record<string, string> = {}
    if (!customerId) fe.customer = 'Missing customer.'
    const amt = parseUserAmount(disbursed)
    if (!disbursed.trim()) fe.disbursed = 'Disbursed amount is required.'
    else if (!amt) fe.disbursed = 'Enter a valid amount (digits and optional decimal).'
    else if (Number(amt) <= 0) fe.disbursed = 'Amount must be greater than zero.'
    if (!startDate) fe.startDate = 'Start date is required.'
    if (needsCollateralPhoto && collateralPhotos.length === 0) {
      fe['collateral.photos'] = 'At least one collateral photo is required to complete this account (COL-001).'
    }
    if (needsCollateralPhoto && !collateralDesc.trim()) {
      fe['collateral.description'] = 'Describe the item/document kept as collateral.'
    }
    if (!agreementTerms.trim()) {
      fe.agreementTerms = 'Write the agreement terms exactly as agreed. Do not guess interest rules (INT-006).'
    }
    if (rateValue && interestMethod === 'unspecified') {
      fe.interestMethod = 'Select an interest method or clear the rate.'
    }
    setFieldErrors(fe)
    return Object.keys(fe).length === 0
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    const amt = parseUserAmount(disbursed)!
    try {
      const res = await create.run({
        id: newId('acc'),
        customerId,
        financeType,
        collateralBacked,
        disbursedAmount: canonicalMoney(amt),
        startDate,
        interestMethod,
        rateValue: rateValue || '0',
        rateUnit,
        repaymentFrequency,
        agreementTerms,
        notes: notes || undefined,
        collateral: needsCollateralPhoto
          ? {
              id: newId('col'),
              description: collateralDesc,
              reference: collateralRef || undefined,
              photoFiles: collateralPhotos,
            }
          : undefined,
      })
      toast.success(
        res.pendingSync ? 'Account saved on this device (pending sync)' : 'Account created',
        res.pendingSync ? 'Not yet confirmed by the central database.' : undefined,
      )
      if (res.data) navigate(`/accounts/${res.data.id}`)
      else navigate(`/customers/${customerId}`)
    } catch {
      toast.error('Could not create account', create.error?.message)
    }
  }

  if (!customerId) {
    return (
      <ErrorState
        title="Customer required"
        message="Open this form from a customer profile so the account is linked correctly."
      />
    )
  }
  if (isLoading) return <LoadingState />
  if (error || !customer) return <ErrorState message="Customer not found." />

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New finance account"
        subtitle={`For ${customer.name} · ${customer.phone}`}
        back={
          <Link to={`/customers/${customerId}`} className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary">
            <ArrowLeft className="size-3.5" aria-hidden /> Customer
          </Link>
        }
      />

      <Card>
        <CardBody>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <Field label="Finance type" htmlFor="financeType" required hint={TYPE_HELP[financeType]}>
              <Select id="financeType" value={financeType} onChange={(e) => setFinanceType(e.target.value as FinanceType)}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FINANCE_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>

            {existingType && (
              <div className="flex gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200" role="alert">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">Duplicate finance type (BR-003)</p>
                  <p className="mt-0.5">
                    This customer already has a {FINANCE_TYPE_LABELS[financeType]} account.{' '}
                    <Link to={`/accounts/${existingType.id}`} className="underline">
                      Open the existing account
                    </Link>{' '}
                    or choose a different type. Exceptions require the business owner to change the rule (OD-015).
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Disbursed amount (₹)" htmlFor="disbursed" required error={fieldErrors.disbursed} hint="Principal given to the customer">
                <Input
                  id="disbursed"
                  inputMode="decimal"
                  value={disbursed}
                  onChange={(e) => setDisbursed(e.target.value)}
                  invalid={!!fieldErrors.disbursed}
                  placeholder="e.g. 50000"
                  className="num"
                />
              </Field>
              <Field label="Start date" htmlFor="startDate" required error={fieldErrors.startDate}>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  invalid={!!fieldErrors.startDate}
                />
              </Field>
            </div>

            <div className="rounded-lg border border-border-base bg-surface-sunken p-3">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Interest & repayment terms
              </p>
              <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
                No interest formula is applied by this application. Record the agreed method and rate exactly as
                written on paper — calculations remain pending business approval (OD-001, OD-002, INT-006).
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Interest method" htmlFor="interestMethod" error={fieldErrors.interestMethod}>
                  <Select
                    id="interestMethod"
                    value={interestMethod}
                    onChange={(e) => setInterestMethod(e.target.value as InterestMethod)}
                  >
                    <option value="unspecified">Not specified</option>
                    <option value="simple">Simple</option>
                    <option value="compound">Compound</option>
                    <option value="fixed_total">Fixed total</option>
                    <option value="other">Other (describe in terms)</option>
                  </Select>
                </Field>
                <Field label="Rate value" htmlFor="rateValue" hint="Leave blank if none agreed">
                  <Input
                    id="rateValue"
                    inputMode="decimal"
                    value={rateValue}
                    onChange={(e) => setRateValue(e.target.value)}
                    placeholder="e.g. 3"
                    className="num"
                  />
                </Field>
                <Field label="Rate unit" htmlFor="rateUnit" hint="Explicit unit required (INT-003)">
                  <Select id="rateUnit" value={rateUnit} onChange={(e) => setRateUnit(e.target.value as RateUnit)}>
                    <option value="per_day">Per day</option>
                    <option value="per_week">Per week</option>
                    <option value="per_month">Per month</option>
                    <option value="per_year">Per year</option>
                    <option value="fixed">Fixed amount</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Repayment frequency" htmlFor="freq" hint="Calendar behaviour is TBD (OD-006)">
                  <Select
                    id="freq"
                    value={repaymentFrequency}
                    onChange={(e) => setRepaymentFrequency(e.target.value as RepaymentFrequency)}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </Select>
                </Field>
              </div>
            </div>

            <Field
              label="Agreement terms"
              htmlFor="terms"
              required
              error={fieldErrors.agreementTerms}
              hint="Copy the terms from the paper agreement. Do not invent interest, penalty, or grace-period rules."
            >
              <Textarea
                id="terms"
                value={agreementTerms}
                onChange={(e) => setAgreementTerms(e.target.value)}
                invalid={!!fieldErrors.agreementTerms}
                rows={4}
                placeholder="e.g. ₹50,000 against gold necklace. 3% per month. Monthly payment of ₹3,000 as written in register dated …"
              />
            </Field>

            <Field label="Notes" htmlFor="notes" hint="Optional">
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>

            {/* Collateral */}
            <div className="rounded-lg border border-border-base p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Collateral</p>
                <Badge tone={needsCollateralPhoto ? 'warning' : 'neutral'}>
                  {needsCollateralPhoto ? 'Photo required' : 'Photo not required'}
                </Badge>
              </div>
              {financeType === 'free_hand' ? (
                <p className="text-xs text-text-muted">
                  Free Hand accounts never require a collateral photo (COL-002).
                </p>
              ) : (
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={collateralBacked}
                    onChange={(e) => setCollateralBacked(e.target.checked)}
                    className="size-4"
                  />
                  Collateral-backed — item/document kept as security
                </label>
              )}
              {collateralBacked && (
                <div className="mt-3 space-y-4">
                  <Field
                    label="Collateral description"
                    htmlFor="colDesc"
                    required={needsCollateralPhoto}
                    error={fieldErrors['collateral.description']}
                  >
                    <Input
                      id="colDesc"
                      value={collateralDesc}
                      onChange={(e) => setCollateralDesc(e.target.value)}
                      placeholder="e.g. Gold necklace set, 22kt, approx 40g"
                      invalid={!!fieldErrors['collateral.description']}
                    />
                  </Field>
                  <Field label="Reference / document number" htmlFor="colRef" hint="Optional">
                    <Input id="colRef" value={collateralRef} onChange={(e) => setCollateralRef(e.target.value)} />
                  </Field>
                  <PhotoInput
                    label="Collateral photo"
                    hint="At least one clear photo of the specific item or document. Included in backup and recovery (COL-006)."
                    required={needsCollateralPhoto}
                    error={fieldErrors['collateral.photos']}
                    value={collateralPhotos[0] ?? null}
                    onChange={(f) => setCollateralPhotos(f ? [f] : [])}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" loading={create.busy} disabled={!!existingType}>
                Create account
              </Button>
              <Link to={`/customers/${customerId}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
