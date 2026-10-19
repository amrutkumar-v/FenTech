import { describe, expect, it } from 'vitest'
import { endOfWeek, startOfWeek } from 'date-fns'
import { resolvePeriod, todayISO, toISODate } from './dates'

describe('resolvePeriod (RPT-002)', () => {
  it('resolves "today" to a single day', () => {
    const r = resolvePeriod('today')
    expect(r.from).toBe(r.to)
    expect(r.from).toBe(todayISO())
  })

  it('resolves "this_week" Monday–Sunday (weekStartsOn: 1)', () => {
    const r = resolvePeriod('this_week')
    const now = new Date()
    expect(r.from).toBe(toISODate(startOfWeek(now, { weekStartsOn: 1 })))
    expect(r.to).toBe(toISODate(endOfWeek(now, { weekStartsOn: 1 })))
  })

  it('resolves "this_month" to the calendar month', () => {
    const r = resolvePeriod('this_month')
    expect(r.from.endsWith('-01')).toBe(true)
    expect(r.from <= r.to).toBe(true)
  })

  it('"last_month" is the previous calendar month', () => {
    const r = resolvePeriod('last_month')
    const thisMonth = resolvePeriod('this_month')
    expect(r.to < thisMonth.from).toBe(true)
  })

  it('passes a custom range through unchanged', () => {
    const custom = { from: '2026-01-05', to: '2026-02-09' }
    expect(resolvePeriod('custom', custom)).toEqual(custom)
  })

  it('falls back to today when custom is requested without a range', () => {
    const r = resolvePeriod('custom')
    expect(r.from).toBe(todayISO())
    expect(r.to).toBe(todayISO())
  })
})
