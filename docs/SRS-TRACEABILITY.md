# SRS-to-Screen Traceability Matrix

Source: SRS v1.0 (Finance Management System). Extracted to: `C:\Users\vamru\AppData\Local\Temp\opencode\srs_text.txt`

## Core rules (cross-cutting)
- BR-003: One account per customer per finance type — `CustomerFormPage` duplicate check with acknowledgement; `AccountFormPage` blocks duplicates.
- BR-008: Outstanding = sum of RECORDED ledger allocations — `computeOutstanding` in `src/api/mock/db.ts`.
- INT-006: No interest/penalty computation in frontend — `AllocationEditor`, `AccountDetailPage`, reports never compute rates; `SettlementPreview` is server-authoritative.
- COL-001: Collateral photos required for Gold/Papers/Property/Other(collateral-backed), never Free Hand — `AccountFormPage`, `CollateralRegisterPage`.
- PAY-005: Manual allocation — `AllocationEditor.tsx`, `RecordPaymentPage`, `RecordDisbursementPage`.
- BR-011: Stable client-side opId before enqueue, idempotent sync — `newId()` in `lib/ids.ts`, `useOfflineAction`, `syncOperations`.
- BR-012: Conflicts never auto-resolved; human review required — `SyncProvider`, `SyncSettingsPage`.
- SRS 7.2: Pending records labeled "not yet confirmed by the server" — `SyncBadge`, dashboard alerts, UI.
- SRS 6.1/6.2: Roles operator vs admin — `permissions.ts`, `AuthProvider`, Settings pages gate by permission.

## SRS §4 Reports
- RPT-002 Daily activity — `DailyReportPage`
- RPT-003 Weekly collections — `WeeklyReportPage`
- RPT-004 Monthly comparison — `MonthlyReportPage`
- RPT-005 Customer statement — `CustomerStatementPage`
- RPT-008 Outstanding breakdown — `OutstandingReportPage`, `DashboardPage`
- RPT-009 Collections not profit — UI notes
- RPT-011 Backup status — `BackupReportPage`, `BackupSettingsPage`
- RPT-012 Reports from recorded transactions only — all report pages + tests

## SRS §5 Domain model
Entities: User/Session, Customer, AgreementVersion, FinanceAccount, Collateral, Transaction, ScheduleItem, DueItem, Expense, CashbookDay/CashMovement, Receipt, AuditEvent, BackupStatus, report DTOs — `src/domain/types.ts`.

## Pages
- Login — `src/features/auth/LoginPage.tsx`
- Dashboard — `src/features/dashboard/DashboardPage.tsx`
- Customers list/form/profile — `src/features/customers/*`
- Accounts form/detail/terms/close — `src/features/accounts/*`
- Collateral register — `src/features/collateral/CollateralRegisterPage.tsx`
- Payments — `src/features/payments/*`
- Receipts — `src/features/receipts/ReceiptPage.tsx`
- Transactions/ledger + reversal — `src/features/transactions/TransactionsPage.tsx`
- Collections — `src/features/collections/CollectionsPage.tsx`
- Cashbook — `src/features/cashbook/CashbookPage.tsx`
- Reports hub + 8 pages — `src/features/reports/*`
- Settings + 4 pages — `src/features/settings/*`

## Tests
- `src/lib/money.test.ts` (INT-004)
- `src/domain/permissions.test.ts` (SRS §2, SEC-002, OD-014)
- `src/api/mock/balance.test.ts` (BR-008)
- `src/lib/dates.test.ts` (RPT-002)
- `src/features/payments/allocation.test.ts` (PAY-005)

## Artifacts
- Design tokens + dark mode — `src/index.css`
- PWA — `vite.config.ts` (VitePWA), `public/*`
- Offline — `src/offline/*`
- API — `src/api/*`
