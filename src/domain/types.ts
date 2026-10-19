/**
 * Core domain types for the Finance Management System.
 *
 * Money is represented as a decimal STRING end-to-end (never JS number) to
 * satisfy SRS INT-004 (safe decimal arithmetic). All arithmetic goes through
 * decimal.js (see lib/money.ts).
 *
 * Business dates are 'yyyy-MM-dd'; timestamps are ISO-8601 UTC strings.
 */

export type Money = string

export type ISODate = string // yyyy-MM-dd
export type ISODateTime = string // ISO-8601

export type FinanceType = 'free_hand' | 'gold' | 'papers' | 'property' | 'other'

/**
 * Account lifecycle statuses (SRS ACC-006). 'settled' means dues are cleared
 * but the record is retained; 'closed' is the final archived state after a
 * confirmed settlement (ACC-007/009).
 */
export type AccountStatus =
  | 'active'
  | 'overdue'
  | 'settled'
  | 'closed'
  | 'cancelled'

export type RepaymentFrequency = 'daily' | 'weekly' | 'monthly'

/**
 * Explicit rate unit required by INT-003. No conversion is performed by the
 * frontend; the unit is stored exactly as agreed (OD-002 TBD).
 */
export type RateUnit = 'per_day' | 'per_week' | 'per_month' | 'per_year' | 'fixed'

/**
 * Interest method is free-text-with-known-options. The set of actually
 * supported formulas is an open business decision (OD-001 TBD); the frontend
 * NEVER computes accrued interest — it only stores and displays what the
 * operator/backend provides.
 */
export type InterestMethod =
  | 'simple'
  | 'compound'
  | 'fixed_total'
  | 'other'
  | 'unspecified'

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'other'

export type TransactionType =
  | 'disbursement'
  | 'receipt'
  | 'adjustment'
  | 'reversal'

/**
 * Payment allocation components (OD-004 TBD for the definitive list).
 * Allocation is always MANUAL (PAY-005); the frontend never auto-assigns a
 * priority order.
 */
export type AllocationComponent = 'principal' | 'interest' | 'other'

export type SyncState = 'synced' | 'pending' | 'syncing' | 'failed' | 'conflict'

export type CollateralStatus = 'held' | 'released'

export type ExpenseCategory =
  | 'rent'
  | 'salary'
  | 'travel'
  | 'supplies'
  | 'utilities'
  | 'fuel'
  | 'food'
  | 'maintenance'
  | 'other'

export type UserRole = 'operator' | 'admin'

/* ------------------------------------------------------------------ */
/* Entities (SRS §5)                                                   */
/* ------------------------------------------------------------------ */

export interface User {
  id: string
  name: string
  role: UserRole
  phone?: string
  email?: string
}

export interface Session {
  user: User
  token: string
  expiresAt: ISODateTime
}

export interface PhotoRef {
  id: string
  /** Local object URL or remote URL. Remote only after sync. */
  url: string
  fileName: string
  contentType: string
  sizeBytes: number
  uploadedAt: ISODateTime
  /** true until the binary has been accepted by the server */
  pendingSync: boolean
}

export interface Customer {
  id: string
  name: string
  phone: string
  photo?: PhotoRef
  address?: string
  notes?: string
  status: 'active' | 'inactive'
  createdAt: ISODateTime
  updatedAt: ISODateTime
  syncState: SyncState
}

export interface AllocationLine {
  component: AllocationComponent
  amount: Money
}

/**
 * Agreement terms version (SRS ACC-008, INT-005). Terms changes create a NEW
 * version with effectiveFrom — they never rewrite history.
 */
export interface AgreementVersion {
  id: string
  accountId: string
  versionNo: number
  effectiveFrom: ISODate
  /** null while still current */
  effectiveTo: ISODate | null
  principalAmount: Money
  interestMethod: InterestMethod
  rateValue: string
  rateUnit: RateUnit
  repaymentFrequency: RepaymentFrequency
  /** Free-text agreement notes exactly as written on paper, if any. */
  agreementTerms: string
  changedReason?: string
  authorizingUserId: string
  createdAt: ISODateTime
}

