import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout, RequireAuth } from './AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { LoadingState } from '@/ui/States'

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage'))
const CustomerFormPage = lazy(() => import('@/features/customers/CustomerFormPage'))
const CustomerProfilePage = lazy(() => import('@/features/customers/CustomerProfilePage'))
const AccountFormPage = lazy(() => import('@/features/accounts/AccountFormPage'))
const AccountDetailPage = lazy(() => import('@/features/accounts/AccountDetailPage'))
const TermsFormPage = lazy(() => import('@/features/accounts/TermsFormPage'))
const CloseAccountPage = lazy(() => import('@/features/accounts/CloseAccountPage'))
const CollateralRegisterPage = lazy(() => import('@/features/collateral/CollateralRegisterPage'))
const RecordPaymentPage = lazy(() => import('@/features/payments/RecordPaymentPage'))
const RecordDisbursementPage = lazy(() => import('@/features/payments/RecordDisbursementPage'))
const ReceiptPage = lazy(() => import('@/features/receipts/ReceiptPage'))
const TransactionsPage = lazy(() => import('@/features/transactions/TransactionsPage'))
const CollectionsPage = lazy(() => import('@/features/collections/CollectionsPage'))
const CashbookPage = lazy(() => import('@/features/cashbook/CashbookPage'))
const ReportsHubPage = lazy(() => import('@/features/reports/ReportsHubPage'))
const DailyReportPage = lazy(() => import('@/features/reports/DailyReportPage'))
const WeeklyReportPage = lazy(() => import('@/features/reports/WeeklyReportPage'))
const MonthlyReportPage = lazy(() => import('@/features/reports/MonthlyReportPage'))
const OutstandingReportPage = lazy(() => import('@/features/reports/OutstandingReportPage'))
const CustomerStatementPage = lazy(() => import('@/features/reports/CustomerStatementPage'))
const AuditReportPage = lazy(() => import('@/features/reports/AuditReportPage'))
const BackupReportPage = lazy(() => import('@/features/reports/BackupReportPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const UsersSettingsPage = lazy(() => import('@/features/settings/UsersSettingsPage'))
const SyncSettingsPage = lazy(() => import('@/features/settings/SyncSettingsPage'))
const BackupSettingsPage = lazy(() => import('@/features/settings/BackupSettingsPage'))
const AppearanceSettingsPage = lazy(() => import('@/features/settings/AppearanceSettingsPage'))

function Lazy({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingState />}>{children}</Suspense>
  )
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Lazy><DashboardPage /></Lazy> },
      { path: 'customers', element: <Lazy><CustomersPage /></Lazy> },
      { path: 'customers/new', element: <Lazy><CustomerFormPage /></Lazy> },
      { path: 'customers/:id', element: <Lazy><CustomerProfilePage /></Lazy> },
      { path: 'customers/:id/edit', element: <Lazy><CustomerFormPage /></Lazy> },
      { path: 'accounts/new', element: <Lazy><AccountFormPage /></Lazy> },
      { path: 'accounts/:id', element: <Lazy><AccountDetailPage /></Lazy> },
      { path: 'accounts/:id/terms', element: <Lazy><TermsFormPage /></Lazy> },
      { path: 'accounts/:id/close', element: <Lazy><CloseAccountPage /></Lazy> },
      { path: 'collateral', element: <Lazy><CollateralRegisterPage /></Lazy> },
      { path: 'payments/receipt', element: <Lazy><RecordPaymentPage /></Lazy> },
      { path: 'payments/disburse', element: <Lazy><RecordDisbursementPage /></Lazy> },
      { path: 'receipts/:txnId', element: <Lazy><ReceiptPage /></Lazy> },
      { path: 'transactions', element: <Lazy><TransactionsPage /></Lazy> },
      { path: 'collections', element: <Lazy><CollectionsPage /></Lazy> },
      { path: 'cashbook', element: <Lazy><CashbookPage /></Lazy> },
      { path: 'reports', element: <Lazy><ReportsHubPage /></Lazy> },
      { path: 'reports/daily', element: <Lazy><DailyReportPage /></Lazy> },
      { path: 'reports/weekly', element: <Lazy><WeeklyReportPage /></Lazy> },
      { path: 'reports/monthly', element: <Lazy><MonthlyReportPage /></Lazy> },
      { path: 'reports/outstanding', element: <Lazy><OutstandingReportPage /></Lazy> },
      { path: 'reports/customer/:id', element: <Lazy><CustomerStatementPage /></Lazy> },
      { path: 'reports/audit', element: <Lazy><AuditReportPage /></Lazy> },
      { path: 'reports/backup', element: <Lazy><BackupReportPage /></Lazy> },
      { path: 'settings', element: <Lazy><SettingsPage /></Lazy> },
      { path: 'settings/users', element: <Lazy><UsersSettingsPage /></Lazy> },
      { path: 'settings/sync', element: <Lazy><SyncSettingsPage /></Lazy> },
      { path: 'settings/backup', element: <Lazy><BackupSettingsPage /></Lazy> },
      { path: 'settings/appearance', element: <Lazy><AppearanceSettingsPage /></Lazy> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
