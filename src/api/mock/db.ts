import type {
  AgreementVersion,
  AuditEvent,
  CashMovement,
  Collateral,
  Customer,
  Expense,
  FinanceAccount,
  ScheduleItem,
  Session,
  Transaction,
  User,
  PhotoRef,
  ISODate,
} from '@/domain/types'
import { todayISO, nowISO, toISODate } from '@/lib/dates'
import { addMoney, subMoney, sumMoney, d } from '@/lib/money'
import { newId } from '@/lib/ids'

/**
 * MOCK SERVER DATABASE.
 * -----------------------------------------------------------------------------
 * This is a development stand-in for the shared cloud backend required by the
 * SRS (§7.1). All seeded records are DEMO FIXTURES with obviously fake names —
 * they are NOT real business data. Nothing here is authoritative for
 * production use. See docs/API.md for the real backend contract.
 * -----------------------------------------------------------------------------
 */

export interface MockDb {
  version: number
  users: User[]
  passwords: Record<string, string>
  session: Session | null
  customers: Customer[]
  accounts: FinanceAccount[]
  agreements: AgreementVersion[]
  collaterals: Collateral[]
  transactions: Transaction[]
  schedules: ScheduleItem[]
  expenses: Expense[]
  cashMovements: CashMovement[]
  cashCounts: Record<string, { actual: string; note?: string; countedAt: string }>
  openingCash: Record<string, { amount: string; note?: string }>
  audit: AuditEvent[]
  photos: Record<string, string> // photoId -> dataURL (mock only)
  receiptSeq: number
  appliedOpIds: Record<string, string> // opId -> serverId (idempotency)
  backup: {
    lastBackupAt: string | null
    lastBackupResult: 'success' | 'failed' | 'never'
    destination: string | null
    lastRestoreTestAt: string | null
    unresolvedErrors: string[]
  }
}

const STORAGE_KEY = 'fms.mockdb.v1'
const DB_VERSION = 1

export const DEMO_USERS: User[] = [
  {
    id: 'usr_operator_demo',
    name: 'Demo Operator (Father)',
    role: 'operator',
    phone: '+91 90000 00001',
    email: 'operator@demo.local',
  },
  {
    id: 'usr_admin_demo',
    name: 'Demo Administrator (You)',
    role: 'admin',
    phone: '+91 90000 00002',
    email: 'admin@demo.local',
  },
]

export const DEMO_PASSWORD = 'demo1234'

function daysAgo(n: number): ISODate {
  const dt = new Date()
  dt.setDate(dt.getDate() - n)
  return toISODate(dt)
}

function dtDaysAgo(n: number, hour = 10, minute = 0): string {
  const dt = new Date()
  dt.setDate(dt.getDate() - n)
  dt.setHours(hour, minute, 0, 0)
  return dt.toISOString()
}

function mkPhoto(id: string, label: string): PhotoRef {
  return {
    id,
    url: '',
    fileName: `${label}.jpg`,
    contentType: 'image/jpeg',
    sizeBytes: 0,
    uploadedAt: nowISO(),
    pendingSync: false,
  }
}

