import type {
  AccountSummary,
  CashbookDay,
  Customer,
  CustomerDetail,
  CustomerSummary,
  DueItem,
  FinanceAccount,
  MonthlyComparison,
  MonthStats,
  OutstandingReport,
  Paged,
  Receipt,
  Session,
  SyncAck,
  Transaction,
  User,
  WeeklyReport,
  DailyActivityReport,
  DateRange,
  ISODate,
  CollateralRegisterEntry,
  Collateral,
  AgreementVersion,
  Expense,
  BackupStatus,
  AuditEvent,
  MethodTotals,
} from '@/domain/types'
import type {
  ApiClient,
  AuditQuery,
  CreateAccountInput,
  CreateCustomerInput,
  CreateExpenseInput,
  CreateTransactionInput,
  CustomerQuery,
  ExpenseQuery,
  FollowUpInput,
  LoginInput,
  RecordCashCountInput,
  ReverseTransactionInput,
  SetOpeningCashInput,
  SettlementPreview,
  TransactionQuery,
  UpdateCustomerInput,
  UpdateTermsInput,
} from '../contracts'
import { ApiError } from '../errors'
import {
  type MockDb,
  loadMockDb,
  saveMockDb,
  resetMockDb,
  computeOutstanding,
  accountTransactions,
  addAudit,
} from './db'
import { todayISO, nowISO, toISODate } from '@/lib/dates'
import { addMoney, sumMoney, d, subMoney } from '@/lib/money'
import { newId } from '@/lib/ids'
import { compressImage, blobToDataUrl } from '@/lib/image'

const LATENCY_MS = 180

function delay(ms = LATENCY_MS): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function paged<T>(items: T[], page = 1, pageSize = 50): Paged<T> {
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), total: items.length, page, pageSize }
}

function methodTotals(txns: Transaction[], type: Transaction['type']): MethodTotals {
  const of = (m: string) =>
    sumMoney(txns.filter((t) => t.type === type && t.method === m).map((t) => t.amount))
  const cash = of('cash')
  const upi = of('upi')
  const bankTransfer = of('bank_transfer')
  const other = of('other')
  return {
    cash,
    upi,
    bankTransfer,
    other,
    total: addMoney(cash, upi, bankTransfer, other),
  }
}

export class MockAdapter implements ApiClient {
  readonly mode = 'mock' as const
  private db: MockDb

  constructor() {
    this.db = loadMockDb()
  }

  private persist(): void {
    saveMockDb(this.db)
  }

  private requireSession(): User {
    const s = this.db.session
    if (!s) throw ApiError.unauthorized()
    return s.user
  }

  private requireAccount(id: string): FinanceAccount {
    const acc = this.db.accounts.find((a) => a.id === id)
    if (!acc) throw ApiError.notFound('Account')
    return acc
  }

  private requireCustomer(id: string): Customer {
    const c = this.db.customers.find((x) => x.id === id)
    if (!c) throw ApiError.notFound('Customer')
    return c
  }

