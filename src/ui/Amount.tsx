import { formatINR } from '@/lib/format'
import { roundMoneyForDisplay } from '@/lib/money'

/**
 * Money display. Always uses tabular numerals; colour is reserved for
 * explicit positive/negative deltas — principal is NEVER coloured as
 * "income" (BR-008).
 */
export function Amount({
  value,
  className = '',
  signed,
  muted,
  strong,
  whole,
}: {
  value: string | null | undefined
  className?: string
  signed?: boolean
  muted?: boolean
  strong?: boolean
  whole?: boolean
}) {
  const text = formatINR(value === null || value === undefined ? null : roundMoneyForDisplay(value), { whole })
  let tone = ''
  if (signed && value) {
    const n = Number(value)
    if (n > 0) tone = 'text-brand-700 dark:text-brand-300'
    else if (n < 0) tone = 'text-red-700 dark:text-red-400'
  }
  return (
    <span
      className={`num ${strong ? 'font-semibold' : ''} ${muted ? 'text-text-muted' : 'text-text-primary'} ${tone} ${className}`}
    >
      {text}
    </span>
  )
}

/** Labeled amount used in breakdowns: principal / interest / other / total. */
export function AmountLine({
  label,
  value,
  strong,
  tone,
}: {
  label: string
  value: string
  strong?: boolean
  tone?: 'default' | 'muted'
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 ${strong ? 'border-t border-border-base pt-2 mt-1' : ''}`}>
      <span className={`text-xs ${tone === 'muted' ? 'text-text-muted' : 'text-text-secondary'}`}>{label}</span>
      <Amount value={value} strong={strong} />
    </div>
  )
}

export function OutstandingBreakdownView({
  outstanding,
  title = 'Outstanding',
}: {
  outstanding: { principal: string; interest: string; other: string; total: string }
  title?: string
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      <AmountLine label="Principal" value={outstanding.principal} />
      <AmountLine label="Interest" value={outstanding.interest} />
      <AmountLine label="Other dues" value={outstanding.other} />
      <AmountLine label="Total outstanding" value={outstanding.total} strong />
      <p className="mt-1 text-[11px] text-text-muted">
        Sum of recorded ledger allocations. No interest is auto-calculated by this app.
      </p>
    </div>
  )
}
