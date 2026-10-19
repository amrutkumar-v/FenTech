import { useQuery } from '@tanstack/react-query'
import { getApi } from '@/api/provider'
import type { AccountSummary, CustomerSummary } from '@/domain/types'

/** Customer → account picker data used by payment and disbursement workflows. */
export function useCustomerAccounts() {
  return useQuery({
    queryKey: ['customers', 'picker', 1],
    queryFn: () => getApi().listCustomers({ page: 1, pageSize: 200, status: 'active' }),
  })
}

export function useAccountSummary(accountId: string | null | undefined) {
  return useQuery({
    queryKey: ['account', accountId],
    queryFn: () => getApi().getAccount(accountId!),
    enabled: !!accountId,
  })
}

export function findOpenAccounts(c: CustomerSummary): AccountSummary[] {
  return c.accounts.filter((a) => a.status === 'active' || a.status === 'overdue')
}

export function useCustomer(customerId: string | null | undefined) {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getApi().getCustomer(customerId!),
    enabled: !!customerId,
  })
}
