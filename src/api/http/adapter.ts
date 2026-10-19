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
  FinanceAccount,
  MonthlyComparison,
  OutstandingReport,
  Paged,
  Receipt,
  Session,
  SyncAck,
  Transaction,
  User,
  WeeklyReport,
  ISODate,
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

/**
 * HTTP adapter for the shared cloud backend (SRS §7.1).
 *
 * The backend does not exist yet. This adapter implements the endpoint
 * contract documented in docs/API.md. Configure with:
 *   VITE_API_MODE=http
 *   VITE_API_BASE_URL=https://your-backend.example.com/api
 *
 * Every response is validated lightly; failures normalise to ApiError so the
 * UI can show actionable messages.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api'

export class HttpAdapter implements ApiClient {
  readonly mode = 'http' as const

  private token: string | null = localStorage.getItem('fms.token')

  private async request<T>(
    path: string,
    init: RequestInit & { json?: unknown } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
    }
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    let body = init.body
    if (init.json !== undefined) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(init.json)
    }
    let res: Response
    try {
      res = await fetch(`${BASE}${path}`, { ...init, headers, body })
    } catch {
      throw ApiError.network()
    }
    if (res.status === 401) {
      this.token = null
      localStorage.removeItem('fms.token')
      throw ApiError.unauthorized()
    }
    if (res.status === 204) return undefined as T
    const text = await res.text()
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }
    if (!res.ok) {
      const msg =
        typeof data === 'object' && data && 'message' in data
          ? String((data as { message: unknown }).message)
          : `Request failed (${res.status})`
      const fieldErrors =
        typeof data === 'object' && data && 'fieldErrors' in data
          ? (data as { fieldErrors?: Record<string, string> }).fieldErrors
          : undefined
      if (res.status === 403) throw ApiError.forbidden(msg)
      if (res.status === 404) throw new ApiError('not_found', msg, { status: 404 })
      if (res.status === 409) throw ApiError.conflict(msg)
      if (res.status === 400 || res.status === 422)
        throw ApiError.validation(msg, fieldErrors)
      throw new ApiError('server', msg, { status: res.status })
    }
    return data as T
  }

  private json<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    return this.request<T>(path, init)
  }

  private async sendFiles(paths: { url: string; files: File[] }): Promise<void> {
    const fd = new FormData()
    for (const f of paths.files) fd.append('files', f)
    await this.request(paths.url, { method: 'POST', body: fd })
  }

  /* ---- auth ---- */

  async login(input: LoginInput): Promise<Session> {
    const session = await this.json<Session>('/auth/login', { method: 'POST', json: input })
    this.token = session.token
    localStorage.setItem('fms.token', session.token)
    return session
  }

  async logout(): Promise<void> {
    try {
      await this.json('/auth/logout', { method: 'POST' })
    } finally {
      this.token = null
      localStorage.removeItem('fms.token')
    }
  }

  async getSession(): Promise<Session | null> {
    if (!this.token) return null
    try {
      return await this.json<Session>('/auth/session')
    } catch {
      return null
    }
  }

  async listUsers(): Promise<User[]> {
    return this.json<User[]>('/users')
  }

  async revokeOtherSessions(): Promise<void> {
    await this.json('/users/revoke-other-sessions', { method: 'POST' })
  }

  /* ---- customers ---- */

  listCustomers(q: CustomerQuery): Promise<Paged<CustomerSummary>> {
    return this.json<Paged<CustomerSummary>>(`/customers${qs(q as Record<string, unknown>)}`)
  }

  getCustomer(id: string): Promise<CustomerDetail> {
    return this.json<CustomerDetail>(`/customers/${encodeURIComponent(id)}`)
  }

  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    if (input.photoFile) {
      // multipart flow: create without photo, then upload
      const { photoFile, ...rest } = input
      const customer = await this.json<Customer>('/customers', { method: 'POST', json: rest })
      await this.sendFiles({ url: `/customers/${customer.id}/photo`, files: [photoFile] })
      return this.json<Customer>(`/customers/${customer.id}`)
    }
    return this.json<Customer>('/customers', { method: 'POST', json: input })
  }

  async updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
    if (input.photoFile || input.removePhoto) {
      const { photoFile, removePhoto, ...rest } = input
      await this.json(`/customers/${encodeURIComponent(id)}`, { method: 'PATCH', json: rest })
      if (photoFile) {
        await this.sendFiles({ url: `/customers/${id}/photo`, files: [photoFile] })
      } else if (removePhoto) {
        await this.json(`/customers/${id}/photo`, { method: 'DELETE' })
      }
      return this.json<Customer>(`/customers/${id}`)
    }
    return this.json<Customer>(`/customers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      json: input,
    })
  }

  findDuplicateCustomers(name: string, phone: string): Promise<CustomerSummary[]> {
    return this.json<CustomerSummary[]>(
      `/customers/duplicates?name=${encodeURIComponent(name)}&phone=${encodeURIComponent(phone)}`,
    )
  }

  /* ---- accounts ---- */

  listAccounts(q: {
    page?: number
    pageSize?: number
    customerId?: string
    status?: string
    financeType?: string
  }): Promise<Paged<AccountSummary>> {
    return this.json<Paged<AccountSummary>>(`/accounts${qs(q)}`)
  }

  getAccount(id: string): Promise<AccountSummary> {
    return this.json<AccountSummary>(`/accounts/${encodeURIComponent(id)}`)
  }

  async createAccount(input: CreateAccountInput): Promise<FinanceAccount> {
    const { collateral, ...rest } = input
    const account = await this.json<FinanceAccount>('/accounts', { method: 'POST', json: rest })
    if (collateral && collateral.photoFiles.length > 0) {
      await this.json(`/accounts/${account.id}/collateral`, {
        method: 'POST',
        json: { id: collateral.id, description: collateral.description, reference: collateral.reference },
      })
      await this.sendFiles({
        url: `/accounts/${account.id}/collateral/photos`,
        files: collateral.photoFiles,
      })
    }
    return this.json<FinanceAccount>(`/accounts/${account.id}`)
  }

  updateTerms(accountId: string, input: UpdateTermsInput): Promise<AgreementVersion> {
    return this.json<AgreementVersion>(`/accounts/${encodeURIComponent(accountId)}/terms`, {
      method: 'POST',
      json: input,
    })
  }

  listTermsHistory(accountId: string): Promise<AgreementVersion[]> {
    return this.json<AgreementVersion[]>(`/accounts/${encodeURIComponent(accountId)}/terms`)
  }

  getSettlement(accountId: string): Promise<SettlementPreview> {
    return this.json<SettlementPreview>(`/accounts/${encodeURIComponent(accountId)}/settlement`)
  }

  closeAccount(accountId: string, note?: string): Promise<FinanceAccount> {
    return this.json<FinanceAccount>(`/accounts/${encodeURIComponent(accountId)}/close`, {
      method: 'POST',
      json: { note },
    })
  }

  /* ---- collateral ---- */

  listCollateral(q: {
    page?: number
    pageSize?: number
    accountId?: string
    customerId?: string
    status?: string
  }): Promise<Paged<CollateralRegisterEntry>> {
    return this.json<Paged<CollateralRegisterEntry>>(`/collateral${qs(q)}`)
  }

  async addCollateralPhotos(collateralId: string, files: File[]): Promise<Collateral> {
    await this.sendFiles({ url: `/collateral/${encodeURIComponent(collateralId)}/photos`, files })
    return this.json<Collateral>(`/collateral/${encodeURIComponent(collateralId)}`)
  }

  releaseCollateral(collateralId: string, note: string): Promise<Collateral> {
    return this.json<Collateral>(`/collateral/${encodeURIComponent(collateralId)}/release`, {
      method: 'POST',
      json: { note },
    })
  }

  /* ---- transactions ---- */

  createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    return this.json<Transaction>('/transactions', {
      method: 'POST',
      json: input,
      headers: { 'Idempotency-Key': input.id },
    })
  }

  listTransactions(q: TransactionQuery): Promise<Paged<Transaction>> {
    const { range, ...rest } = q
    return this.json<Paged<Transaction>>(
      `/transactions${qs({ ...rest, from: range?.from, to: range?.to })}`,
    )
  }

  reverseTransaction(id: string, input: ReverseTransactionInput): Promise<Transaction> {
    return this.json<Transaction>(`/transactions/${encodeURIComponent(id)}/reverse`, {
      method: 'POST',
      json: input,
    })
  }

  /* ---- schedules ---- */

  listDueItems(q: { date?: ISODate; includeUpcoming?: boolean; onlyOverdue?: boolean }): Promise<DueItem[]> {
    return this.json<DueItem[]>(`/schedules/due${qs(q)}`)
  }

  setFollowUp(scheduleItemId: string, input: FollowUpInput): Promise<DueItem> {
    return this.json<DueItem>(`/schedules/${encodeURIComponent(scheduleItemId)}/follow-up`, {
      method: 'POST',
      json: input,
    })
  }

  /* ---- cashbook / expenses ---- */

  getCashbook(date: ISODate): Promise<CashbookDay> {
    return this.json<CashbookDay>(`/cashbook/${encodeURIComponent(date)}`)
  }

  setOpeningCash(input: SetOpeningCashInput): Promise<CashbookDay> {
    return this.json<CashbookDay>('/cashbook/opening', { method: 'POST', json: input })
  }

  recordCashCount(date: ISODate, input: RecordCashCountInput): Promise<CashbookDay> {
    return this.json<CashbookDay>(`/cashbook/${encodeURIComponent(date)}/count`, {
      method: 'POST',
      json: input,
    })
  }

  listExpenses(q: ExpenseQuery): Promise<Paged<Expense>> {
    const { range, ...rest } = q
    return this.json<Paged<Expense>>(
      `/expenses${qs({ ...rest, from: range?.from, to: range?.to })}`,
    )
  }

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    if (input.attachmentFile) {
      const { attachmentFile, ...rest } = input
      const expense = await this.json<Expense>('/expenses', {
        method: 'POST',
        json: rest,
        headers: { 'Idempotency-Key': input.id },
      })
      await this.sendFiles({ url: `/expenses/${expense.id}/attachment`, files: [attachmentFile] })
      return this.json<Expense>(`/expenses/${expense.id}`)
    }
    return this.json<Expense>('/expenses', {
      method: 'POST',
      json: input,
      headers: { 'Idempotency-Key': input.id },
    })
  }

  /* ---- reports ---- */

  getDailyReport(range: DateRange): Promise<DailyActivityReport> {
    return this.json<DailyActivityReport>(`/reports/daily${qs({ from: range.from, to: range.to })}`)
  }

  getWeeklyReport(range: DateRange): Promise<WeeklyReport> {
    return this.json<WeeklyReport>(`/reports/weekly${qs({ from: range.from, to: range.to })}`)
  }

  getMonthlyComparison(): Promise<MonthlyComparison> {
    return this.json<MonthlyComparison>('/reports/monthly-comparison')
  }

  getOutstandingReport(q: { financeType?: string; status?: string }): Promise<OutstandingReport> {
    return this.json<OutstandingReport>(`/reports/outstanding${qs(q)}`)
  }

  getCustomerStatement(customerId: string, range?: DateRange): Promise<CustomerDetail> {
    return this.json<CustomerDetail>(
      `/reports/customer/${encodeURIComponent(customerId)}${qs({ from: range?.from, to: range?.to })}`,
    )
  }

  /* ---- receipts ---- */

  getReceipt(transactionId: string): Promise<Receipt> {
    return this.json<Receipt>(`/receipts/${encodeURIComponent(transactionId)}`)
  }

  /* ---- sync ---- */

  syncOperations(
    ops: { opId: string; kind: string; payload: unknown; createdAt: string }[],
  ): Promise<SyncAck[]> {
    return this.json<SyncAck[]>('/sync/operations', { method: 'POST', json: { ops } })
  }

  /* ---- backup / audit ---- */

  getBackupStatus(): Promise<BackupStatus> {
    return this.json<BackupStatus>('/backup/status')
  }

  requestBackup(): Promise<BackupStatus> {
    return this.json<BackupStatus>('/backup/request', { method: 'POST' })
  }

  listAuditEvents(q: AuditQuery): Promise<Paged<AuditEvent>> {
    const { range, ...rest } = q
    return this.json<Paged<AuditEvent>>(
      `/audit${qs({ ...rest, from: range?.from, to: range?.to })}`,
    )
  }

  async getPhotoBlob(photoId: string): Promise<Blob> {
    const res = await fetch(`${BASE}/photos/${encodeURIComponent(photoId)}`, {
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : undefined,
    })
    if (!res.ok) throw new ApiError('not_found', 'Photo not found.', { status: res.status })
    return res.blob()
  }
}

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}