export interface FinanceAccount {
  id: string
  customerId: string
  financeType: FinanceType
  /** Collateral-backed flag (COL-001). Free Hand is never collateral-backed. */
  collateralBacked: boolean
  disbursedAmount: Money
  startDate: ISODate
  status: AccountStatus
  currentTerms: AgreementVersion
  notes?: string
  createdAt: ISODateTime
  updatedAt: ISODateTime
  syncState: SyncState
}

export interface OutstandingBreakdown {
  principal: Money
  interest: Money
  other: Money
  total: Money
}

export interface Collateral {
  id: string
  accountId: string
  customerId: string
  description: string
  reference?: string
  photos: PhotoRef[]
  status: CollateralStatus
  recordedAt: ISODate
  releasedAt?: ISODate
  releaseNote?: string
  createdAt: ISODateTime
  syncState: SyncState
}

export interface Transaction {
  id: string
  /** Idempotency key assigned client-side before any network call (BR-011). */
  idempotencyKey: string
  customerId: string
  accountId: string
  type: TransactionType
  amount: Money
  date: ISODate
  datetime: ISODateTime
  method: PaymentMethod
  reference?: string
  notes?: string
  allocation: AllocationLine[]
  actorId: string
  actorName: string
  syncState: SyncState
  /** For reversals: the original transaction that is being corrected (PAY-008). */
  reversalOfId?: string
  reversalReason?: string
  /** Set when this transaction was itself reversed. */
  reversedById?: string
  createdAt: ISODateTime
}

export type DueStatus =
  | 'due_today'
  | 'upcoming'
  | 'partially_paid'
  | 'paid'
  | 'overdue'

export interface ScheduleItem {
  id: string
  accountId: string
  customerId: string
  dueDate: ISODate
  expectedAmount: Money
  expectedAllocation: AllocationLine[]
  paidAmount: Money
  status: DueStatus
  overdueDays: number
  lastPaymentDate: ISODate | null
  calculationVersion?: string
  followUpNote?: string
  followUpDone: boolean
  /** 'provisional' when computed from possibly-stale local data (SRS 7.2). */
  freshness: 'confirmed' | 'provisional'
}

export interface Expense {
  id: string
  idempotencyKey: string
  date: ISODate
  amount: Money
  category: ExpenseCategory
  method: PaymentMethod
  notes?: string
  attachment?: PhotoRef
  actorId: string
  actorName: string
  syncState: SyncState
  createdAt: ISODateTime
}

export interface CashMovement {
  id: string
  date: ISODate
  kind: 'opening' | 'cash_in' | 'cash_out' | 'adjustment'
  amount: Money
  note?: string
  linkedTransactionId?: string
  createdAt: ISODateTime
}

export interface CashbookDay {
  date: ISODate
  openingCash: Money
  cashReceived: Money
  cashDisbursed: Money
  expensesPaidInCash: Money
  otherMovements: Money
  expectedClosingCash: Money
  actualCountedCash: Money | null
  difference: Money | null
  countedAt?: ISODateTime
  note?: string
  movements: CashMovement[]
}

export interface Receipt {
  receiptNo: string
  transactionId: string
  generatedAt: ISODateTime
  businessName: string
  businessContact?: string
  customerName: string
  customerPhone: string
  accountLabel: string
  financeType: FinanceType
  type: TransactionType
  amount: Money
  method: PaymentMethod
  reference?: string
  date: ISODate
  allocation: AllocationLine[]
  remainingOutstanding?: OutstandingBreakdown
  actorName: string
}

export interface AuditEvent {
  id: string
  actorId: string
  actorName: string
  action: string
  entityType: string
  entityId: string
  timestamp: ISODateTime
  reason?: string
  beforeAfter?: string
}

export interface BackupStatus {
  lastBackupAt: ISODateTime | null
  lastBackupResult: 'success' | 'failed' | 'never' | null
  destination: string | null
  lastRestoreTestAt: ISODateTime | null
  unresolvedErrors: string[]
}

/* ------------------------------------------------------------------ */
/* Aggregates / report DTOs                                            */
/* ------------------------------------------------------------------ */

export interface AccountSummary extends FinanceAccount {
  customerName: string
  customerPhone: string
  outstanding: OutstandingBreakdown
  disbursedTotal: Money
  receivedTotal: Money
  lastPaymentDate: ISODate | null
  nextDueDate: ISODate | null
  overdueDays: number
}

