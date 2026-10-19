import type { ReactNode } from 'react'
import { Inbox, AlertTriangle, RotateCw, Lock } from 'lucide-react'
import { Button } from './Button'

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <span className="mb-3 text-text-muted">{icon ?? <Inbox className="size-8" aria-hidden />}</span>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-xs text-text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <AlertTriangle className="mb-3 size-8 text-red-500" aria-hidden />
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-text-secondary">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" icon={<RotateCw className="size-3.5" aria-hidden />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function PermissionDenied({ message }: { message?: string }) {
  return (
    <EmptyState
      icon={<Lock className="size-8" aria-hidden />}
      title="You do not have permission for this area"
      description={message ?? 'This section is restricted by your role. Ask the administrator if you need access.'}
    />
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-text-muted" role="status">
      <span className="inline-block size-4 animate-spin rounded-full border-2 border-border-strong border-t-brand-600" aria-hidden />
      {label}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-ink-100 dark:bg-ink-800 ${className}`} aria-hidden />
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
