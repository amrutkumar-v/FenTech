import Decimal from 'decimal.js'

/**
 * Money utilities — ALL monetary math goes through decimal.js (SRS INT-004).
 * Amounts are decimal strings; we never use JS floats for money.
 *
 * Rounding policy: OD-007 is TBD. Until the business owner approves a rule,
 * we only round for display (2 dp, half-up) and never silently round stored
 * values. Arithmetic helpers throw on malformed input rather than guessing.
 */

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

export function d(value: string | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value)
}

export function isMoney(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^-?\d+(\.\d+)?$/.test(value) &&
    Number.isFinite(Number(value))
  )
}

export function assertMoney(value: string, label = 'amount'): string {
  if (!isMoney(value)) {
    throw new Error(`Invalid ${label}: "${value}"`)
  }
  return value
}

export function addMoney(...values: (string | Decimal)[]): string {
  return values.reduce<Decimal>((acc, v) => acc.plus(d(v)), d(0)).toString()
}

export function subMoney(a: string | Decimal, b: string | Decimal): string {
  return d(a).minus(d(b)).toString()
}

export function mulMoney(a: string | Decimal, b: string | Decimal): string {
  return d(a).times(d(b)).toString()
}

export function sumMoney(values: (string | Decimal)[]): string {
  return values.reduce<Decimal>((acc, v) => acc.plus(d(v)), d(0)).toString()
}

export function isZeroMoney(value: string | Decimal): boolean {
  return d(value).isZero()
}

export function isPositiveMoney(value: string | Decimal): boolean {
  return d(value).gt(0)
}

export function isNegativeMoney(value: string | Decimal): boolean {
  return d(value).lt(0)
}

export function maxMoney(a: string, b: string): string {
  return d(a).gte(d(b)) ? a : b
}

/** Display-only rounding to 2 dp. Does not mutate stored values. */
export function roundMoneyForDisplay(value: string | Decimal): string {
  return d(value).toFixed(2)
}

/** Parse a user-typed amount ("1,234.50", "₹1234") to a canonical decimal string. */
export function parseUserAmount(input: string): string | null {
  const cleaned = input.replace(/[₹,\s]/g, '')
  if (!cleaned || !/^-?\d*\.?\d*$/.test(cleaned) || cleaned === '.' || cleaned === '-') {
    return null
  }
  try {
    return d(cleaned).toString()
  } catch {
    return null
  }
}

/** Pad to 2 decimal places only when the value is exact to 2 dp or less precision. */
export function canonicalMoney(value: string | Decimal): string {
  const dec = d(value)
  if (dec.dp() > 2) return dec.toString()
  return dec.toFixed(2)
}
