import type { UserRole } from '@/domain/types'

/**
 * Role permission matrix.
 *
 * SRS SEC-002 / OD-014: exact role permissions must be confirmed by the
 * business owner. The defaults below implement the SRS §2 role table:
 *  - operator (father): day-to-day customers, accounts, transactions,
 *    cashbook, expenses, collateral, reports, receipts.
 *  - admin (user): everything the operator can do, PLUS system configuration,
 *    authorized-user management, sync administration, backup/recovery,
 *    and audit review.
 *
 * This is a single source of truth so permissions never scatter through UI.
 */
export type Permission =
  | 'customers:read'
  | 'customers:write'
  | 'accounts:read'
  | 'accounts:write'
  | 'accounts:close'
  | 'terms:write'
  | 'collateral:read'
  | 'collateral:write'
  | 'collateral:release'
  | 'transactions:read'
  | 'transactions:record'
  | 'transactions:reverse'
  | 'cashbook:read'
  | 'cashbook:write'
  | 'expenses:read'
  | 'expenses:write'
  | 'reports:view'
  | 'receipts:print'
  | 'collections:manage'
  | 'settings:self'
  | 'settings:users'
  | 'settings:sync'
  | 'backup:view'
  | 'backup:restore'
  | 'audit:read'

const OPERATOR_PERMISSIONS: Permission[] = [
  'customers:read',
  'customers:write',
  'accounts:read',
  'accounts:write',
  'accounts:close',
  'terms:write',
  'collateral:read',
  'collateral:write',
  'collateral:release',
  'transactions:read',
  'transactions:record',
  'transactions:reverse',
  'cashbook:read',
  'cashbook:write',
  'expenses:read',
  'expenses:write',
  'reports:view',
  'receipts:print',
  'collections:manage',
  'settings:self',
]

const ADMIN_PERMISSIONS: Permission[] = [
  ...OPERATOR_PERMISSIONS,
  'settings:users',
  'settings:sync',
  'backup:view',
  'backup:restore',
  'audit:read',
]

export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  operator: new Set(OPERATOR_PERMISSIONS),
  admin: new Set(ADMIN_PERMISSIONS),
}

export function can(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false
  return ROLE_PERMISSIONS[role].has(permission)
}
