import type {
  AccountSummary,
  AgreementVersion,
  AuditEvent,
  BackupStatus,
  CashbookDay,
  Collateral,
  CollateralRegisterEntry,
  Customer,
  CustomerDetail,
  CustomerSummary,
  DailyActivityReport,
  DateRange,
  DueItem,
  Expense,
  ExpenseCategory,
  FinanceAccount,
  FinanceType,
  InterestMethod,
  MonthlyComparison,
  Money,
  OutstandingReport,
  PageQuery,
  Paged,
  PaymentMethod,
  RateUnit,
  Receipt,
  RepaymentFrequency,
  Session,
  SyncAck,
  Transaction,
  TransactionType,
  User,
  AllocationLine,
  ISODate,
  ISODateTime,
} from '@/domain/types'

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export interface LoginInput {
  email: string
  password: string
}

export interface CreateCustomerInput {
  /** Client-assigned stable ID (offline-first, BR-011). */
  id: string
  name: string
  phone: string
  address?: string
  notes?: string
  photoFile?: File
}

export interface UpdateCustomerInput {
  name?: string
  phone?: string
  address?: string
  notes?: string
  status?: 'active' | 'inactive'
  photoFile?: File
  removePhoto?: boolean
}

export interface CreateAccountInput {
  /** Client-assigned stable ID. */
  id: string
  customerId: string
  financeType: FinanceType
  collateralBacked: boolean
  disbursedAmount: Money
  startDate: ISODate
  interestMethod: InterestMethod
  rateValue: string
  rateUnit: RateUnit
  repaymentFrequency: RepaymentFrequency
  agreementTerms: string
  notes?: string
  /** Required when collateralBacked (COL-001). */
  collateral?: {
    id: string
    description: string
    reference?: string
    photoFiles: File[]
  }
}

export interface UpdateTermsInput {
  effectiveFrom: ISODate
  interestMethod: InterestMethod
  rateValue: string
  rateUnit: RateUnit
  repaymentFrequency: RepaymentFrequency
  agreementTerms: string
  changedReason: string
}

export interface CreateTransactionInput {
  /** Client-assigned stable ID — idempotency key (BR-011, PAY-007). */
  id: string
  customerId: string
  accountId: string
  type: TransactionType
  amount: Money
  date: ISODate
  method: PaymentMethod
  reference?: string
  notes?: string
  /** Manual allocation (PAY-005). Required for receipts. */
  allocation?: AllocationLine[]
}

export interface ReverseTransactionInput {
  reason: string
  date: ISODate
}

export interface CreateExpenseInput {
  id: string
  date: ISODate
  amount: Money
  category: ExpenseCategory
  method: PaymentMethod
  notes?: string
  attachmentFile?: File
}

export interface RecordCashCountInput {
  actualCountedCash: Money
  note?: string
}

export interface SetOpeningCashInput {
  date: ISODate
  amount: Money
  note?: string
}

export interface FollowUpInput {
  done: boolean
  note?: string
}

export interface CustomerQuery extends PageQuery {
  search?: string
  status?: 'active' | 'inactive'
}

export interface TransactionQuery extends PageQuery {
  customerId?: string
  accountId?: string
  type?: TransactionType
  method?: PaymentMethod
  range?: DateRange
  search?: string
}

export interface ExpenseQuery extends PageQuery {
  range?: DateRange
  category?: ExpenseCategory
  method?: PaymentMethod
}

export interface AuditQuery extends PageQuery {
  actorId?: string
  entityType?: string
  range?: DateRange
}

/* ------------------------------------------------------------------ */
/* API client contract — every backend capability the frontend needs.  */
/* ------------------------------------------------------------------ */

export interface ApiClient {
  readonly mode: 'http' | 'mock'

  /* Auth */
  login(input: LoginInput): Promise<Session>
  logout(): Promise<void>
  getSession(): Promise<Session | null>

  /* Users / access (admin) */
  listUsers(): Promise<User[]>
  revokeOtherSessions(): Promise<void>

  /* Customers (CUS-*) */
  listCustomers(q: CustomerQuery): Promise<Paged<CustomerSummary>>
  getCustomer(id: string): Promise<CustomerDetail>
  createCustomer(input: CreateCustomerInput): Promise<Customer>
  updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer>
  findDuplicateCustomers(name: string, phone: string): Promise<CustomerSummary[]>

