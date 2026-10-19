import { useState } from 'react'
import type { DateRange, ReportPeriod } from '@/domain/types'
import { resolvePeriod, todayISO } from '@/lib/dates'
import { Input } from './Input'

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'this_week', label: 'This week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
]

export function PeriodFilter({
  value,
  onChange,
  allowCustom = true,
}: {
  value: { period: ReportPeriod; custom?: DateRange }
  onChange: (v: { period: ReportPeriod; custom?: DateRange }) => void
  allowCustom?: boolean
}) {
  const [from, setFrom] = useState(value.custom?.from ?? todayISO())
  const [to, setTo] = useState(value.custom?.to ?? todayISO())

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <span className="mb-1 block text-xs font-medium text-text-muted">Period</span>
        <div className="inline-flex rounded-md border border-border-strong bg-surface p-0.5" role="group" aria-label="Report period">
          {PERIODS.filter((p) => allowCustom || p.id !== 'custom').map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                onChange({
                  period: p.id,
                  custom: p.id === 'custom' ? { from, to } : undefined,
                })
              }
              aria-pressed={value.period === p.id}
              className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors
                ${value.period === p.id ? 'bg-brand-700 text-white' : 'text-text-secondary hover:bg-ink-100 dark:hover:bg-ink-800'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {value.period === 'custom' && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="period-from" className="mb-1 block text-xs font-medium text-text-muted">
              From
            </label>
            <Input
              id="period-from"
              type="date"
              value={from}
              max={to}
              className="w-40"
              onChange={(e) => {
                setFrom(e.target.value)
                onChange({ period: 'custom', custom: { from: e.target.value, to } })
              }}
            />
          </div>
          <div>
            <label htmlFor="period-to" className="mb-1 block text-xs font-medium text-text-muted">
              To
            </label>
            <Input
              id="period-to"
              type="date"
              value={to}
              min={from}
              className="w-40"
              onChange={(e) => {
                setTo(e.target.value)
                onChange({ period: 'custom', custom: { from, to: e.target.value } })
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function usePeriod(initial: ReportPeriod = 'today'): {
  period: { period: ReportPeriod; custom?: DateRange }
  setPeriod: (p: { period: ReportPeriod; custom?: DateRange }) => void
  range: DateRange
} {
  const [period, setPeriod] = useState<{ period: ReportPeriod; custom?: DateRange }>({ period: initial })
  const range = resolvePeriod(period.period, period.custom)
  return { period, setPeriod, range }
}