export function seedMockDb(): MockDb {
  const now = nowISO()
  const agreements: AgreementVersion[] = []
  const accounts: FinanceAccount[] = []
  const transactions: Transaction[] = []
  const schedules: ScheduleItem[] = []
  const collaterals: Collateral[] = []

  const customers: Customer[] = [
    {
      id: 'cus_demo_ramesh',
      name: 'Demo — Ramesh Kumar',
      phone: '+91 98765 00001',
      address: 'Demo Village, Demo District',
      notes: 'DEMO FIXTURE — not a real customer.',
      status: 'active',
      createdAt: dtDaysAgo(90),
      updatedAt: dtDaysAgo(2),
      syncState: 'synced',
      photo: mkPhoto('pho_demo_ramesh', 'customer-ramesh'),
    },
    {
      id: 'cus_demo_sunita',
      name: 'Demo — Sunita Devi',
      phone: '+91 98765 00002',
      address: 'Demo Town, Demo District',
      status: 'active',
      createdAt: dtDaysAgo(60),
      updatedAt: dtDaysAgo(5),
      syncState: 'synced',
    },
    {
      id: 'cus_demo_imran',
      name: 'Demo — Imran Sheikh',
      phone: '+91 98765 00003',
      status: 'active',
      createdAt: dtDaysAgo(30),
      updatedAt: dtDaysAgo(1),
      syncState: 'synced',
    },
    {
      id: 'cus_demo_closed',
      name: 'Demo — Closed Account Customer',
      phone: '+91 98765 00004',
      status: 'inactive',
      createdAt: dtDaysAgo(200),
      updatedAt: dtDaysAgo(40),
      syncState: 'synced',
    },
  ]

  function addAgreement(
    accountId: string,
    versionNo: number,
    effectiveFrom: ISODate,
    principal: string,
    over: Partial<AgreementVersion> = {},
  ): AgreementVersion {
    const a: AgreementVersion = {
      id: newId('agr'),
      accountId,
      versionNo,
      effectiveFrom,
      effectiveTo: null,
      principalAmount: principal,
      interestMethod: 'unspecified',
      rateValue: '0',
      rateUnit: 'per_month',
      repaymentFrequency: 'monthly',
      agreementTerms:
        'DEMO FIXTURE — terms copied from paper register. No interest formula configured (OD-001 TBD).',
      authorizingUserId: 'usr_operator_demo',
      createdAt: now,
      ...over,
    }
    agreements.push(a)
    return a
  }

  function addAccount(
    id: string,
    customerId: string,
    financeType: FinanceAccount['financeType'],
    collateralBacked: boolean,
    disbursed: string,
    startDate: ISODate,
    status: FinanceAccount['status'],
    termsOver: Partial<AgreementVersion> = {},
  ): FinanceAccount {
    const terms = addAgreement(id, 1, startDate, disbursed, termsOver)
    const acc: FinanceAccount = {
      id,
      customerId,
      financeType,
      collateralBacked,
      disbursedAmount: disbursed,
      startDate,
      status,
      currentTerms: terms,
      createdAt: dtDaysAgo(90),
      updatedAt: now,
      syncState: 'synced',
    }
    accounts.push(acc)
    return acc
  }

  function addTxn(
    id: string,
    customerId: string,
    accountId: string,
    type: Transaction['type'],
    amount: string,
    date: ISODate,
    method: Transaction['method'],
    allocation: Transaction['allocation'],
    hour = 11,
    extra: Partial<Transaction> = {},
  ): Transaction {
    const t: Transaction = {
      id,
      idempotencyKey: id,
      customerId,
      accountId,
      type,
      amount,
      date,
      datetime: dtDaysAgo(daysBetween(date), hour, 15),
      method,
      allocation,
      actorId: 'usr_operator_demo',
      actorName: 'Demo Operator (Father)',
      syncState: 'synced',
      createdAt: now,
      ...extra,
    }
    transactions.push(t)
    return t
  }

  function daysBetween(date: ISODate): number {
    const then = new Date(date + 'T00:00:00')
    const nowD = new Date()
    nowD.setHours(0, 0, 0, 0)
    return Math.max(0, Math.round((nowD.getTime() - then.getTime()) / 86400000))
  }

  // --- Accounts -----------------------------------------------------------

  addAccount('acc_gold_ramesh', 'cus_demo_ramesh', 'gold', true, '50000', daysAgo(75), 'active', {
    interestMethod: 'simple',
    rateValue: '3',
    rateUnit: 'per_month',
    repaymentFrequency: 'monthly',
    agreementTerms:
      'DEMO: ₹50,000 against gold ornaments. 3% per month simple interest as written in register. Interest formula pending owner confirmation (OD-001).',
  })
  collaterals.push({
    id: 'col_gold_ramesh',
    accountId: 'acc_gold_ramesh',
    customerId: 'cus_demo_ramesh',
    description: 'Gold necklace set (DEMO description)',
    reference: 'DEMO-REF-001',
    photos: [mkPhoto('pho_gold_ramesh', 'gold-item')],
    status: 'held',
    recordedAt: daysAgo(75),
    createdAt: now,
    syncState: 'synced',
  })

  addAccount('acc_free_ramesh', 'cus_demo_ramesh', 'free_hand', false, '15000', daysAgo(40), 'active', {
    repaymentFrequency: 'weekly',
    agreementTerms: 'DEMO: Free-hand ₹15,000, weekly return as agreed verbally. No interest terms recorded yet (OD-001 TBD).',
  })

  addAccount('acc_papers_sunita', 'cus_demo_sunita', 'papers', true, '80000', daysAgo(55), 'active', {
    interestMethod: 'unspecified',
    rateValue: '0',
    repaymentFrequency: 'monthly',
    agreementTerms: 'DEMO: ₹80,000 against property papers. Rate/method to be confirmed from paper agreement (OD-001/OD-002).',
  })
  collaterals.push({
    id: 'col_papers_sunita',
    accountId: 'acc_papers_sunita',
    customerId: 'cus_demo_sunita',
    description: 'Registry papers set (DEMO)',
    reference: 'DEMO-REF-002',
    photos: [mkPhoto('pho_papers_sunita', 'papers-doc')],
    status: 'held',
    recordedAt: daysAgo(55),
    createdAt: now,
    syncState: 'synced',
  })

  addAccount('acc_property_sunita', 'cus_demo_sunita', 'property', true, '200000', daysAgo(120), 'overdue', {
    interestMethod: 'simple',
    rateValue: '2',
    rateUnit: 'per_month',
    repaymentFrequency: 'monthly',
    agreementTerms: 'DEMO: ₹2,00,000 against property. 2% per month as per register. Overdue behaviour/penalty NOT configured (OD-005).',
  })
  collaterals.push({
    id: 'col_property_sunita',
    accountId: 'acc_property_sunita',
    customerId: 'cus_demo_sunita',
    description: 'Plot papers (DEMO)',
    photos: [mkPhoto('pho_property_sunita', 'property-doc')],
    status: 'held',
    recordedAt: daysAgo(120),
    createdAt: now,
    syncState: 'synced',
  })

  addAccount('acc_other_imran', 'cus_demo_imran', 'other', true, '25000', daysAgo(20), 'active', {
    repaymentFrequency: 'daily',
    agreementTerms: 'DEMO: ₹25,000 other-purpose, daily collection. Daily calendar behaviour TBD (OD-006).',
  })
  collaterals.push({
    id: 'col_other_imran',
    accountId: 'acc_other_imran',
    customerId: 'cus_demo_imran',
    description: 'Equipment kept as security (DEMO)',
    photos: [mkPhoto('pho_other_imran', 'other-item')],
    status: 'held',
    recordedAt: daysAgo(20),
    createdAt: now,
    syncState: 'synced',
  })

  addAccount('acc_closed_demo', 'cus_demo_closed', 'free_hand', false, '10000', daysAgo(180), 'closed', {
    agreementTerms: 'DEMO: closed account history retained (CUS-006).',
  })

  // --- Transactions -------------------------------------------------------

  addTxn('txn_disb_gold_ramesh', 'cus_demo_ramesh', 'acc_gold_ramesh', 'disbursement', '50000', daysAgo(75), 'cash', [
    { component: 'principal', amount: '50000' },
  ], 12)

  addTxn('txn_rec_gold_ramesh_1', 'cus_demo_ramesh', 'acc_gold_ramesh', 'receipt', '5000', daysAgo(45), 'cash', [
    { component: 'interest', amount: '1500' },
    { component: 'principal', amount: '3500' },
  ], 17)

  addTxn('txn_rec_gold_ramesh_2', 'cus_demo_ramesh', 'acc_gold_ramesh', 'receipt', '3000', daysAgo(12), 'upi', [
    { component: 'interest', amount: '1500' },
    { component: 'principal', amount: '1500' },
  ], 18, { reference: 'UPI-DEMO-4451' })

  addTxn('txn_disb_free_ramesh', 'cus_demo_ramesh', 'acc_free_ramesh', 'disbursement', '15000', daysAgo(40), 'cash', [
    { component: 'principal', amount: '15000' },
  ], 11)

  addTxn('txn_rec_free_ramesh_1', 'cus_demo_ramesh', 'acc_free_ramesh', 'receipt', '2000', daysAgo(7), 'cash', [
    { component: 'principal', amount: '2000' },
  ], 16)

  addTxn('txn_disb_papers_sunita', 'cus_demo_sunita', 'acc_papers_sunita', 'disbursement', '80000', daysAgo(55), 'bank_transfer', [
    { component: 'principal', amount: '80000' },
  ], 13, { reference: 'NEFT-DEMO-991' })

  addTxn('txn_rec_papers_sunita_1', 'cus_demo_sunita', 'acc_papers_sunita', 'receipt', '4000', daysAgo(10), 'cash', [
    { component: 'principal', amount: '4000' },
  ], 10)

  addTxn('txn_disb_prop_sunita', 'cus_demo_sunita', 'acc_property_sunita', 'disbursement', '200000', daysAgo(120), 'bank_transfer', [
    { component: 'principal', amount: '200000' },
  ], 12, { reference: 'NEFT-DEMO-112' })

  addTxn('txn_rec_prop_sunita_1', 'cus_demo_sunita', 'acc_property_sunita', 'receipt', '10000', daysAgo(35), 'cash', [
    { component: 'interest', amount: '4000' },
    { component: 'principal', amount: '6000' },
  ], 15)

  addTxn('txn_disb_other_imran', 'cus_demo_imran', 'acc_other_imran', 'disbursement', '25000', daysAgo(20), 'cash', [
    { component: 'principal', amount: '25000' },
  ], 9)

  for (let i = 0; i < 10; i++) {
    addTxn(`txn_rec_other_imran_${i}`, 'cus_demo_imran', 'acc_other_imran', 'receipt', '500', daysAgo(19 - i), 'cash', [
      { component: 'principal', amount: '500' },
    ], 19)
  }

  addTxn('txn_disb_closed_demo', 'cus_demo_closed', 'acc_closed_demo', 'disbursement', '10000', daysAgo(180), 'cash', [
    { component: 'principal', amount: '10000' },
  ], 11)

  addTxn('txn_rec_closed_demo_1', 'cus_demo_closed', 'acc_closed_demo', 'receipt', '8000', daysAgo(100), 'cash', [
    { component: 'principal', amount: '8000' },
  ], 11)

  addTxn('txn_rec_closed_demo_2', 'cus_demo_closed', 'acc_closed_demo', 'receipt', '2000', daysAgo(41), 'cash', [
    { component: 'principal', amount: '2000' },
  ], 11)

  // --- Schedules (DEMO — schedule rules are TBD per OD-006) ---------------

  schedules.push(
    {
      id: 'sch_gold_ramesh_1',
      accountId: 'acc_gold_ramesh',
      customerId: 'cus_demo_ramesh',
      dueDate: daysAgo(2),
      expectedAmount: '3000',
      expectedAllocation: [{ component: 'interest', amount: '1500' }, { component: 'principal', amount: '1500' }],
      paidAmount: '0',
      status: 'overdue',
      overdueDays: 2,
      lastPaymentDate: daysAgo(12),
      followUpDone: false,
      freshness: 'confirmed',
      calculationVersion: 'demo-manual-v1',
    },
    {
      id: 'sch_free_ramesh_1',
      accountId: 'acc_free_ramesh',
      customerId: 'cus_demo_ramesh',
      dueDate: todayISO(),
      expectedAmount: '2000',
      expectedAllocation: [{ component: 'principal', amount: '2000' }],
      paidAmount: '0',
      status: 'due_today',
      overdueDays: 0,
      lastPaymentDate: daysAgo(7),
      followUpDone: false,
      freshness: 'confirmed',
      calculationVersion: 'demo-manual-v1',
    },
    {
      id: 'sch_papers_sunita_1',
      accountId: 'acc_papers_sunita',
      customerId: 'cus_demo_sunita',
      dueDate: daysAgo(3),
      expectedAmount: '4000',
      expectedAllocation: [{ component: 'principal', amount: '4000' }],
      paidAmount: '1000',
      status: 'partially_paid',
      overdueDays: 3,
      lastPaymentDate: daysAgo(10),
      followUpDone: false,
      freshness: 'confirmed',
      calculationVersion: 'demo-manual-v1',
    },
    {
      id: 'sch_other_imran_1',
      accountId: 'acc_other_imran',
      customerId: 'cus_demo_imran',
      dueDate: todayISO(),
      expectedAmount: '500',
      expectedAllocation: [{ component: 'principal', amount: '500' }],
      paidAmount: '500',
      status: 'paid',
      overdueDays: 0,
      lastPaymentDate: todayISO(),
      followUpDone: false,
      freshness: 'confirmed',
      calculationVersion: 'demo-manual-v1',
    },
    {
      id: 'sch_prop_sunita_1',
      accountId: 'acc_property_sunita',
      customerId: 'cus_demo_sunita',
      dueDate: daysAgo(15),
      expectedAmount: '8000',
      expectedAllocation: [{ component: 'interest', amount: '4000' }, { component: 'principal', amount: '4000' }],
      paidAmount: '0',
      status: 'overdue',
      overdueDays: 15,
      lastPaymentDate: daysAgo(35),
      followUpDone: false,
      freshness: 'confirmed',
      calculationVersion: 'demo-manual-v1',
    },
  )

  // --- Expenses -----------------------------------------------------------

  const expenses: Expense[] = [
    {
      id: 'exp_demo_1',
      idempotencyKey: 'exp_demo_1',
      date: daysAgo(9),
      amount: '1200',
      category: 'rent',
      method: 'cash',
      notes: 'DEMO office rent',
      actorId: 'usr_operator_demo',
      actorName: 'Demo Operator (Father)',
      syncState: 'synced',
      createdAt: now,
    },
    {
      id: 'exp_demo_2',
      idempotencyKey: 'exp_demo_2',
      date: daysAgo(4),
      amount: '350',
      category: 'travel',
      method: 'cash',
      notes: 'DEMO travel for collection round',
      actorId: 'usr_operator_demo',
      actorName: 'Demo Operator (Father)',
      syncState: 'synced',
      createdAt: now,
    },
    {
      id: 'exp_demo_3',
      idempotencyKey: 'exp_demo_3',
      date: daysAgo(1),
      amount: '800',
      category: 'supplies',
      method: 'upi',
      notes: 'DEMO register/stationery',
      actorId: 'usr_operator_demo',
      actorName: 'Demo Operator (Father)',
      syncState: 'synced',
      createdAt: now,
    },
  ]

  // --- Cashbook -----------------------------------------------------------

  const openingCash: MockDb['openingCash'] = {
    [daysAgo(6)]: { amount: '20000', note: 'DEMO opening cash' },
  }

  const cashMovements: CashMovement[] = []
  // derive cash movements from cash transactions + expenses for the last 7 days
  for (const t of transactions) {
    if (t.method !== 'cash') continue
    if (daysBetween(t.date) > 6) continue
    cashMovements.push({
      id: newId('csh'),
      date: t.date,
      kind: t.type === 'disbursement' ? 'cash_out' : 'cash_in',
      amount: t.amount,
      note: t.type === 'disbursement' ? 'Cash disbursed' : 'Cash received',
      linkedTransactionId: t.id,
      createdAt: now,
    })
  }
  for (const e of expenses) {
    if (e.method !== 'cash') continue
    if (daysBetween(e.date) > 6) continue
    cashMovements.push({
      id: newId('csh'),
      date: e.date,
      kind: 'cash_out',
      amount: e.amount,
      note: `Expense: ${e.category}`,
      linkedTransactionId: e.id,
      createdAt: now,
    })
  }

  const audit: AuditEvent[] = [
    {
      id: newId('aud'),
      actorId: 'usr_operator_demo',
      actorName: 'Demo Operator (Father)',
      action: 'seed.demo_fixtures',
      entityType: 'system',
      entityId: 'mockdb',
      timestamp: now,
      reason: 'Development demo fixtures loaded — not real business data.',
    },
  ]

  return {
    version: DB_VERSION,
    users: DEMO_USERS,
    passwords: { usr_operator_demo: DEMO_PASSWORD, usr_admin_demo: DEMO_PASSWORD },
    session: null,
    customers,
    accounts,
    agreements,
    collaterals,
    transactions,
    schedules,
    expenses,
    cashMovements,
    cashCounts: {},
    openingCash,
    audit,
    photos: {},
    receiptSeq: 1000,
    appliedOpIds: {},
    backup: {
      lastBackupAt: dtDaysAgo(1, 22, 30),
      lastBackupResult: 'success',
      destination: 'Encrypted backup — administrator laptop (DEMO)',
      lastRestoreTestAt: dtDaysAgo(14),
      unresolvedErrors: [],
    },
  }
}

