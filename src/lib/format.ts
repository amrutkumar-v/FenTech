import type { FinanceType, PaymentMethod, TransactionType, AccountStatus } from '@/domain/types'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Format a money decimal-string as ₹ with grouping. */
export function formatINR(value: string | null | undefined, opts?: { whole?: boolean }): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return opts?.whole ? inrWhole.format(n) : inr.format(n)
}

/** Signed display for deltas: "+₹1,200.00" / "−₹500.00" */
export function formatSignedINR(value: string): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return formatINR('0')
  const abs = inr.format(Math.abs(n))
  return n > 0 ? `+${abs}` : `−${abs}`
}

export function formatNumber(value: number | string): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-IN').format(n)
}

export function formatPercent(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '—'
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format(n)}%`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const FINANCE_TYPE_LABELS: Record<FinanceType, string> = {
  free_hand: 'Free Hand',
  gold: 'Gold',
  papers: 'Papers',
  property: 'Property',
  other: 'Other',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  other: 'Other',
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  disbursement: 'Disbursement',
  receipt: 'Payment received',
  adjustment: 'Adjustment',
  reversal: 'Reversal',
}

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Active',
  overdue: 'Overdue',
  settled: 'Settled',
  closed: 'Closed',
  cancelled: 'Cancelled',
}

/** Short account label used across the UI: "Gold • ACC-1001" */
export function accountLabel(financeType: FinanceType, id: string): string {
  return `${FINANCE_TYPE_LABELS[financeType]} · ${shortId(id)}`
}

export function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return phone
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}