  /* Accounts (ACC-*) */
  listAccounts(q: PageQuery & { customerId?: string; status?: string; financeType?: FinanceType }): Promise<
    Paged<AccountSummary>
  >
  getAccount(id: string): Promise<AccountSummary>
  createAccount(input: CreateAccountInput): Promise<FinanceAccount>
  updateTerms(accountId: string, input: UpdateTermsInput): Promise<AgreementVersion>
  listTermsHistory(accountId: string): Promise<AgreementVersion[]>
  closeAccount(accountId: string, note?: string): Promise<FinanceAccount>
  /**
   * Server-authoritative settlement preview. The frontend never invents
   * interest/penalty math (INT-006); it only displays this.
   */
  getSettlement(accountId: string): Promise<SettlementPreview>

  /* Collateral (COL-*) */
  listCollateral(q: PageQuery & { accountId?: string; customerId?: string; status?: string }): Promise<
    Paged<CollateralRegisterEntry>
  >
  addCollateralPhotos(collateralId: string, files: File[]): Promise<Collateral>
  releaseCollateral(collateralId: string, note: string): Promise<Collateral>

  /* Transactions (PAY-*) */
  createTransaction(input: CreateTransactionInput): Promise<Transaction>
  listTransactions(q: TransactionQuery): Promise<Paged<Transaction>>
  reverseTransaction(id: string, input: ReverseTransactionInput): Promise<Transaction>

  /* Schedules / collections (COLL-*) */
  listDueItems(q: { date?: ISODate; includeUpcoming?: boolean; onlyOverdue?: boolean }): Promise<DueItem[]>
  setFollowUp(scheduleItemId: string, input: FollowUpInput): Promise<DueItem>

  /* Cashbook / expenses (CASH-*) */
  getCashbook(date: ISODate): Promise<CashbookDay>
  setOpeningCash(input: SetOpeningCashInput): Promise<CashbookDay>
  recordCashCount(date: ISODate, input: RecordCashCountInput): Promise<CashbookDay>
  listExpenses(q: ExpenseQuery): Promise<Paged<Expense>>
  createExpense(input: CreateExpenseInput): Promise<Expense>

  /* Reports (RPT-*) — every figure derived from recorded transactions. */
  getDailyReport(range: DateRange): Promise<DailyActivityReport>
  getWeeklyReport(range: DateRange): Promise<import('@/domain/types').WeeklyReport>
  getMonthlyComparison(): Promise<MonthlyComparison>
  getOutstandingReport(q: { financeType?: FinanceType; status?: string }): Promise<OutstandingReport>
  getCustomerStatement(customerId: string, range?: DateRange): Promise<CustomerDetail>

  /* Receipts (PRN-*) */
  getReceipt(transactionId: string): Promise<Receipt>

  /* Sync (SRS 7.2) — server acknowledges each op by opId (idempotent). */
  syncOperations(
    ops: { opId: string; kind: string; payload: unknown; createdAt: ISODateTime }[],
  ): Promise<SyncAck[]>

  /* Backup status (7.3) */
  getBackupStatus(): Promise<BackupStatus>
  requestBackup(): Promise<BackupStatus>

  /* Audit */
  listAuditEvents(q: AuditQuery): Promise<Paged<AuditEvent>>

  /* Photos */
  getPhotoBlob(photoId: string): Promise<Blob>
}

export interface SettlementPreview {
  accountId: string
  generatedAt: ISODateTime
  /** Component totals from RECORDED allocations — not an invented formula. */
  outstanding: {
    principal: Money
    interest: Money
    other: Money
    total: Money
  }
  disbursedTotal: Money
  receivedTotal: Money
  canClose: boolean
  /** Human-readable blockers, e.g. "Outstanding dues remain". */
  blockers: string[]
  /**
   * Set when the server can compute settlement amounts that are not merely
   * sums of recorded allocations (approved interest rules, OD-001).
   * Frontend displays it verbatim; it never recomputes.
   */
  serverComputed?: {
    finalAmountDue: Money
    explanation: string
  }
  terms: AgreementVersion
}
