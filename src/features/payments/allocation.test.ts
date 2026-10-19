import { describe, expect, it } from 'vitest'
import { emptyAllocation, toAllocationLines } from './AllocationEditor'

/**
 * Manual allocation (PAY-005): the operator records how a payment splits
 * across principal / interest / other. Blank and zero components are dropped;
 * values are canonical money strings.
 */
describe('allocation editor helpers (PAY-005)', () => {
  it('starts empty', () => {
    expect(emptyAllocation()).toEqual({ principal: '', interest: '', other: '' })
  })

  it('drops blank and zero components', () => {
    const lines = toAllocationLines({ principal: '3500', interest: '', other: '0' })
    expect(lines).toEqual([{ component: 'principal', amount: '3500.00' }])
  })

  it('keeps order and canonicalises amounts', () => {
    const lines = toAllocationLines({ principal: '3,500', interest: '₹1,500', other: '0.50' })
    expect(lines).toEqual([
      { component: 'principal', amount: '3500.00' },
      { component: 'interest', amount: '1500.00' },
      { component: 'other', amount: '0.50' },
    ])
  })

  it('ignores unparseable input rather than guessing', () => {
    expect(toAllocationLines({ principal: 'abc', interest: '.', other: '' })).toEqual([])
  })
})
