import { Link } from 'react-router-dom'
import {
  CalendarDays, CalendarRange, BarChart3, Scale, User, ShieldCheck, HardDriveDownload, ArrowRight,
} from 'lucide-react'
import { PageHeader, Card } from '@/ui/Card'
import { useAuth } from '@/features/auth/AuthProvider'

const REPORTS = [
  {
    to: '/reports/daily',
    title: 'Daily activity',
    desc: "Today's or a custom range of disbursements, receipts, expenses, account openings and cash totals.",
    icon: CalendarDays,
    perm: 'reports:view' as const,
  },
  {
    to: '/reports/weekly',
    title: 'Weekly collections',
    desc: 'Weekly collections, customers who paid, new accounts, disbursements and pending/overdue dues.',
    icon: CalendarRange,
    perm: 'reports:view' as const,
  },
  {
    to: '/reports/monthly',
    title: 'Monthly comparison',
    desc: 'This month vs last month — disbursements, collections, expenses, accounts opened/closed, outstanding.',
    icon: BarChart3,
    perm: 'reports:view' as const,
  },
  {
    to: '/reports/outstanding',
    title: 'Outstanding breakdown',
    desc: 'Principal, interest, other dues and totals — by finance type and account status.',
    icon: Scale,
    perm: 'reports:view' as const,
  },
  {
    to: '/reports/customer/' + 'pick',
    title: 'Customer statement',
    desc: 'Per-customer report with all accounts, terms, chronological ledger, dues and collateral references.',
    icon: User,
    perm: 'reports:view' as const,
    hideReal: true,
  },
  {
    to: '/reports/audit',
    title: 'Audit report',
    desc: 'Actor, action, timestamp, reason and affected record for important changes and reversals.',
    icon: ShieldCheck,
    perm: 'audit:read' as const,
  },
  {
    to: '/reports/backup',
    title: 'Backup status',
    desc: 'Last successful backup, destination, restore test and unresolved errors.',
    icon: HardDriveDownload,
    perm: 'backup:view' as const,
  },
]

export default function ReportsHubPage() {
  const { can } = useAuth()

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Every figure is derived from recorded transactions and reconciles to account ledgers (RPT-012). Print or export to PDF from any report."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.filter((r) => can(r.perm)).map((r) => (
          <Link key={r.to} to={r.to} className="group">
            <Card className="h-full p-4 transition-shadow group-hover:shadow-panel">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <r.icon className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-sm font-semibold text-text-primary">
                    {r.title}
                    <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </p>
                  <p className="mt-1 text-xs text-text-muted">{r.desc}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {!REPORTS.some((r) => can(r.perm)) && (
        <Card className="p-6">
          <p className="text-sm text-text-muted">No reports are available for your role.</p>
        </Card>
      )}

      <Card className="mt-6 p-4">
        <p className="text-xs text-text-muted">
          <strong className="text-text-secondary">Important:</strong> total cash collected is never equated with
          interest income or profit (RPT-009, BR-008). Outstanding figures separate principal, interest and other
          approved dues (RPT-008). No interest is calculated by the frontend — amounts come only from recorded
          ledger entries (INT-006).
        </p>
      </Card>
    </div>
  )
}
