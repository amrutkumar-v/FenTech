import { useMemo } from 'react'
import type { AllocationComponent, AllocationLine } from '@/domain/types'
import { parseUserAmount, canonicalMoney, addMoney, subMoney, d } from '@/lib/money'
import { formatINR } from '@/lib/format'
import { Amount } from '@/ui/Amount'
import { Button } from '@/ui/Button'

const COMPONENTS: { id: AllocationComponent; label: string; hint: string }[] = [
  { id: 'principal', label: 'Principal', hint: 'Reduces the outstanding principal' },
  { id: 'interest', label: 'Interest', hint: 'Toward agreed interest' },
  { id: 'other', label: 'Other dues', hint: 'Any other approved charge' },
]

/**
 * Manual payment allocation editor (PAY-005, BR-005).
 * The operator decides the split — the app NEVER assumes principal-first or
 * interest-first order. The allocation total must equal the payment amount.
 */
export function AllocationEditor({
  amount,
  value,
  onChange,
  outstanding,
}: {
  amount: string
  value: Record<AllocationComponent, string>
  onChange: (next: Record<AllocationComponent, string>) => void
  outstanding?: { principal: string; interest: string; other: string }
}) {
  const allocTotal = useMemo(
    () =>
      addMoney(
        parseUserAmount(value.principal) ?? '0',
        parseUserAmount(value.interest) ?? '0',
        parseUserAmount(value.other) ?? '0',
      ),
    [value],
  )
  const remaining = useMemo(() => subMoney(amount || '0', allocTotal), [amount, allocTotal])
  const balanced = d(remaining).abs().lt('0.005') && d(amount).gt(0)

  function setComponent(c: AllocationComponent, v: string) {
    onChange({ ...value, [c]: v })
  }

  function allocateRemainder() {
    if (!balanced && d(remaining).gt(0)) {
      const current = parseUserAmount(value.principal) ?? '0'
      setComponent('principal', canonicalMoney(addMoney(current, remaining)))
    }
  }

  return (
    <div className="rounded-lg border border-border-base p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-text-primary">Payment allocation</p>
          <p className="text-xs text-text-muted">
            Split the received amount manually as per the agreement. No automatic priority is applied (PAY-005, BR-005).
          </p>
        </div>
        {!balanced && d(remaining).gt(0) && (
          <Button type="button" variant="outline" size="sm" onClick={allocateRemainder}>
            Put remaining {formatINR(remaining)} on principal
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {COMPONENTS.map((c) => (
          <div key={c.id}>
            <label htmlFor={`alloc-${c.id}`} className="mb-1 block text-xs font-medium text-text-secondary">
              {c.label}
              {outstanding && (
                <span className="ml-1 font-normal text-text-muted">
                  (outstanding <Amount value={outstanding[c.id]} muted whole />)
                </span>
              )}
            </label>
            <input
              id={`alloc-${c.id}`}
              inputMode="decimal"
              value={value[c.id]}
              onChange={(e) => setComponent(c.id, e.target.value)}
              placeholder="0.00"
              className="num w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              aria-describedby={`alloc-${c.id}-hint`}
            />
            <p id={`alloc-${c.id}-hint`} className="mt-0.5 text-[11px] text-text-muted">
              {c.hint}
            </p>
          </div>
        ))}
      </div>

      <div
        className={`mt-3 flex items-center justify-between rounded-md px-3 py-2 text-sm ${balanced ? 'bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100' : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}
        role="status"
      >
        <span>
          Allocated <strong className="num">{formatINR(allocTotal)}</strong> of{' '}
          <strong className="num">{formatINR(amount || '0')}</strong>
        </span>
        <span className="num font-semibold">
          {balanced ? 'Fully allocated' : `Remaining ${formatINR(remaining)}`}
        </span>
      </div>
      {!balanced && d(amount).gt(0) && (
        <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          Allocation must total the received amount before saving (PAY-005).
        </p>
      )}
    </div>
  )
}

export function emptyAllocation(): Record<AllocationComponent, string> {
  return { principal: '', interest: '', other: '' }
}

export function toAllocationLines(value: Record<AllocationComponent, string>): AllocationLine[] {
  const lines: AllocationLine[] = []
  for (const c of ['principal', 'interest', 'other'] as const) {
    const parsed = parseUserAmount(value[c] ?? '')
    if (parsed && d(parsed).gt(0)) lines.push({ component: c, amount: canonicalMoney(parsed) })
  }
  return lines
}