/* ------------------------------------------------------------------ */
/* Persistence of the mock server DB (localStorage)                    */
/* ------------------------------------------------------------------ */

export function loadMockDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return seedMockDb()
    const parsed = JSON.parse(raw) as MockDb
    if (parsed.version !== DB_VERSION) return seedMockDb()
    parsed.session = null // never persist sessions
    return parsed
  } catch {
    return seedMockDb()
  }
}

export function saveMockDb(db: MockDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* quota exceeded — demo data stays in memory for this session */
  }
}

export function resetMockDb(): MockDb {
  const db = seedMockDb()
  saveMockDb(db)
  return db
}

/* ------------------------------------------------------------------ */
/* Balance derivation — sums RECORDED allocations only.                */
/* No interest formula is applied (INT-006 / OD-001).                  */
/* ------------------------------------------------------------------ */

export function accountTransactions(db: MockDb, accountId: string): Transaction[] {
  return db.transactions
    .filter((t) => t.accountId === accountId && !t.reversalOfId)
    .sort((a, b) => (a.datetime < b.datetime ? -1 : a.datetime > b.datetime ? 1 : 0))
}

export interface ComponentTotals {
  principal: string
  interest: string
  other: string
  total: string
}

export function computeOutstanding(db: MockDb, accountId: string): ComponentTotals {
  const txns = accountTransactions(db, accountId)
  const reversed = new Set(db.transactions.filter((t) => t.type === 'reversal' && t.reversalOfId).map((t) => t.reversalOfId))
  let principal = d(0)
  let interest = d(0)
  let other = d(0)
  for (const t of txns) {
    if (reversed.has(t.id)) continue
    const sign = t.type === 'disbursement' || t.type === 'adjustment' ? 1 : -1
    for (const line of t.allocation) {
      const amt = d(line.amount).times(sign)
      if (line.component === 'principal') principal = principal.plus(amt)
      else if (line.component === 'interest') interest = interest.plus(amt)
      else other = other.plus(amt)
    }
  }
  const total = principal.plus(interest).plus(other)
  return {
    principal: principal.toString(),
    interest: interest.toString(),
    other: other.toString(),
    total: total.toString(),
  }
}