  private accountSummary(acc: FinanceAccount): AccountSummary {
    const customer = this.db.customers.find((c) => c.id === acc.customerId)
    const outstanding = computeOutstanding(this.db, acc.id)
    const txns = accountTransactions(this.db, acc.id)
    const receipts = txns.filter((t) => t.type === 'receipt')
    const lastPayment = receipts.length ? receipts[receipts.length - 1]!.date : null
    const openSchedules = this.db.schedules.filter(
      (s) => s.accountId === acc.id && s.status !== 'paid',
    )
    const nextDue = openSchedules.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0]
    return {
      ...acc,
      customerName: customer?.name ?? 'Unknown',
      customerPhone: customer?.phone ?? '',
      outstanding,
      disbursedTotal: acc.disbursedAmount,
      receivedTotal: sumMoney(receipts.map((t) => t.amount)),
      lastPaymentDate: lastPayment,
      nextDueDate: nextDue?.dueDate ?? null,
      overdueDays: nextDue?.overdueDays ?? 0,
    }
  }

  private customerSummary(c: Customer): CustomerSummary {
    const accounts = this.db.accounts
      .filter((a) => a.customerId === c.id)
      .map((a) => this.accountSummary(a))
    const activeAccounts = accounts.filter((a) => a.status === 'active' || a.status === 'overdue')
    const totals = accounts.reduce(
      (acc, a) => ({
        principal: addMoney(acc.principal, a.outstanding.principal),
        interest: addMoney(acc.interest, a.outstanding.interest),
        other: addMoney(acc.other, a.outstanding.other),
        total: addMoney(acc.total, a.outstanding.total),
      }),
      { principal: '0', interest: '0', other: '0', total: '0' },
    )
    return {
      ...c,
      accounts,
      totalOutstanding: totals,
      activeAccountCount: activeAccounts.length,
    }
  }

  /* ---------------- Auth ---------------- */

  async login(input: LoginInput): Promise<Session> {
    await delay()
    const user = this.db.users.find((u) => u.email?.toLowerCase() === input.email.trim().toLowerCase())
    if (!user || this.db.passwords[user.id] !== input.password) {
      throw new ApiError('unauthorized', 'Invalid email or password.', { status: 401 })
    }
    const session: Session = {
      user,
      token: `mock_${user.id}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
    }
    this.db.session = session
    this.persist()
    return session
  }

  async logout(): Promise<void> {
    this.db.session = null
    this.persist()
  }

  async getSession(): Promise<Session | null> {
    return this.db.session
  }

  async listUsers(): Promise<User[]> {
    this.requireSession()
    return [...this.db.users]
  }

  async revokeOtherSessions(): Promise<void> {
    this.requireSession()
    /* Mock: single shared device; nothing to revoke beyond clearing session cache. */
  }

  resetDemoData(): void {
    this.db = resetMockDb()
  }

  /* ---------------- Customers ---------------- */

  async listCustomers(q: CustomerQuery): Promise<Paged<CustomerSummary>> {
    this.requireSession()
    const term = (q.search ?? '').trim().toLowerCase()
    let items = this.db.customers.map((c) => this.customerSummary(c))
    if (q.status) items = items.filter((c) => c.status === q.status)
    if (term) {
      items = items.filter(
        (c) => c.name.toLowerCase().includes(term) || c.phone.replace(/\s/g, '').includes(term.replace(/\s/g, '')),
      )
    }
    items.sort((a, b) => a.name.localeCompare(b.name))
    return paged(items, q.page ?? 1, q.pageSize ?? 100)
  }

  async getCustomer(id: string): Promise<CustomerDetail> {
    this.requireSession()
    const c = this.requireCustomer(id)
    const summary = this.customerSummary(c)
    const transactions = this.db.transactions
      .filter((t) => t.customerId === id)
      .sort((a, b) => (a.datetime < b.datetime ? 1 : -1))
    const collaterals = this.db.collaterals.filter((x) => x.customerId === id)
    const scheduleItems = this.db.schedules.filter((s) => s.customerId === id)
    return { ...summary, transactions, collaterals, scheduleItems }
  }

  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    this.requireSession()
    const dup = this.db.customers.find(
      (c) => c.phone.replace(/\s/g, '') === input.phone.replace(/\s/g, ''),
    )
    if (dup) {
      throw ApiError.validation('A customer with this phone number already exists.', {
        phone: `Possible duplicate: ${dup.name}`,
      })
    }
    let photo: Customer['photo']
    if (input.photoFile) {
      const { blob, fileName } = await compressImage(input.photoFile)
      const id = newId('pho')
      this.db.photos[id] = await blobToDataUrl(blob)
      photo = {
        id,
        url: this.db.photos[id]!,
        fileName,
        contentType: blob.type,
        sizeBytes: blob.size,
        uploadedAt: nowISO(),
        pendingSync: false,
      }
    }
    const customer: Customer = {
      id: input.id,
      name: input.name.trim(),
      phone: input.phone.trim(),
      address: input.address?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      photo,
      status: 'active',
      createdAt: nowISO(),
      updatedAt: nowISO(),
      syncState: 'synced',
    }
    this.db.customers.push(customer)
    addAudit(this.db, this.requireSession(), 'customer.create', 'customer', customer.id)
    this.persist()
    return customer
  }

  async updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
    this.requireSession()
    const c = this.requireCustomer(id)
    if (input.name !== undefined) c.name = input.name.trim()
    if (input.phone !== undefined) c.phone = input.phone.trim()
    if (input.address !== undefined) c.address = input.address.trim() || undefined
    if (input.notes !== undefined) c.notes = input.notes.trim() || undefined
    if (input.status !== undefined) c.status = input.status
    if (input.photoFile) {
      const { blob, fileName } = await compressImage(input.photoFile)
      const pid = newId('pho')
      this.db.photos[pid] = await blobToDataUrl(blob)
      c.photo = {
        id: pid,
        url: this.db.photos[pid]!,
        fileName,
        contentType: blob.type,
        sizeBytes: blob.size,
        uploadedAt: nowISO(),
        pendingSync: false,
      }
    }
    if (input.removePhoto) delete c.photo
    c.updatedAt = nowISO()
    addAudit(this.db, this.requireSession(), 'customer.update', 'customer', id)
    this.persist()
    return c
  }

  async findDuplicateCustomers(name: string, phone: string): Promise<CustomerSummary[]> {
    const phoneDigits = phone.replace(/\D/g, '')
    const nameLc = name.trim().toLowerCase()
    return this.db.customers
      .filter(
        (c) =>
          (phoneDigits.length >= 6 && c.phone.replace(/\D/g, '').includes(phoneDigits)) ||
          (nameLc.length >= 3 && c.name.toLowerCase().includes(nameLc)),
      )
      .map((c) => this.customerSummary(c))
  }

  /* ---------------- Accounts ---------------- */

  async listAccounts(q: {
    page?: number
    pageSize?: number
    customerId?: string
    status?: string
    financeType?: FinanceAccount['financeType']
  }): Promise<Paged<AccountSummary>> {
    this.requireSession()
    let items = this.db.accounts.map((a) => this.accountSummary(a))
    if (q.customerId) items = items.filter((a) => a.customerId === q.customerId)
    if (q.status) items = items.filter((a) => a.status === q.status)
    if (q.financeType) items = items.filter((a) => a.financeType === q.financeType)
    items.sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
    return paged(items, q.page ?? 1, q.pageSize ?? 100)
  }

  async getAccount(id: string): Promise<AccountSummary> {
    this.requireSession()
    return this.accountSummary(this.requireAccount(id))
  }

  async createAccount(input: CreateAccountInput): Promise<FinanceAccount> {
    this.requireSession()
    this.requireCustomer(input.customerId)
    const existing = this.db.accounts.find(
      (a) => a.customerId === input.customerId && a.financeType === input.financeType && a.status !== 'cancelled',
    )
    if (existing) {
      throw ApiError.validation(
        'This customer already has an account of this finance type (BR-003). Duplicate creation is blocked unless the business owner changes the rule.',
        { financeType: 'Duplicate finance type for this customer' },
      )
    }
    if (input.collateralBacked && input.financeType !== 'free_hand') {
      if (!input.collateral || input.collateral.photoFiles.length === 0) {
        throw ApiError.validation('A collateral photo is required for this account type (COL-001).', {
          'collateral.photoFiles': 'At least one photo of the item/document is required',
        })
      }
    }
    const now = nowISO()
    const terms: AgreementVersion = {
      id: newId('agr'),
      accountId: input.id,
      versionNo: 1,
      effectiveFrom: input.startDate,
      effectiveTo: null,
      principalAmount: input.disbursedAmount,
      interestMethod: input.interestMethod,
      rateValue: input.rateValue,
      rateUnit: input.rateUnit,
      repaymentFrequency: input.repaymentFrequency,
      agreementTerms: input.agreementTerms,
      authorizingUserId: this.requireSession().id,
      createdAt: now,
    }
    const account: FinanceAccount = {
      id: input.id,
      customerId: input.customerId,
      financeType: input.financeType,
      collateralBacked: input.collateralBacked,
      disbursedAmount: input.disbursedAmount,
      startDate: input.startDate,
      status: 'active',
      currentTerms: terms,
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      syncState: 'synced',
    }
    this.db.agreements.push(terms)
    this.db.accounts.push(account)
    if (input.collateral && input.collateral.photoFiles.length > 0) {
      const photos = []
      for (const f of input.collateral.photoFiles) {
        const { blob, fileName } = await compressImage(f)
        const pid = newId('pho')
        this.db.photos[pid] = await blobToDataUrl(blob)
        photos.push({
          id: pid,
          url: this.db.photos[pid]!,
          fileName,
          contentType: blob.type,
          sizeBytes: blob.size,
          uploadedAt: now,
          pendingSync: false,
        })
      }
      const col: Collateral = {
        id: input.collateral.id,
        accountId: account.id,
        customerId: account.customerId,
        description: input.collateral.description,
        reference: input.collateral.reference || undefined,
        photos,
        status: 'held',
        recordedAt: input.startDate,
        createdAt: now,
        syncState: 'synced',
      }
      this.db.collaterals.push(col)
    }
    addAudit(this.db, this.requireSession(), 'account.create', 'account', account.id)
    this.persist()
    return account
  }

  async updateTerms(accountId: string, input: UpdateTermsInput): Promise<AgreementVersion> {
    this.requireSession()
    const acc = this.requireAccount(accountId)
    acc.currentTerms.effectiveTo = input.effectiveFrom
    const next: AgreementVersion = {
      id: newId('agr'),
      accountId,
      versionNo: acc.currentTerms.versionNo + 1,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: null,
      principalAmount: acc.currentTerms.principalAmount,
      interestMethod: input.interestMethod,
      rateValue: input.rateValue,
      rateUnit: input.rateUnit,
      repaymentFrequency: input.repaymentFrequency,
      agreementTerms: input.agreementTerms,
      changedReason: input.changedReason,
      authorizingUserId: this.requireSession().id,
      createdAt: nowISO(),
    }
    this.db.agreements.push(next)
    acc.currentTerms = next
    acc.updatedAt = nowISO()
    addAudit(this.db, this.requireSession(), 'terms.update', 'account', accountId, input.changedReason)
    this.persist()
    return next
  }

  async listTermsHistory(accountId: string): Promise<AgreementVersion[]> {
    this.requireSession()
    return this.db.agreements
      .filter((a) => a.accountId === accountId)
      .sort((a, b) => b.versionNo - a.versionNo)
  }

  async getSettlement(accountId: string): Promise<SettlementPreview> {
    this.requireSession()
    const acc = this.requireAccount(accountId)
    const outstanding = computeOutstanding(this.db, accountId)
    const txns = accountTransactions(this.db, accountId)
    const canClose = d(outstanding.total).lte(0)
    const blockers: string[] = []
    if (!canClose) {
      blockers.push(
        `Outstanding dues of ₹${outstanding.total} remain. Account cannot be closed (ACC-007, BR-006).`,
      )
    }
    const held = this.db.collaterals.filter((c) => c.accountId === accountId && c.status === 'held')
    if (held.length > 0) {
      blockers.push(`${held.length} collateral item(s) still held — confirm release after settlement (COL-005).`)
    }
    return {
      accountId,
      generatedAt: nowISO(),
      outstanding,
      disbursedTotal: acc.disbursedAmount,
      receivedTotal: sumMoney(txns.filter((t) => t.type === 'receipt').map((t) => t.amount)),
      canClose,
      blockers,
      terms: acc.currentTerms,
    }
  }

  async closeAccount(accountId: string, note?: string): Promise<FinanceAccount> {
    this.requireSession()
    const acc = this.requireAccount(accountId)
    const outstanding = computeOutstanding(this.db, accountId)
    if (d(outstanding.total).gt(0)) {
      throw ApiError.validation(
        `Cannot close: outstanding dues of ₹${outstanding.total} remain (ACC-007, BR-006).`,
      )
    }
    acc.status = 'closed'
    acc.updatedAt = nowISO()
    addAudit(this.db, this.requireSession(), 'account.close', 'account', accountId, note)
    this.persist()
    return acc
  }

  /* ---------------- Collateral ---------------- */

  async listCollateral(q: {
    page?: number
    pageSize?: number
    accountId?: string
    customerId?: string
    status?: string
  }): Promise<Paged<CollateralRegisterEntry>> {
    this.requireSession()
    let items = this.db.collaterals.map<CollateralRegisterEntry>((collateral) => {
      const acc = this.db.accounts.find((a) => a.id === collateral.accountId)
      const customer = this.db.customers.find((c) => c.id === collateral.customerId)
      return {
        collateral,
        customerName: customer?.name ?? 'Unknown',
        accountLabel: acc ? `${acc.financeType} · ${acc.id}` : collateral.accountId,
        financeType: acc?.financeType ?? 'other',
      }
    })
    if (q.accountId) items = items.filter((x) => x.collateral.accountId === q.accountId)
    if (q.customerId) items = items.filter((x) => x.collateral.customerId === q.customerId)
    if (q.status) items = items.filter((x) => x.collateral.status === q.status)
    return paged(items, q.page ?? 1, q.pageSize ?? 100)
  }

  async addCollateralPhotos(collateralId: string, files: File[]): Promise<Collateral> {
    this.requireSession()
    const col = this.db.collaterals.find((c) => c.id === collateralId)
    if (!col) throw ApiError.notFound('Collateral')
    for (const f of files) {
      const { blob, fileName } = await compressImage(f)
      const pid = newId('pho')
      this.db.photos[pid] = await blobToDataUrl(blob)
      col.photos.push({
        id: pid,
        url: this.db.photos[pid]!,
        fileName,
        contentType: blob.type,
        sizeBytes: blob.size,
        uploadedAt: nowISO(),
        pendingSync: false,
      })
    }
    this.persist()
    return col
  }

  async releaseCollateral(collateralId: string, note: string): Promise<Collateral> {
    this.requireSession()
    const col = this.db.collaterals.find((c) => c.id === collateralId)
    if (!col) throw ApiError.notFound('Collateral')
    col.status = 'released'
    col.releasedAt = todayISO()
    col.releaseNote = note
    addAudit(this.db, this.requireSession(), 'collateral.release', 'collateral', collateralId, note)
    this.persist()
    return col
  }

  /* ---------------- Transactions ---------------- */

  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    this.requireSession()
    if (this.db.appliedOpIds[input.id]) {
      const existing = this.db.transactions.find((t) => t.idempotencyKey === input.id)
      if (existing) return existing
    }
    const acc = this.requireAccount(input.accountId)
    if (acc.status === 'closed' || acc.status === 'cancelled') {
      throw ApiError.validation('This account is closed. Transactions cannot be posted against it.')
    }
    if (input.type === 'receipt') {
      if (!input.allocation || input.allocation.length === 0) {
        throw ApiError.validation('A receipt must include a manual payment allocation (PAY-005).', {
          allocation: 'Allocate the received amount to principal / interest / other',
        })
      }
      const allocSum = sumMoney(input.allocation.map((l) => l.amount))
      if (d(allocSum).toFixed(2) !== d(input.amount).toFixed(2)) {
        throw ApiError.validation(
          `Allocation total (₹${allocSum}) must equal the received amount (₹${input.amount}).`,
          { allocation: 'Allocation total does not match the payment amount' },
        )
      }
    } else if (input.type === 'disbursement') {
      if (!input.allocation || input.allocation.length === 0) {
        throw ApiError.validation('A disbursement must state its allocation components.', {
          allocation: 'Allocate the disbursed amount (usually all principal)',
        })
      }
    }
    const user = this.requireSession()
    const txn: Transaction = {
      id: input.id,
      idempotencyKey: input.id,
      customerId: input.customerId,
      accountId: input.accountId,
      type: input.type,
      amount: input.amount,
      date: input.date,
      datetime: new Date().toISOString(),
      method: input.method,
      reference: input.reference?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      allocation: input.allocation ?? [],
      actorId: user.id,
      actorName: user.name,
      syncState: 'synced',
      createdAt: nowISO(),
    }
    this.db.transactions.push(txn)
    this.db.appliedOpIds[input.id] = txn.id
    if (input.method === 'cash') {
      this.db.cashMovements.push({
        id: newId('csh'),
        date: input.date,
        kind: input.type === 'disbursement' ? 'cash_out' : 'cash_in',
        amount: input.amount,
        note: input.type === 'disbursement' ? 'Cash disbursed' : 'Cash received',
        linkedTransactionId: txn.id,
        createdAt: txn.createdAt,
      })
    }
    // mark matching due item as handled (naive demo behaviour; backend owns real schedules)
    if (input.type === 'receipt') {
      for (const s of this.db.schedules) {
        if (s.accountId !== input.accountId || s.status === 'paid') continue
        const paid = addMoney(s.paidAmount, input.amount)
        const paidNum = d(paid)
        const expNum = d(s.expectedAmount)
        s.paidAmount = paid.toString()
        s.status = paidNum.gte(expNum) ? 'paid' : paidNum.gt(0) ? 'partially_paid' : s.status
        if (s.status === 'paid') s.overdueDays = 0
        break
      }
    }
    addAudit(
      this.db,
      user,
      `transaction.${input.type}`,
      'transaction',
      txn.id,
      input.notes,
    )
    this.persist()
    return txn
  }

  async listTransactions(q: TransactionQuery): Promise<Paged<Transaction>> {
    this.requireSession()
    let items = [...this.db.transactions]
    if (q.customerId) items = items.filter((t) => t.customerId === q.customerId)
    if (q.accountId) items = items.filter((t) => t.accountId === q.accountId)
    if (q.type) items = items.filter((t) => t.type === q.type)
    if (q.method) items = items.filter((t) => t.method === q.method)
    if (q.range) {
      const range = q.range
      items = items.filter((t) => t.date >= range.from && t.date <= range.to)
    }
    if (q.search) {
      const term = q.search.toLowerCase()
      items = items.filter(
        (t) =>
          t.id.toLowerCase().includes(term) ||
          (t.reference ?? '').toLowerCase().includes(term) ||
          t.amount.includes(term),
      )
    }
    items.sort((a, b) => (a.datetime < b.datetime ? 1 : -1))
    return paged(items, q.page ?? 1, q.pageSize ?? 50)
  }

  async reverseTransaction(id: string, input: ReverseTransactionInput): Promise<Transaction> {
    const user = this.requireSession()
    const original = this.db.transactions.find((t) => t.id === id)
    if (!original) throw ApiError.notFound('Transaction')
    if (original.type === 'reversal') throw ApiError.validation('A reversal cannot be reversed.')
    if (original.reversedById) throw ApiError.validation('This transaction has already been reversed.')
    const reversal: Transaction = {
      id: newId('txn'),
      idempotencyKey: newId('idem'),
      customerId: original.customerId,
      accountId: original.accountId,
      type: 'reversal',
      amount: original.amount,
      date: input.date,
      datetime: new Date().toISOString(),
      method: original.method,
      notes: `Reversal of ${original.id}`,
      allocation: original.allocation.map((l) => ({ ...l })),
      actorId: user.id,
      actorName: user.name,
      syncState: 'synced',
      reversalOfId: original.id,
      reversalReason: input.reason,
      createdAt: nowISO(),
    }
    // sign-flip: reversal allocation is stored as negative so outstanding math cancels out
    reversal.allocation = reversal.allocation.map((l) => ({
      ...l,
      amount: d(l.amount).times(-1).toString(),
    }))
    original.reversedById = reversal.id
    this.db.transactions.push(reversal)
    addAudit(this.db, user, 'transaction.reverse', 'transaction', original.id, input.reason)
    this.persist()
    return reversal
  }

  /* ---------------- Schedules ---------------- */

  async listDueItems(q: {
    date?: ISODate
    includeUpcoming?: boolean
    onlyOverdue?: boolean
  }): Promise<DueItem[]> {
    this.requireSession()
    const today = q.date ?? todayISO()
    let items = this.db.schedules.filter((s) => {
      if (q.onlyOverdue) return s.status === 'overdue' || (s.status !== 'paid' && s.dueDate < today)
      if (q.includeUpcoming) return s.status !== 'paid'
      return s.status !== 'paid' && s.dueDate <= today
    })
    items = items.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    return items.map((s) => {
      const acc = this.db.accounts.find((a) => a.id === s.accountId)
      const cust = this.db.customers.find((c) => c.id === s.customerId)
      const status =
        s.status === 'paid'
          ? 'paid'
          : s.dueDate < today && d(s.paidAmount).gt(0)
            ? 'partially_paid'
            : s.dueDate < today
              ? 'overdue'
              : s.dueDate === today
                ? s.paidAmount !== '0'
                  ? 'partially_paid'
                  : 'due_today'
                : 'upcoming'
      return {
        scheduleItemId: s.id,
        accountId: s.accountId,
        customerId: s.customerId,
        customerName: cust?.name ?? 'Unknown',
        customerPhone: cust?.phone ?? '',
        accountLabel: acc ? `${acc.financeType} · ${acc.id}` : s.accountId,
        financeType: acc?.financeType ?? 'other',
        dueDate: s.dueDate,
        expectedAmount: s.expectedAmount,
        paidAmount: s.paidAmount,
        balanceAmount: subMoney(s.expectedAmount, s.paidAmount),
        status,
        overdueDays: s.dueDate < today && status !== 'paid'
          ? Math.round((new Date(today).getTime() - new Date(s.dueDate).getTime()) / 86400000)
          : 0,
        lastPaymentDate: s.lastPaymentDate,
        followUpDone: s.followUpDone,
        freshness: 'confirmed',
      }
    })
  }

  async setFollowUp(scheduleItemId: string, input: FollowUpInput): Promise<DueItem> {
    this.requireSession()
    const s = this.db.schedules.find((x) => x.id === scheduleItemId)
    if (!s) throw ApiError.notFound('Schedule item')
    s.followUpDone = input.done
    if (input.note) s.followUpNote = input.note
    this.persist()
    const [item] = await this.listDueItems({ includeUpcoming: true })
    void item
    const all = await this.listDueItems({ includeUpcoming: true })
    const found = all.find((x) => x.scheduleItemId === scheduleItemId)
    if (!found) throw ApiError.notFound('Schedule item')
    return found
  }

  /* ---------------- Cashbook ---------------- */

  async getCashbook(date: ISODate): Promise<CashbookDay> {
    this.requireSession()
    const opening = this.db.openingCash[date]?.amount ?? this.deriveOpening(date)
    const movements = this.db.cashMovements.filter((m) => m.date === date)
    const cashReceived = sumMoney(movements.filter((m) => m.kind === 'cash_in').map((m) => m.amount))
    const cashDisbursed = sumMoney(movements.filter((m) => m.kind === 'cash_out').map((m) => m.amount))
    const otherMovements = sumMoney(
      movements.filter((m) => m.kind === 'adjustment' || m.kind === 'opening').map((m) => m.amount),
    )
    const expected = addMoney(opening, cashReceived, otherMovements)
    const expectedClosing = subMoney(expected, cashDisbursed)
    const count = this.db.cashCounts[date]
    return {
      date,
      openingCash: opening,
      cashReceived,
      cashDisbursed,
      expensesPaidInCash: sumMoney(
        this.db.expenses.filter((e) => e.date === date && e.method === 'cash').map((e) => e.amount),
      ),
      otherMovements,
      expectedClosingCash: expectedClosing,
      actualCountedCash: count?.actual ?? null,
      difference: count ? subMoney(count.actual, expectedClosing) : null,
      countedAt: count?.countedAt,
      note: count?.note,
      movements,
    }
  }

  private deriveOpening(date: ISODate): string {
    const dates = Object.keys(this.db.openingCash).sort()
    const prior = dates.filter((x) => x < date).pop()
    if (prior) {
      // walk forward from prior opening to date
      let cash = this.db.openingCash[prior]!.amount
      let cursor = new Date(prior + 'T00:00:00')
      const end = new Date(date + 'T00:00:00')
      while (cursor < end) {
        cursor.setDate(cursor.getDate() + 1)
        const ds = toISODate(cursor)
        const moves = this.db.cashMovements.filter((m) => m.date === ds)
        const inn = sumMoney(moves.filter((m) => m.kind === 'cash_in').map((m) => m.amount))
        const out = sumMoney(moves.filter((m) => m.kind === 'cash_out' || m.kind === 'adjustment').map((m) => m.amount))
        cash = subMoney(addMoney(cash, inn), out)
      }
      return cash
    }
    return sumMoney([]) // zero when never configured
  }

  async setOpeningCash(input: SetOpeningCashInput): Promise<CashbookDay> {
    this.requireSession()
    this.db.openingCash[input.date] = { amount: input.amount, note: input.note }
    addAudit(this.db, this.requireSession(), 'cashbook.opening', 'cashbook', input.date, input.note)
    this.persist()
    return this.getCashbook(input.date)
  }

  async recordCashCount(date: ISODate, input: RecordCashCountInput): Promise<CashbookDay> {
    this.requireSession()
    this.db.cashCounts[date] = {
      actual: input.actualCountedCash,
      note: input.note,
      countedAt: nowISO(),
    }
    addAudit(this.db, this.requireSession(), 'cashbook.count', 'cashbook', date, input.note)
    this.persist()
    return this.getCashbook(date)
  }

  async listExpenses(q: ExpenseQuery): Promise<Paged<Expense>> {
    this.requireSession()
    let items = [...this.db.expenses]
    if (q.range) items = items.filter((e) => e.date >= q.range!.from && e.date <= q.range!.to)
    if (q.category) items = items.filter((e) => e.category === q.category)
    if (q.method) items = items.filter((e) => e.method === q.method)
    items.sort((a, b) => (a.date < b.date ? 1 : -1))
    return paged(items, q.page ?? 1, q.pageSize ?? 50)
  }

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    const user = this.requireSession()
    if (this.db.appliedOpIds[input.id]) {
      const existing = this.db.expenses.find((e) => e.idempotencyKey === input.id)
      if (existing) return existing
    }
    let attachment: Expense['attachment']
    if (input.attachmentFile) {
      const { blob, fileName } = await compressImage(input.attachmentFile)
      const pid = newId('pho')
      this.db.photos[pid] = await blobToDataUrl(blob)
      attachment = {
        id: pid,
        url: this.db.photos[pid]!,
        fileName,
        contentType: blob.type,
        sizeBytes: blob.size,
        uploadedAt: nowISO(),
        pendingSync: false,
      }
    }
    const expense: Expense = {
      id: input.id,
      idempotencyKey: input.id,
      date: input.date,
      amount: input.amount,
      category: input.category,
      method: input.method,
      notes: input.notes?.trim() || undefined,
      attachment,
      actorId: user.id,
      actorName: user.name,
      syncState: 'synced',
      createdAt: nowISO(),
    }
    this.db.expenses.push(expense)
    this.db.appliedOpIds[input.id] = expense.id
    if (input.method === 'cash') {
      this.db.cashMovements.push({
        id: newId('csh'),
        date: input.date,
        kind: 'cash_out',
        amount: input.amount,
        note: `Expense: ${input.category}`,
        linkedTransactionId: expense.id,
        createdAt: expense.createdAt,
      })
    }
    addAudit(this.db, user, 'expense.create', 'expense', expense.id, input.notes)
    this.persist()
    return expense
  }

  /* ---------------- Reports ---------------- */

  async getDailyReport(range: DateRange): Promise<DailyActivityReport> {
    this.requireSession()
    const txns = this.db.transactions.filter((t) => t.date >= range.from && t.date <= range.to && t.type !== 'reversal')
    const reversed = new Set(
      this.db.transactions.filter((t) => t.type === 'reversal' && t.reversalOfId).map((t) => t.reversalOfId),
    )
    const effective = txns.filter((t) => !reversed.has(t.id))
    const expenses = this.db.expenses.filter((e) => e.date >= range.from && e.date <= range.to)
    const newAccounts = this.db.accounts.filter((a) => a.startDate >= range.from && a.startDate <= range.to).length
    const closedAccounts = this.db.audit.filter(
      (a) => a.action === 'account.close' && a.timestamp.slice(0, 10) >= range.from && a.timestamp.slice(0, 10) <= range.to,
    ).length
    const due = await this.listDueItems({ includeUpcoming: true })
    const cashbook = await this.getCashbook(range.to)
    return {
      range,
      generatedAt: nowISO(),
      disbursements: {
        count: effective.filter((t) => t.type === 'disbursement').length,
        totals: methodTotals(effective, 'disbursement'),
      },
      receipts: {
        count: effective.filter((t) => t.type === 'receipt').length,
        totals: methodTotals(effective, 'receipt'),
      },
      expenses: {
        count: expenses.length,
        totals: {
          cash: sumMoney(expenses.filter((e) => e.method === 'cash').map((e) => e.amount)),
          upi: sumMoney(expenses.filter((e) => e.method === 'upi').map((e) => e.amount)),
          bankTransfer: sumMoney(expenses.filter((e) => e.method === 'bank_transfer').map((e) => e.amount)),
          other: sumMoney(expenses.filter((e) => e.method === 'other').map((e) => e.amount)),
          total: sumMoney(expenses.map((e) => e.amount)),
        },
      },
      newAccounts,
      closedAccounts,
      dueTodayCount: due.filter((x) => x.status === 'due_today').length,
      overdueCount: due.filter((x) => x.status === 'overdue' || x.status === 'partially_paid').length,
      openingCash: cashbook.openingCash,
      expectedClosingCash: cashbook.expectedClosingCash,
      cashReceived: cashbook.cashReceived,
      cashDisbursed: cashbook.cashDisbursed,
      transactions: [...this.db.transactions]
        .filter((t) => t.date >= range.from && t.date <= range.to)
        .sort((a, b) => (a.datetime < b.datetime ? 1 : -1)),
      expenseList: expenses.sort((a, b) => (a.date < b.date ? 1 : -1)),
    }
  }

  async getWeeklyReport(range: DateRange): Promise<WeeklyReport> {
    const daily = await this.getDailyReport(range)
    const due = await this.listDueItems({ includeUpcoming: true })
    const paying = new Map<string, { customerId: string; customerName: string; amount: string }>()
    for (const t of daily.transactions) {
      if (t.type !== 'receipt') continue
      const cust = this.db.customers.find((c) => c.id === t.customerId)
      const prev = paying.get(t.customerId)
      paying.set(t.customerId, {
        customerId: t.customerId,
        customerName: cust?.name ?? 'Unknown',
        amount: addMoney(prev?.amount ?? '0', t.amount),
      })
    }
    const { transactions: _t, expenseList: _e, ...rest } = daily
    return {
      ...rest,
      customersWhoPaid: [...paying.values()].sort((a, b) => d(b.amount).comparedTo(d(a.amount))),
      pendingDuesCount: due.filter((x) => x.status === 'due_today' || x.status === 'upcoming').length,
      overdueDuesCount: due.filter((x) => x.status === 'overdue' || x.status === 'partially_paid').length,
      pendingDuesAmount: sumMoney(
        due.filter((x) => x.status === 'due_today' || x.status === 'upcoming').map((x) => x.balanceAmount),
      ),
      overdueDuesAmount: sumMoney(
        due.filter((x) => x.status === 'overdue' || x.status === 'partially_paid').map((x) => x.balanceAmount),
      ),
    }
  }

  private async monthStats(range: DateRange, label: string): Promise<MonthStats> {
    const daily = await this.getDailyReport(range)
    const outstanding = await this.getOutstandingReport({})
    return {
      label,
      range,
      disbursed: daily.disbursements.totals.total,
      collected: daily.receipts.totals.total,
      expenses: daily.expenses.totals.total,
      accountsOpened: daily.newAccounts,
      accountsClosed: daily.closedAccounts,
      outstandingTotal: outstanding.total.total,
    }
  }

  async getMonthlyComparison(): Promise<MonthlyComparison> {
    const now = new Date()
    const thisFrom = toISODate(new Date(now.getFullYear(), now.getMonth(), 1))
    const thisTo = toISODate(now)
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastFrom = toISODate(prev)
    const lastTo = toISODate(new Date(now.getFullYear(), now.getMonth(), 0))
    const fmt = (dt: Date) => dt.toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    return {
      thisMonth: await this.monthStats({ from: thisFrom, to: thisTo }, fmt(now)),
      lastMonth: await this.monthStats({ from: lastFrom, to: lastTo }, fmt(prev)),
    }
  }

  async getOutstandingReport(q: { financeType?: FinanceAccount['financeType']; status?: string }): Promise<OutstandingReport> {
    this.requireSession()
    let accounts = this.db.accounts.map((a) => this.accountSummary(a))
    if (q.financeType) accounts = accounts.filter((a) => a.financeType === q.financeType)
    if (q.status) accounts = accounts.filter((a) => a.status === q.status)
    const total = accounts.reduce(
      (acc, a) => ({
        principal: addMoney(acc.principal, a.outstanding.principal),
        interest: addMoney(acc.interest, a.outstanding.interest),
        other: addMoney(acc.other, a.outstanding.other),
        total: addMoney(acc.total, a.outstanding.total),
      }),
      { principal: '0', interest: '0', other: '0', total: '0' },
    )
    const typeMap = new Map<string, { financeType: FinanceAccount['financeType']; outstanding: { principal: string; interest: string; other: string; total: string }; accountCount: number }>()
    const statusMap = new Map<string, { status: AccountSummary['status']; outstanding: { principal: string; interest: string; other: string; total: string }; accountCount: number }>()
    for (const a of accounts) {
      const t = typeMap.get(a.financeType) ?? {
        financeType: a.financeType,
        outstanding: { principal: '0', interest: '0', other: '0', total: '0' },
        accountCount: 0,
      }
      t.outstanding = {
        principal: addMoney(t.outstanding.principal, a.outstanding.principal),
        interest: addMoney(t.outstanding.interest, a.outstanding.interest),
        other: addMoney(t.outstanding.other, a.outstanding.other),
        total: addMoney(t.outstanding.total, a.outstanding.total),
      }
      t.accountCount++
      typeMap.set(a.financeType, t)
      const s = statusMap.get(a.status) ?? {
        status: a.status,
        outstanding: { principal: '0', interest: '0', other: '0', total: '0' },
        accountCount: 0,
      }
      s.outstanding = {
        principal: addMoney(s.outstanding.principal, a.outstanding.principal),
        interest: addMoney(s.outstanding.interest, a.outstanding.interest),
        other: addMoney(s.outstanding.other, a.outstanding.other),
        total: addMoney(s.outstanding.total, a.outstanding.total),
      }
      s.accountCount++
      statusMap.set(a.status, s)
    }
    return {
      generatedAt: nowISO(),
      total,
      byFinanceType: [...typeMap.values()],
      byStatus: [...statusMap.values()],
      accounts: accounts.sort((a, b) => d(b.outstanding.total).comparedTo(d(a.outstanding.total))),
    }
  }

  async getCustomerStatement(customerId: string, range?: DateRange): Promise<CustomerDetail> {
    const detail = await this.getCustomer(customerId)
    if (!range) return detail
    return {
      ...detail,
      transactions: detail.transactions.filter((t) => t.date >= range!.from && t.date <= range!.to),
    }
  }

  /* ---------------- Receipts ---------------- */

  async getReceipt(transactionId: string): Promise<Receipt> {
    this.requireSession()
    const t = this.db.transactions.find((x) => x.id === transactionId || x.idempotencyKey === transactionId)
    if (!t) throw ApiError.notFound('Transaction')
    const cust = this.requireCustomer(t.customerId)
    const acc = this.requireAccount(t.accountId)
    const seq = ++this.db.receiptSeq
    this.persist()
    return {
      receiptNo: `RCP-${t.date.replace(/-/g, '')}-${seq}`,
      transactionId: t.id,
      generatedAt: nowISO(),
      businessName: 'Finance Operations (DEMO — set business name in Settings, OD-010)',
      businessContact: undefined,
      customerName: cust.name,
      customerPhone: cust.phone,
      accountLabel: `${acc.financeType} · ${acc.id}`,
      financeType: acc.financeType,
      type: t.type,
      amount: t.amount,
      method: t.method,
      reference: t.reference,
      date: t.date,
      allocation: t.allocation,
      remainingOutstanding: computeOutstanding(this.db, acc.id),
      actorName: t.actorName,
    }
  }

  /* ---------------- Sync ---------------- */

  async syncOperations(
    ops: { opId: string; kind: string; payload: unknown; createdAt: string }[],
  ): Promise<SyncAck[]> {
    const acks: SyncAck[] = []
    for (const op of ops) {
      if (this.db.appliedOpIds[op.opId]) {
        acks.push({ opId: op.opId, status: 'accepted', serverId: this.db.appliedOpIds[op.opId] })
        continue
      }
      try {
        const result = await this.applyOp(op.kind, op.payload, op.opId)
        this.db.appliedOpIds[op.opId] = result
        acks.push({ opId: op.opId, status: 'accepted', serverId: result })
      } catch (err) {
        if (err instanceof ApiError && err.kind === 'conflict') {
          acks.push({
            opId: op.opId,
            status: 'conflict',
            message: err.message,
            serverEntity: this.db.accounts.find(
              (a) => (op.payload as { accountId?: string })?.accountId === a.id,
            ),
          })
        } else {
          acks.push({
            opId: op.opId,
            status: 'rejected',
            message: err instanceof Error ? err.message : 'Rejected by server',
          })
        }
      }
    }
    this.persist()
    return acks
  }

  private async applyOp(kind: string, payload: unknown, _opId: string): Promise<string> {
    switch (kind) {
      case 'create_transaction': {
        const t = await this.createTransaction(payload as CreateTransactionInput)
        return t.id
      }
      case 'create_expense': {
        const e = await this.createExpense(payload as CreateExpenseInput)
        return e.id
      }
      case 'create_customer': {
        const c = await this.createCustomer(payload as CreateCustomerInput)
        return c.id
      }
      case 'record_cash_count': {
        const p = payload as { date: string } & RecordCashCountInput
        const day = await this.recordCashCount(p.date, p)
        return day.date
      }
      default:
        throw new Error(`Mock sync: unsupported op kind "${kind}"`)
    }
  }

  /* ---------------- Backup / audit / photos ---------------- */

  async getBackupStatus(): Promise<BackupStatus> {
    this.requireSession()
    return { ...this.db.backup }
  }

  async requestBackup(): Promise<BackupStatus> {
    this.requireSession()
    this.db.backup.lastBackupAt = nowISO()
    this.db.backup.lastBackupResult = 'success'
    this.persist()
    return { ...this.db.backup }
  }

  async listAuditEvents(q: AuditQuery): Promise<Paged<AuditEvent>> {
    this.requireSession()
    let items = [...this.db.audit]
    if (q.actorId) items = items.filter((a) => a.actorId === q.actorId)
    if (q.entityType) items = items.filter((a) => a.entityType === q.entityType)
    if (q.range) {
      items = items.filter((a) => {
        const day = a.timestamp.slice(0, 10)
        return day >= q.range!.from && day <= q.range!.to
      })
    }
    return paged(items, q.page ?? 1, q.pageSize ?? 100)
  }

  async getPhotoBlob(photoId: string): Promise<Blob> {
    const url = this.db.photos[photoId]
    if (!url) throw ApiError.notFound('Photo')
    const res = await fetch(url)
    return res.blob()
  }

  async getPhotoUrl(photoId: string): Promise<string | null> {
    return this.db.photos[photoId] ?? null
  }
}
