import { describe, expect, it } from 'vitest'
import { can, ROLE_PERMISSIONS } from './permissions'

/**
 * Role matrix from SRS §2. OD-014 marks exact permissions TBD, so these tests
 * pin the CURRENT defaults: operator runs the day-to-day desk; only admin
 * reaches system configuration, users, sync, backup and audit.
 */
describe('permissions (SRS §2, SEC-002)', () => {
  it('operator can run day-to-day financial operations', () => {
    for (const p of [
      'customers:write',
      'accounts:write',
      'transactions:record',
      'transactions:reverse',
      'cashbook:write',
      'expenses:write',
      'reports:view',
      'receipts:print',
      'collateral:release',
    ] as const) {
      expect(can('operator', p)).toBe(true)
    }
  })

  it('operator cannot reach admin-only areas', () => {
    for (const p of ['settings:users', 'settings:sync', 'backup:view', 'backup:restore', 'audit:read'] as const) {
      expect(can('operator', p)).toBe(false)
    }
  })

  it('admin has every operator permission plus administration', () => {
    for (const p of ROLE_PERMISSIONS.operator) {
      expect(can('admin', p)).toBe(true)
    }
    for (const p of ['settings:users', 'settings:sync', 'backup:restore', 'audit:read'] as const) {
      expect(can('admin', p)).toBe(true)
    }
  })

  it('denies when there is no session', () => {
    expect(can(undefined, 'customers:read')).toBe(false)
    expect(can(undefined, 'audit:read')).toBe(false)
  })
})
