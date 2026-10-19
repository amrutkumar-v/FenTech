# API Summary (Frontend Contract)

The frontend uses a single typed `ApiClient` contract (`src/api/contracts.ts`). Adapters: `MockAdapter` (default, `VITE_API_MODE=mock`, localStorage `fms.mockdb.v1`) and `HttpAdapter` (`VITE_API_MODE=http`, `VITE_API_BASE_URL`).

## Auth
- `POST /login` → Session (operator@demo.local/admin@demo.local, demo1234)
- `POST /logout` → void
- `GET /session` → Session | null

## Customers
- `GET /customers?q` → Paged<CustomerSummary> (includes `totalOutstanding`, `activeAccountCount`, `accounts[]`)
- `GET /customers/:id` → CustomerDetail (accounts, transactions, collaterals, scheduleItems)
- `POST /customers` → Customer (create)
- `PUT /customers/:id` → Customer (update)
- `GET /customers/duplicates?name&phone` → CustomerSummary[]

## Accounts
- `GET /accounts` → Paged<AccountSummary>
- `GET /accounts/:id` → AccountSummary (includes `outstanding`, `disbursedTotal`, `receivedTotal`, `nextDueDate`, `overdueDays`)
- `POST /accounts` → FinanceAccount
- `PUT /accounts/:id/terms` → AgreementVersion
- `GET /accounts/:id/terms/history` → AgreementVersion[]
- `POST /accounts/:id/close` → FinanceAccount
- `GET /accounts/:id/settlement` → SettlementPreview (server-authoritative; frontend never invents interest/penalty formulas)

## Collateral
- `GET /collateral` → Paged<CollateralRegisterEntry>
- `POST /collateral/:id/photos` → Collateral (multipart file upload)
- `POST /collateral/:id/release` → Collateral

## Transactions
- `POST /transactions` → Transaction (idempotencyKey required)
- `GET /transactions` → Paged<Transaction> (filter by customerId/accountId/type/method/range/search)
- `POST /transactions/:id/reverse` → Transaction (reversal is new linked entry; reason required)

## Collections/Due items
- `GET /due-items` → DueItem[] (filters: date, includeUpcoming, onlyOverdue). `freshness` can be `confirmed|provisional`. 
- `POST /schedule-items/:id/follow-up` → DueItem

## Cashbook
- `GET /cashbook?date` → CashbookDay (opening, movements, expected closing, counted actual/difference)
- `POST /cashbook/opening` → CashbookDay
- `POST /cashbook/count` → CashbookDay
- `GET /expenses` → Paged<Expense>
- `POST /expenses` → Expense

## Reports
- `POST/GET /reports/daily` (range) → DailyActivityReport (totals by method, counts, cash figures, transactions, expenseList)
- `POST/GET /reports/weekly` (range) → WeeklyReport
- `GET /reports/monthly-comparison` → MonthlyComparison
- `GET /reports/outstanding` → OutstandingReport (byFinanceType, byStatus, accounts)
- `GET /reports/customer/:id` → CustomerDetail (with optional range)
- `GET /audit-events` → Paged<AuditEvent> (filters: actorId, entityType, range, pagination)
- `GET /backup/status` → BackupStatus
- `POST /backup/request` → BackupStatus

## Receipts
- `GET /receipts/:transactionId` → Receipt

## Sync
- `POST /sync/operations` → SyncAck[] (batch). Body: `[{ opId, kind, payload, createdAt }, ...]`. Acks include `opId`, `status: 'accepted'|'conflict'|'rejected'`, optional `serverId`, `serverEntity`/message.

## Constraints (enforced)
- Money: decimal strings only (INT-004). No floats.
- Outstanding = sum of RECORDED ledger allocations (INT-006, BR-008).
- Manual allocation on receipts (PAY-005). 
- Collateral photos required for collateral-backed non–Free-Hand (COL-001).
- Reversals never delete; linked entries only.
- Offline: stable client-side `opId` before enqueue (BR-011), idempotent sync, conflicts never auto-resolved (BR-012), pending records labeled “not yet confirmed by server”.
- No frontend interest/penalty computation — display server values verbatim (SettlementPreview, schedule rules TBD OD-001/OD-005/OD-006).

> Mock adapter implements all endpoints with in-memory + localStorage persistence and seeded "Demo —" fixtures. Not for production.
