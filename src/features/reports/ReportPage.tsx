import type { ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { PageHeader } from '@/ui/Card'
import { Button } from '@/ui/Button'

/** Report page chrome: header with a print button + print-safe layout wrapper. */
export function ReportPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={title}
          subtitle={subtitle}
          actions={
            <>
              {actions}
              <Button variant="outline" size="sm" icon={<Printer className="size-3.5" aria-hidden />} onClick={() => window.print()}>
                Print / PDF
              </Button>
            </>
          }
        />
      </div>
      <div className="print-page">{children}</div>
    </div>
  )
}
