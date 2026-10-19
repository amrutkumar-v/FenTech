import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Users } from 'lucide-react'
import { getApi } from '@/api/provider'
import { PageHeader } from '@/ui/Card'
import { Input } from '@/ui/Input'
import { Button } from '@/ui/Button'
import { Card } from '@/ui/Card'
import { Badge, StatusBadge } from '@/ui/Badge'
import { Amount } from '@/ui/Amount'
import { EmptyState, ErrorState, SkeletonTable } from '@/ui/States'
import { Pagination } from '@/ui/Pagination'
import { useAuth } from '@/features/auth/AuthProvider'
import { maskPhone } from '@/lib/format'

export default function CustomersPage() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['customers', search, page],
    queryFn: () => getApi().listCustomers({ search: search || undefined, page, pageSize: 25 }),
    placeholderData: (prev) => prev,
  })

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={data ? `${data.total} customer${data.total === 1 ? '' : 's'}` : 'Directory'}
        actions={
          can('customers:write') && (
            <Link to="/customers/new">
              <Button icon={<Plus className="size-4" aria-hidden />}>New customer</Button>
            </Link>
          )
        }
      />

      <div className="mb-4 relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" aria-hidden />
        <Input
          type="search"
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="pl-9"
          aria-label="Search customers"
        />
      </div>

      {isLoading && <SkeletonTable rows={6} cols={4} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load customers.'} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <Card>
          <EmptyState
            icon={<Users className="size-8" aria-hidden />}
            title={search ? 'No customers match your search' : 'No customers yet'}
            description={
              search
                ? 'Try a different name or phone number.'
                : 'Create your first customer to get started. Name and phone number are required.'
            }
            action={
              can('customers:write') && !search ? (
                <Link to="/customers/new">
                  <Button icon={<Plus className="size-4" aria-hidden />}>New customer</Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      )}

      {data && data.items.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border-base">
            {data.items.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/customers/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50/70 dark:hover:bg-ink-900/40"
                >
                  {c.photo?.url ? (
                    <img src={c.photo.url} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                      {c.name.replace(/^Demo — /, '').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-text-primary">{c.name}</p>
                      {c.status === 'inactive' && <StatusBadge status="inactive" />}
                      {c.name.startsWith('Demo') && <Badge tone="info" title="Development fixture">Demo</Badge>}
                    </div>
                    <p className="num text-xs text-text-muted">{maskPhone(c.phone)} · {c.activeAccountCount} active account{c.activeAccountCount === 1 ? '' : 's'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-text-muted">Outstanding</p>
                    <Amount value={c.totalOutstanding.total} strong />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
        </Card>
      )}
    </div>
  )
}