export interface CustomerSummary extends Customer {
  accounts: AccountSummary[]
  totalOutstanding: OutstandingBreakdown
  activeAccountCount: number
}

export interface CustomerDetail extends CustomerSummary {
  transactions: Transaction[]
  collaterals: Collateral[]
  scheduleItems: ScheduleItem[]
}

export interface DueItem {
  scheduleItemId: string
  accountId: string
  customerId: string
  customerName: string
  customerPhone: string
  accountLabel: string
  financeType: FinanceType
  dueDate: ISODate
  expectedAmount: Money
  paidAmount: Money
  balanceAmount: Money
  status: DueStatus
  overdueDays: number
  lastPaymentDate: ISODate | null
  followUpDone: boolean
  freshness: 'confirmed' | 'provisional'
}

/* ------------------------------------------------------------------ */
/* Reports (SRS §4) — every total derives from recorded transactions.  */
/* ------------------------------------------------------------------ */

export interface DateRange {
  from: ISODate
  to: ISODate
}

export type ReportPeriod =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'custom'

export interface MethodTotals {
  cash: Money
  upi: Money
  bankTransfer: Money
  other: Money
  total: Money
}

export interface DailyActivityReport {
  range: DateRange
  generatedAt: ISODateTime
  disbursements: { count: number; totals: MethodTotals }
  receipts: { count: number; totals: MethodTotals }
  expenses: { count: number; totals: MethodTotals }
  newAccounts: number
  closedAccounts: number
  dueTodayCount: number
  overdueCount: number
  openingCash: Money
  expectedClosingCash: Money
  cashReceived: Money
  cashDisbursed: Money
  transactions: Transaction[]
  expenseList: Expense[]
}

export interface WeeklyReport extends Omit<DailyActivityReport, 'transactions' | 'expenseList'> {
  customersWhoPaid: { customerId: string; customerName: string; amount: Money }[]
  pendingDuesCount: number
  overdueDuesCount: number
  pendingDuesAmount: Money
  overdueDuesAmount: Money
}

export interface MonthlyComparison {
  thisMonth: MonthStats
  lastMonth: MonthStats
}

export interface MonthStats {
  label: string
  range: DateRange
  disbursed: Money
  collected: Money
  expenses: Money
  accountsOpened: number
  accountsClosed: number
  outstandingTotal: Money
}

export interface OutstandingReport {
  generatedAt: ISODateTime
  total: OutstandingBreakdown
  byFinanceType: {
    financeType: FinanceType
    outstanding: OutstandingBreakdown
    accountCount: number
  }[]
  byStatus: {
    status: AccountStatus
    outstanding: OutstandingBreakdown
    accountCount: number
  }[]
  accounts: AccountSummary[]
}

export interface CollateralRegisterEntry {
  collateral: Collateral
  customerName: string
  accountLabel: string
  financeType: FinanceType
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface PageQuery {
  page?: number
  pageSize?: number
}

/* ------------------------------------------------------------------ */
/* Sync (SRS §7.2, BR-011/012)                                         */
/* ------------------------------------------------------------------ */

export type OutboxOpKind =
  | 'create_customer'
  | 'update_customer'
  | 'create_account'
  | 'update_account_terms'
  | 'create_collateral'
  | 'release_collateral'
  | 'create_transaction'
  | 'reverse_transaction'
  | 'create_expense'
  | 'record_cash_count'
  | 'set_opening_cash'
  | 'set_follow_up'

export interface OutboxOp {
  localSeq?: number
  /** Stable unique ID assigned BEFORE enqueue — survives restarts (BR-011). */
  opId: string
  kind: OutboxOpKind
  payload: unknown
  createdAt: ISODateTime
  syncState: Exclude<SyncState, 'synced'> | 'synced'
  attempts: number
  lastError?: string
  serverId?: string
  actorId: string
}

export interface SyncAck {
  opId: string
  status: 'accepted' | 'conflict' | 'rejected'
  serverId?: string
  serverEntity?: unknown
  message?: string
}

export interface SyncConflict {
  opId: string
  kind: OutboxOpKind
  createdAt: ISODateTime
  localPayload: unknown
  serverState: unknown
  message: string
}

/** A locally-created entity pending sync, for honest UI labelling. */
export interface PendingLocalRef {
  pendingSync: true
  opId: string
}
