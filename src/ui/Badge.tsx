import type { ReactNode } from 'react'

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'pending'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
  success: 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300',
  info: 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  pending: 'bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
}

export function Badge({
  tone = 'neutral',
  children,
  className = '',
  title,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 whitespace-nowrap ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone =
    status === 'active'
      ? 'success'
      : status === 'overdue'
        ? 'danger'
        : status === 'settled'
          ? 'info'
          : status === 'closed' || status === 'cancelled' || status === 'inactive'
            ? 'neutral'
            : status === 'due_today'
              ? 'warning'
              : status === 'partially_paid'
                ? 'warning'
                : status === 'paid'
                  ? 'success'
                  : status === 'upcoming'
                    ? 'info'
                    : 'neutral'
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return <Badge tone={tone}>{label}</Badge>
}

export function SyncBadge({ state }: { state: string }) {
  if (state === 'synced') return null
  if (state === 'pending')
    return (
      <Badge tone="pending" title="Saved on this device. Not yet confirmed by the server.">
        Pending sync
      </Badge>
    )
  if (state === 'syncing') return <Badge tone="info">Syncing…</Badge>
  if (state === 'failed')
    return (
      <Badge tone="danger" title="Sync failed. Open Sync status to retry.">
        Sync failed
      </Badge>
    )
  if (state === 'conflict')
    return (
      <Badge tone="warning" title="Another device changed this record. Review required.">
        Conflict
      </Badge>
    )
  return <Badge tone="neutral">{state}</Badge>
}
