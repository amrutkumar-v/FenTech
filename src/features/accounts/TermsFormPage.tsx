import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { getApi } from '@/api/provider'
import { todayISO } from '@/lib/dates'
import { PageHeader, Card, CardBody } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Field, Input, Select, Textarea } from '@/ui/Input'
import { useToast } from '@/ui/Toast'
import { LoadingState, ErrorState } from '@/ui/States'
import type { InterestMethod, RateUnit, RepaymentFrequency } from '@/domain/types'

export default function TermsFormPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()

  const { data: account, isLoading, error } = useQuery({
    queryKey: ['account', id],
    queryFn: () => getApi().getAccount(id!),
    enabled: !!id,
  })

  const [effectiveFrom, setEffectiveFrom] = useState(todayISO())
  const [interestMethod, setInterestMethod] = useState<InterestMethod>('unspecified')
  const [rateValue, setRateValue] = useState('')
  const [rateUnit, setRateUnit] = useState<RateUnit>('per_month')
  const [repaymentFrequency, setRepaymentFrequency] = useState<RepaymentFrequency>('monthly')
  const [agreementTerms, setAgreementTerms] = useState('')
  const [changedReason, setChangedReason] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [initialised, setInitialised] = useState(false)

  if (account && !initialised) {
    setInterestMethod(account.currentTerms.interestMethod)
    setRateValue(account.currentTerms.rateValue === '0' ? '' : account.currentTerms.rateValue)
    setRateUnit(account.currentTerms.rateUnit)
    setRepaymentFrequency(account.currentTerms.repaymentFrequency)
    setAgreementTerms(account.currentTerms.agreementTerms)
    setInitialised(true)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const fe: Record<string, string> = {}
    if (!changedReason.trim()) fe.changedReason = 'State why the terms are changing (audit trail, ACC-008).'
    if (!agreementTerms.trim()) fe.agreementTerms = 'Agreement terms text is required.'
    if (!effectiveFrom) fe.effectiveFrom = 'Effective date is required.'
    setFieldErrors(fe)
    if (Object.keys(fe).length) return
    setBusy(true)
    try {
      await getApi().updateTerms(id!, {
        effectiveFrom,
        interestMethod,
        rateValue: rateValue || '0',
        rateUnit,
        repaymentFrequency,
        agreementTerms,
        changedReason,
      })
      qc.invalidateQueries({ queryKey: ['account', id] }).catch(() => {})
      qc.invalidateQueries({ queryKey: ['terms', id] }).catch(() => {})
      toast.success('Terms updated', 'A new version was created. Historical calculations are unchanged.')
      navigate(`/accounts/${id}`)
    } catch (err) {
      toast.error('Could not update terms', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  if (isLoading) return <LoadingState />
  if (error || !account) return <ErrorState message="Account not found." />

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Change agreement terms"
        subtitle={`${account.customerName} · ${account.financeType.replace('_', ' ')} account`}
        back={
          <Link to={`/accounts/${id}`} className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary">
            <ArrowLeft className="size-3.5" aria-hidden /> Account
          </Link>
        }
      />

      <div className="mb-4 rounded-lg border border-sky-300 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
        <p className="font-semibold">Versioned change (ACC-008, INT-005)</p>
        <p className="mt-0.5">
          Current version v{account.currentTerms.versionNo} stays on record with its effective dates. The new
          version applies only from the effective date you choose — past calculations are never silently rewritten (AC-016).
        </p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <Field label="Effective from" htmlFor="effectiveFrom" required error={fieldErrors.effectiveFrom}>
              <Input
                id="effectiveFrom"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                invalid={!!fieldErrors.effectiveFrom}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Interest method" htmlFor="im">
                <Select id="im" value={interestMethod} onChange={(e) => setInterestMethod(e.target.value as InterestMethod)}>
                  <option value="unspecified">Not specified</option>
                  <option value="simple">Simple</option>
                  <option value="compound">Compound</option>
                  <option value="fixed_total">Fixed total</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Rate value" htmlFor="rv">
                <Input id="rv" inputMode="decimal" value={rateValue} onChange={(e) => setRateValue(e.target.value)} className="num" placeholder="e.g. 3" />
              </Field>
              <Field label="Rate unit" htmlFor="ru">
                <Select id="ru" value={rateUnit} onChange={(e) => setRateUnit(e.target.value as RateUnit)}>
                  <option value="per_day">Per day</option>
                  <option value="per_week">Per week</option>
                  <option value="per_month">Per month</option>
                  <option value="per_year">Per year</option>
                  <option value="fixed">Fixed amount</option>
                </Select>
              </Field>
            </div>

            <Field label="Repayment frequency" htmlFor="rf">
              <Select id="rf" value={repaymentFrequency} onChange={(e) => setRepaymentFrequency(e.target.value as RepaymentFrequency)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </Field>

            <Field label="Agreement terms" htmlFor="terms" required error={fieldErrors.agreementTerms}>
              <Textarea id="terms" value={agreementTerms} onChange={(e) => setAgreementTerms(e.target.value)} rows={4} invalid={!!fieldErrors.agreementTerms} />
            </Field>

            <Field
              label="Reason for change"
              htmlFor="reason"
              required
              error={fieldErrors.changedReason}
              hint="Recorded in the audit trail with your name and timestamp."
            >
              <Input
                id="reason"
                value={changedReason}
                onChange={(e) => setChangedReason(e.target.value)}
                invalid={!!fieldErrors.changedReason}
                placeholder="e.g. Rate revised as per renewed paper agreement dated …"
              />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button type="submit" loading={busy}>
                Save new version
              </Button>
              <Link to={`/accounts/${id}`}>
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
