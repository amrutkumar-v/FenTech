import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserCog, ShieldCheck } from 'lucide-react'
import { getApi } from '@/api/provider'
import { PageHeader, Card, CardHeader } from '@/ui/Card'
import { Badge } from '@/ui/Badge'
import { Button } from '@/ui/Button'
import { ErrorState, SkeletonTable, EmptyState } from '@/ui/States'
import { useToast } from '@/ui/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { PermissionDenied } from '@/ui/States'

export default function UsersSettingsPage() {
  const { can, user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [revoking, setRevoking] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['users'],
    queryFn: () => getApi().listUsers(),
    enabled: can('settings:users'),
  })

  if (!can('settings:users')) {
    return (
      <div>
        <PageHeader title="Users & access" />
        <PermissionDenied message="Only the admin can manage authorized users (SEC-002, OD-014)." />
      </div>
    )
  }

  async function revokeOthers() {
    setRevoking(true)
    try {
      await getApi().revokeOtherSessions()
      toast.success('Other sessions revoked', 'All other devices must sign in again.')
      qc.invalidateQueries({ queryKey: ['users'] }).catch(() => {})
    } catch (err) {
      toast.error('Could not revoke sessions', err instanceof Error ? err.message : undefined)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Users & access"
        subtitle="Only two authorized users exist: the operator (father) and the admin (you). Role permissions follow SRS §2 — OD-014: exact role permissions remain a business decision (SEC-002)."
        actions={
          <Button variant="outline" size="sm" loading={revoking} icon={<ShieldCheck className="size-3.5" aria-hidden />} onClick={() => void revokeOthers()}>
            Revoke other sessions
          </Button>
        }
      />

      {isLoading && <SkeletonTable rows={2} cols={3} />}
      {error && <ErrorState message={error instanceof Error ? error.message : 'Failed to load users.'} onRetry={() => void refetch()} />}

      {data && (
        <Card className="overflow-hidden">
          <CardHeader title={`${data.length} authorized user${data.length === 1 ? '' : 's'}`} />
          <ul className="divide-y divide-border-base">
            {data.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                    <UserCog className="size-4.5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {u.name}
                      {u.id === user?.id && <span className="ml-2 text-xs font-normal text-text-muted">(you)</span>}
                    </p>
                    <p className="text-xs text-text-muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                  </div>
                </div>
                <Badge tone={u.role === 'admin' ? 'info' : 'neutral'}>{u.role}</Badge>
              </li>
            ))}
            {data.length === 0 && <li><EmptyState title="No users" description="The backend returned no authorized users." /></li>}
          </ul>
        </Card>
      )}

      <Card className="mt-6 p-4">
        <p className="text-xs text-text-muted">
          User creation and role changes are performed server-side. The frontend lists users and manages
          sessions only — adding or promoting users requires backend configuration (OD-014, SEC-002).
        </p>
      </Card>
    </div>
  )
}
