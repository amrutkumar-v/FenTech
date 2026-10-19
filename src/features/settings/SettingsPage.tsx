import { Link } from 'react-router-dom'
import { Users, CloudUpload, HardDriveDownload, Palette, UserCog, ArrowRight } from 'lucide-react'
import { PageHeader, Card } from '@/ui/Card'
import { Badge } from '@/ui/Badge'
import { useAuth } from '@/features/auth/AuthProvider'
import { getApi } from '@/api/provider'
import { useSync } from '@/offline/sync'

export default function SettingsPage() {
  const { user, can, logout } = useAuth()
  const { status } = useSync()

  const entries = [
    {
      to: '/settings/users',
      title: 'Users & access',
      desc: 'Authorized users, their roles (operator / admin) and session management.',
      icon: Users,
      perm: 'settings:users' as const,
    },
    {
      to: '/settings/sync',
      title: 'Sync status',
      desc: 'Pending records, retries, conflicts that need human review.',
      icon: CloudUpload,
      perm: 'settings:sync' as const,
    },
    {
      to: '/settings/backup',
      title: 'Backup & recovery',
      desc: 'Last backup, destination, restore tests and manual backup request.',
      icon: HardDriveDownload,
      perm: 'backup:view' as const,
    },
    {
      to: '/settings/appearance',
      title: 'Appearance',
      desc: 'Light / dark / system theme for this device.',
      icon: Palette,
      perm: 'settings:self' as const,
    },
  ]

  return (
    <div>
      <PageHeader title="Settings" subtitle="System configuration is admin-only (SEC-002, OD-014)." />

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200">
              <UserCog className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-primary">{user?.name}</p>
              <p className="text-xs text-text-muted">{user?.email} · role: <Badge tone="info">{user?.role}</Badge></p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>{status.pending} pending sync</span>
            <span aria-hidden>·</span>
            <span>{status.conflicts} conflicts</span>
            <button type="button" onClick={() => void logout()} className="rounded border border-border-strong px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-ink-50 dark:hover:bg-ink-800">
              Sign out
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {entries.filter((e) => can(e.perm)).map((e) => (
          <Link key={e.to} to={e.to} className="group">
            <Card className="h-full p-4 transition-shadow group-hover:shadow-panel">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <e.icon className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-sm font-semibold text-text-primary">
                    {e.title}
                    <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </p>
                  <p className="mt-1 text-xs text-text-muted">{e.desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {getApi().mode === 'mock' && (
        <Card className="mt-6 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-xs text-amber-900 dark:text-amber-200">
            <strong>Demo mode.</strong> This app is running against the built-in mock backend with sample
            “Demo —” fixtures. No real financial data is stored. Start with <code>npm run dev</code> and set
            <code> VITE_API_MODE=http</code> + <code>VITE_API_BASE_URL</code> to point at a real backend.
          </p>
        </Card>
      )}
    </div>
  )
}
