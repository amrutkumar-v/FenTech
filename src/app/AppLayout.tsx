import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CalendarClock,
  BookOpen,
  Wallet,
  FileBarChart,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  LogOut,
  Menu,
  X,
  CloudUpload,
  ShieldAlert,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthProvider'
import { useSync } from '@/offline/sync'
import { isMockMode } from '@/api/provider'
import { Badge } from '@/ui/Badge'
import { useQuery } from '@tanstack/react-query'
import { pendingCount } from '@/offline/db'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/collections', label: 'Collections', icon: CalendarClock },
  { to: '/cashbook', label: 'Cashbook', icon: Wallet },
  { to: '/transactions', label: 'Ledger', icon: BookOpen },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const MOBILE_NAV = NAV.slice(0, 5)

export function AppLayout() {
  const { user, logout, can } = useAuth()
  const { status, flush } = useSync()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)

  const { data: pendingOpsCount } = useQuery({
    queryKey: ['sync-badge'],
    queryFn: () => pendingCount(),
    refetchInterval: 15000,
  })

  const showPending = (pendingOpsCount ?? 0) > 0 || status.conflicts > 0

  return (
    <div className="flex min-h-full bg-surface-sunken">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border-base bg-surface-raised lg:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border-base px-4">
          <span className="flex size-7 items-center justify-center rounded-md bg-brand-700 text-xs font-bold text-white">
            ₹
          </span>
          <span className="text-sm font-semibold text-text-primary">Finance System</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Main">
          {NAV.filter((item) => item.to !== '/settings' || can('settings:self')).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors
                ${isActive ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200' : 'text-text-secondary hover:bg-ink-100 hover:text-text-primary dark:hover:bg-ink-800'}`
              }
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border-base p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-text-primary">{user?.name}</p>
              <p className="text-[11px] capitalize text-text-muted">{user?.role}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout().then(() => navigate('/login'))}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-md p-1.5 text-text-muted hover:bg-ink-100 hover:text-text-primary dark:hover:bg-ink-800"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50" onClick={() => setDrawer(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-64 bg-surface-raised p-3 shadow-popover">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold">Menu</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="rounded p-1">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav className="space-y-0.5" aria-label="Mobile main">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setDrawer(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium
                    ${isActive ? 'bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-200' : 'text-text-secondary hover:bg-ink-100'}`
                  }
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => void logout().then(() => navigate('/login'))}
              className="mt-4 flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-ink-100"
            >
              <LogOut className="size-4" aria-hidden /> Sign out
            </button>
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border-base bg-surface-raised/95 px-3 backdrop-blur sm:px-4">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            className="rounded-md p-2 text-text-secondary hover:bg-ink-100 lg:hidden"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1" />

          {/* Connectivity + sync */}
          <div className="flex items-center gap-1.5">
            {status.connectivity === 'offline' ? (
              <Badge tone="warning" title="No internet connection. New records are saved on this device only.">
                <WifiOff className="size-3" aria-hidden /> Offline
              </Badge>
            ) : (
              <Badge tone="success" title="Connected">
                <Wifi className="size-3" aria-hidden /> Online
              </Badge>
            )}
            {showPending && (
              <button
                type="button"
                onClick={() => navigate('/settings/sync')}
                title="Open sync status"
                className="rounded-full"
              >
                <Badge tone={status.conflicts > 0 ? 'warning' : 'pending'}>
                  <CloudUpload className="size-3" aria-hidden />
                  {(pendingOpsCount ?? 0) > 0 ? `${pendingOpsCount} pending` : 'Conflicts'}
                </Badge>
              </button>
            )}
            <button
              type="button"
              onClick={() => void flush()}
              disabled={status.syncing || status.connectivity === 'offline'}
              aria-label="Sync now"
              title="Sync now"
              className="rounded-md p-2 text-text-muted hover:bg-ink-100 hover:text-text-primary disabled:opacity-40"
            >
              <RefreshCw className={`size-4 ${status.syncing ? 'animate-spin' : ''}`} aria-hidden />
            </button>
          </div>
        </header>

        {isMockMode() && (
          <div className="no-print flex items-center gap-2 border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 sm:px-4">
            <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
            MOCK MODE — using in-browser demo fixtures, not a real backend. Do not enter real financial data.
          </div>
        )}

        <main
          key={location.pathname}
          className="mx-auto w-full max-w-6xl flex-1 px-3 pb-24 pt-4 animate-fade-in sm:px-4 sm:pt-6 lg:pb-8"
        >
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-border-base bg-surface-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
          aria-label="Bottom navigation"
        >
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium
                ${isActive ? 'text-brand-700 dark:text-brand-300' : 'text-text-muted'}`
              }
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}

export function RequireAuth({ children }: { children?: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface-sunken">
        <span className="inline-block size-6 animate-spin rounded-full border-2 border-border-strong border-t-brand-600" aria-hidden />
        <span className="sr-only">Checking session…</span>
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }
  return <>{children}</>
}
