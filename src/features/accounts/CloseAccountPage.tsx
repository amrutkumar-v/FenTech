import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getApi } from '@/api/provider'
import { PageHeader, Card, CardHeader, CardBody } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Amount, AmountLine } from '@/ui/Amount'
import { ConfirmDialog } from '@/ui/Modal'
import { useToast } from '@/ui/Toast'
import { LoadingState, ErrorState } from '@/ui/States'
import { formatDate } from '@/lib/dates'

export default function CloseAccountPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const qc = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const { data: account } = useQuery({
    queryKey: ['account', id],
    queryFn: () => getApi().getAccount(id!),
    enabled: !!id,
  })

  const { data: settlement, isLoading, error, refetch } = useQuery({
    queryKey: ['settlement', id],
    queryFn: () => getApi().getSettlement(id!),
    enabled: !!id,
  })

  async function doClose() {
    setBusy(true)
    try {
      await getApi().closeAccount(id!, 'Closed after settlement confirmation')
      qc.invalidateQueries().catch(() => {})
      toast.success('Account closed', 'A final settlement statement is available from the account page.')
      navigate(`/accounts/${id}`)
    } catch (err) {
      toast.error('Could not close account', err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
      setConfirmOpen(false)
    }
  }

  if (isLoading || !account) return <LoadingState label="Loading settlement…" />
  if (error || !settlement) return <ErrorState message={error instanceof Error ? error.message : 'Settlement unavailable.'} onRetry={() => void refetch()} />

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Settlement & account closure"
        subtitle={`${account.customerName} · ${account.financeType.replace('_', ' ')} account`}
        back={
          <Link to={`/accounts/${id}`} className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary">
            <ArrowLeft className="size-3.5" aria-hidden /> Account
          </Link>
        }
      />

      <Card className="mb-4">
        <CardHeader
          title="Settlement summary"
          subtitle={`Generated ${formatDate(settlement.generatedAt.slice(0, 10))} — figures below are sums of RECORDED ledger allocations`}
        />
        <CardBody>
          <AmountLine label="Total disbursed" value={settlement.disbursedTotal} />
          <AmountLine label="Total received" value={settlement.receivedTotal} />
          <div className="mt-3 rounded-md bg-surface-sunken p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Outstanding dues</p>
            <AmountLine label="Principal" value={settlement.outstanding.principal} />
            <AmountLine label="Interest" value={settlement.outstanding.interest} />
            <AmountLine label="Other approved dues" value={settlement.outstanding.other} />
            <AmountLine label="Total due" value={settlement.outstanding.total} strong />
          </div>
          {settlement.serverComputed && (
            <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
              <p className="font-semibold">Server-computed settlement</p>
              <p className="mt-1">{settlement.serverComputed.explanation}</p>
              <p className="mt-1 text-lg font-semibold">
                <Amount value={settlement.serverComputed.finalAmountDue} strong />
              </p>
            </div>
          )}
          <p className="mt-3 text-[11px] text-text-muted">
            This application does not compute interest or penalties. Any approved interest formula must be applied
            by the backend using confirmed business rules (OD-001, INT-006). Only recorded ledger amounts are shown above.
          </p>
        </CardBody>
      </Card>

      {settlement.canClose ? (
        <Card>
          <CardBody>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-5 text-brand-600" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-text-primary">All recorded dues are settled</p>
                <p className="mt-1 text-xs text-text-secondary">
                  You can close this account. Closure preserves the full history (CUS-006) and generates a final
                  settlement statement. Collateral release must still be confirmed separately (COL-005).
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => setConfirmOpen(true)}>Close account</Button>
              <Link to={`/accounts/${id}`}>
                <Button variant="outline">Cancel</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-5 text-amber-600" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-text-primary">Account cannot be closed</p>
                <ul className="mt-2 space-y-1 text-xs text-text-secondary">
                  {settlement.blockers.map((b, i) => (
                    <li key={i}>• {b}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Link to={`/payments/receipt?accountId=${id}`}>
                <Button>Record payment</Button>
              </Link>
              <Link to={`/accounts/${id}`}>
                <Button variant="outline">Back to account</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void doClose()}
        title="Confirm account closure"
        danger
        loading={busy}
        confirmLabel="Close account"
        requirePhrase="CLOSE"
        message={
          <>
            <p>
              You are about to close <strong>{account.customerName}</strong>'s{' '}
              <strong>{account.financeType.replace('_', ' ')}</strong> account.
            </p>
            <p>
              Outstanding is <strong><Amount value={settlement.outstanding.total} /></strong> as of now. Closure is
              recorded in the audit trail with your name and cannot be silently undone.
            </p>
          </>
        }
      />
    </div>
  )
}