export function computeTotals(txns: Transaction[]): ComponentTotals {
  let principal = d(0)
  let interest = d(0)
  let other = d(0)
  for (const t of txns) {
    const sign = t.type === 'disbursement' || t.type === 'adjustment' ? 1 : -1
    for (const line of t.allocation) {
      const amt = d(line.amount).times(sign)
      if (line.component === 'principal') principal = principal.plus(amt)
      else if (line.component === 'interest') interest = interest.plus(amt)
      else other = other.plus(amt)
    }
  }
  return {
    principal: principal.toString(),
    interest: interest.toString(),
    other: other.toString(),
    total: principal.plus(interest).plus(other).toString(),
  }
}

export function accountReceivedTotal(db: MockDb, accountId: string): string {
  return sumMoney(
    db.transactions
      .filter((t) => t.accountId === accountId && t.type === 'receipt')
      .map((t) => t.amount),
  )
}

export function nextDueDate(db: MockDb, accountId: string): string | null {
  const items = db.schedules
    .filter((s) => s.accountId === accountId && s.status !== 'paid')
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
  return items[0]?.dueDate ?? null
}

export function addAudit(
  db: MockDb,
  actor: User,
  action: string,
  entityType: string,
  entityId: string,
  reason?: string,
): void {
  db.audit.unshift({
    id: newId('aud'),
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType,
    entityId,
    timestamp: nowISO(),
    reason,
  })
  if (db.audit.length > 500) db.audit.length = 500
}

export { addMoney, subMoney }
