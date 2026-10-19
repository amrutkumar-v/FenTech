import { describe, expect, it } from 'vitest'
import { computeOutstanding, seedMockDb } from './db'
import { addMoney } from '@/lib/money'
import type { Transaction } from '@/domain/types'

/**
 * The single most important financial invariant (BR-008, RPT-008, INT-006):
 * outstanding is the SUM OF RECORDED LEDGER ALLOCATIONS only. The app never
 * invents an interest formula; a repayment reduces outstanding; a reversal is
 * a new linked entry — never a delete.
 */
describe('outstanding derivation (recorded allocations only)', () => {
  it('sums principal/interest/other from recorded entries', () => {
    const db = seedMockDb()
    // acc_gold_ramesh: disbursed ₹50,000 principal; receipts allocate
    // ₹3,500 + ₹1,500 principal and ₹1,500 + ₹1,500 interest.
    const out = computeOutstanding(db, 'acc_gold_ramesh')
    expect(out.principal).toBe('45000')
    expect(out.interest).toBe('-3000')
    expect(out.total).toBe(addMoney(out.principal, out.interest, out.other))
  })

  it('is unaffected by a reversal until the reversal entry is recorded', () => {
    const db = seedMockDb()
    const before = computeOutstanding(db, 'acc_free_ramesh') // 15000 - 2000
    expect(before.principal).toBe('13000')

    // Record a reversal of the ₹2,000 receipt (a NEW linked entry, not a delete).
    const target = db.transactions.find((t) => t.id === 'txn_rec_free_ramesh_1')!
    const reversal: Transaction = {
      ...target,
      id: 'txn_rev_free_ramesh_1',
      idempotencyKey: 'txn_rev_free_ramesh_1',
      type: 'reversal',
      reversalOfId: target.id,
      allocation: target.allocation.map((l) => ({ ...l })),
    }
    db.transactions.push(reversal)

    const after = computeOutstanding(db, 'acc_free_ramesh')
    // The original receipt is excluded and the reversal re-credits the principal.
    expect(after.principal).toBe('15000')
  })

  it('keeps a fully repaid account at zero outstanding', () => {
    const db = seedMockDb()
    const out = computeOutstanding(db, 'acc_closed_demo') // 10000 - 8000 - 2000
    expect(out.principal).toBe('0')
    expect(out.total).toBe('0')
  })
})
