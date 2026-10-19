import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Receipt, Phone, CheckCircle2 } from 'lucide-react'
import { getApi } from '@/api/provider'
import { todayISO } from '@/lib/dates'
import { PageHeader, Card, CardHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Badge, StatusBadge } from '@/ui/Badge'
import { Amount } from '@/ui/Amount'
import { EmptyState, ErrorState, SkeletonTable } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import type { DueItem } from '@/domain/types'

export default function CollectionsPage() {
  const { can } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [view, setView] = useState<'today' | 'overdue' | 'upcoming'>('today')
  const [followUpBusy, setFollowUpBusy] = useState<string | null>(null)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['due-items', view],
    queryFn: () =>
      getApi().listDueItems({
        date: todayISO(),
        includeUpcoming: view !== 'overdue',
        onlyOverdue: view === 'overdue',
      }),
  })

  const items = (data ?? []).filter((item) => {
    if (view === 'today') return item.status === 'due_today' || item.status === 'partially_paid' || item.status === 'overdue'
    if (view === 'overdue') return item.status === 'overdue' || (item.status === 'partially_paid' && item.overdueDays > 0)
    return item.status === 'upcoming' || item.status === 'due_today'
  })

  async function toggleFollowUp(item: DueItem) {
    setFollowUpBusy(item.scheduleItemId)
    try {
      await getApi().setFollowUp(item.scheduleItemId, { done: !item.followUpDone })
      qc.invalidateQueries({ queryKey: ['due-items'] }).catch(() => {})
      toast.success(item.followUpDone ? 'Follow-up reopened' : 'Follow-up marked complete')
    } catch (err) {
      toast.error('Could not update follow-up', err instanceof Error ? err.message : undefined)
    } finally {
      setFollowUpBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Collections"
        subtitle="Expected payments due today, overdue amounts, and upcoming dues (COLL-001, COLL-002)."
        actions={
          <div className="inline-flex rounded-md border border-border-strong bg-surface p-0.5" role="group" aria-label="Due list view">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'upcoming', label: 'Upcoming' },
              ] as const
            ).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                aria-pressed={view === v.id}
                className={`rounded px-2.5 py-1 text-xs font-medium ${view === v.id ? 'bg-brand-700 text-white' : 'text-text-secondary hover:bg-ink-100 dark:hover:bg-ink-800'}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        }
      />

      {isLoading && <SkeletonTable rows={5} cols={4} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load due list.'} onRetry={() => void refetch()} />}

      {data && items.length === 0 && (
        <Card>
          <EmptyState
            title={view === 'overdue' ? 'No overdue payments' : view === 'today' ? 'Nothing due today' : 'No upcoming dues'}
            description={
              view === 'today'
                ? 'All scheduled payments for today are handled, or no schedule exists yet.'
                : 'Overdue tracking only reflects approved schedule entries — no dates are invented (OD-005, OD-006).'
            }
          />
        </Card>
      )}

      {items.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader
            title={`${items.length} item${items.length === 1 ? '' : 's'}`}
            subtitle="Dues come from approved schedule entries only. Schedule rules remain a business decision (OD-006)."
          />
          <ul className="divide-y divide-border-base">
            {items.map((item) => (
              <li key={item.scheduleItemId} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/customers/${item.customerId}`} className="font-medium text-text-primary hover:underline">
                        {item.customerName}
                      </Link>
                      <StatusBadge status={item.status} />
                      {item.overdueDays > 0 && (
                        <Badge tone="danger">{item.overdueDays} day{item.overdueDays === 1 ? '' : 's'} overdue</Badge>
                      )}
                      {item.freshness === 'provisional' && (
                        <Badge tone="pending" title="Balance may have changed on another device — provisional until synced (SRS 7.2).">
                          Provisional
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      Due {item.dueDate} · Account {item.accountLabel}
                      {item.lastPaymentDate ? ` · last payment ${item.lastPaymentDate}` : ' · no payments yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[11px] text-text-muted">Expected <Amount value={item.expectedAmount} muted /></p>
                      <p className="text-sm font-semibold"><Amount value={item.balanceAmount} strong /></p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {can('transactions:record') && (
                        <Link to={`/payments/receipt?accountId=${item.accountId}`}>
                          <Button size="sm" icon={<Receipt className="size-3.5" aria-hidden />}>
                            Pay
                          </Button>
                        </Link>
                      )}
                      <div className="flex gap-1">
                        <a href={`tel:${item.customerPhone.replace(/\s/g, '')}`} title={`Call ${item.customerPhone}`}>
                          <Button variant="ghost" size="sm" icon={<Phone className="size-3.5" aria-hidden />} aria-label="Call customer" />
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={followUpBusy === item.scheduleItemId}
                          icon={<CheckCircle2 className="size-3.5" aria-hidden />}
                          aria-label={item.followUpDone ? 'Reopen follow-up' : 'Mark follow-up complete'}
                          title={item.followUpDone ? 'Follow-up done — reopen?' : 'Mark follow-up complete'}
                          className={item.followUpDone ? 'text-brand-600' : ''}
                          onClick={() => void toggleFollowUp(item)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
