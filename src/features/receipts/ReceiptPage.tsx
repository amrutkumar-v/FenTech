import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer, Download, ArrowLeft } from 'lucide-react'
import { getApi } from '@/api/provider'
import { PageHeader, Card, CardBody } from '@/ui/Card'
import { Button } from '@/ui/Button'
import { Amount, AmountLine } from '@/ui/Amount'
import { LoadingState, ErrorState } from '@/ui/States'
import { formatDate, formatDateTime } from '@/lib/dates'
import { PAYMENT_METHOD_LABELS, FINANCE_TYPE_LABELS } from '@/lib/format'

/**
 * Printable receipt / transaction record (PRN-002, PRN-003, PRN-008).
 * PDF export uses the browser's print-to-PDF so values always match the
 * source record exactly — no second rendering path to drift.
 */
export default function ReceiptPage() {
  const { txnId } = useParams<{ txnId: string }>()
  const { data: receipt, isLoading, error, refetch } = useQuery({
    queryKey: ['receipt', txnId],
    queryFn: () => getApi().getReceipt(txnId!),
    enabled: !!txnId,
  })

  if (isLoading) return <LoadingState label="Loading receipt…" />
  if (error || !receipt) {
    return <ErrorState message={error instanceof Error ? error.message : 'Receipt not found.'} onRetry={() => void refetch()} />
  }

  const r = receipt

  return (
    <div className="mx-auto max-w-lg">
      <div className="no-print">
        <PageHeader
          back={
            <Link to="/transactions" className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text-primary">
              <ArrowLeft className="size-3.5" aria-hidden /> Ledger
            </Link>
          }
          title={r.type === 'disbursement' ? 'Disbursement record' : 'Payment receipt'}
          subtitle={r.receiptNo}
          actions={
            <>
              <Button variant="outline" size="sm" icon={<Printer className="size-3.5" aria-hidden />} onClick={() => window.print()}>
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={<Download className="size-3.5" aria-hidden />}
                title="Use Print → Save as PDF in the dialog"
                onClick={() => window.print()}
              >
                PDF
              </Button>
            </>
          }
        />
      </div>

      <Card className="print-page">
        <CardBody>
          <div className="border-b border-dashed border-border-strong pb-4 text-center">
            <p className="text-base font-semibold text-text-primary">{r.businessName}</p>
            {r.businessContact && <p className="text-xs text-text-muted">{r.businessContact}</p>}
            <p className="mt-1 text-xs uppercase tracking-widest text-text-muted">
              {r.type === 'disbursement' ? 'Disbursement record' : 'Receipt for payment received'}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-text-muted">Receipt no.</span>
            <span className="num text-right font-medium">{r.receiptNo}</span>
            <span className="text-text-muted">Date</span>
            <span className="num text-right">{formatDate(r.date)}</span>
            <span className="text-text-muted">Customer</span>
            <span className="text-right font-medium">{r.customerName}</span>
            <span className="text-text-muted">Phone</span>
            <span className="num text-right">{r.customerPhone}</span>
            <span className="text-text-muted">Account</span>
            <span className="text-right">{FINANCE_TYPE_LABELS[r.financeType]}</span>
            <span className="text-text-muted">Method</span>
            <span className="text-right">{PAYMENT_METHOD_LABELS[r.method]}</span>
            {r.reference && (
              <>
                <span className="text-text-muted">Reference</span>
                <span className="num text-right">{r.reference}</span>
              </>
            )}
            <span className="text-text-muted">Recorded by</span>
            <span className="text-right">{r.actorName}</span>
          </div>

          <div className="mt-4 rounded-lg bg-surface-sunken px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-text-muted">Amount</p>
            <p className="num mt-0.5 text-2xl font-bold text-text-primary">
              <Amount value={r.amount} strong />
            </p>
          </div>

          {r.allocation.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Allocation</p>
              {r.allocation.map((line, i) => (
                <AmountLine key={i} label={line.component === 'other' ? 'Other dues' : line.component.charAt(0).toUpperCase() + line.component.slice(1)} value={line.amount} />
              ))}
              <p className="mt-1 text-[11px] text-text-muted">
                Allocation was recorded manually as per the agreement (PAY-005).
              </p>
            </div>
          )}

          {r.remainingOutstanding && (
            <div className="mt-4 border-t border-dashed border-border-strong pt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Remaining outstanding after this entry
              </p>
              <AmountLine label="Principal" value={r.remainingOutstanding.principal} />
              <AmountLine label="Interest" value={r.remainingOutstanding.interest} />
              <AmountLine label="Other" value={r.remainingOutstanding.other} />
              <AmountLine label="Total" value={r.remainingOutstanding.total} strong />
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-8 text-center text-xs text-text-muted">
            <div className="border-t border-border-strong pt-2">Customer signature</div>
            <div className="border-t border-border-strong pt-2">Authorized signature</div>
          </div>

          <p className="mt-4 text-center text-[10px] text-text-muted">
            Generated {formatDateTime(r.generatedAt)} · Transaction ID {r.transactionId}
            <br />
            This is a computer-generated record. Interest/penalty calculations are not performed by this system.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
