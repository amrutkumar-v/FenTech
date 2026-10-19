import { describe, expect, it } from 'vitest'
import {
  addMoney,
  canonicalMoney,
  d,
  isMoney,
  isZeroMoney,
  maxMoney,
  parseUserAmount,
  roundMoneyForDisplay,
  subMoney,
  sumMoney,
} from './money'

describe('money (decimal.js — never JS floats)', () => {
  it('adds decimal strings exactly without float drift (INT-004)', () => {
    expect(addMoney('0.1', '0.2')).toBe('0.3')
    expect(addMoney('50000', '3500.55', '0.45')).toBe('53501')
    expect(sumMoney(['1000.10', '2000.20', '3000.30'])).toBe('6000.6')
  })

  it('subtracts and never returns -0', () => {
    expect(subMoney('5000', '5000')).toBe('0')
    expect(subMoney('100', '250')).toBe('-150')
  })

  it('rejects malformed money strings', () => {
    expect(isMoney('1234.50')).toBe(true)
    expect(isMoney('-10')).toBe(true)
    expect(isMoney('1,234')).toBe(false)
    expect(isMoney('abc')).toBe(false)
    expect(isMoney('')).toBe(false)
  })

  it('parses user input (₹, commas, spaces) into canonical decimals', () => {
    expect(parseUserAmount('₹1,234.50')).toBe('1234.5')
    expect(parseUserAmount(' 5000 ')).toBe('5000')
    expect(parseUserAmount('')).toBeNull()
    expect(parseUserAmount('.')).toBeNull()
    expect(parseUserAmount('12.3.4')).toBeNull()
  })

  it('pads to 2 dp only when precision allows (no silent rounding of stored values)', () => {
    expect(canonicalMoney('1000')).toBe('1000.00')
    expect(canonicalMoney('99.9')).toBe('99.90')
    // More than 2 dp is preserved verbatim — rounding policy is TBD (OD-007).
    expect(canonicalMoney('1.005')).toBe('1.005')
  })

  it('rounds for DISPLAY only', () => {
    expect(roundMoneyForDisplay('1.005')).toBe('1.01')
    expect(roundMoneyForDisplay('2')).toBe('2.00')
  })

  it('compares and detects zero', () => {
    expect(maxMoney('10', '20')).toBe('20')
    expect(isZeroMoney('0.00')).toBe(true)
    expect(isZeroMoney('-0')).toBe(true)
    expect(isZeroMoney('0.01')).toBe(false)
  })

  it('throws on invalid input rather than guessing', () => {
    expect(() => d('not-a-number')).toBeDefined()
    expect(() => addMoney('abc', '1')).toThrow()
  })
})
