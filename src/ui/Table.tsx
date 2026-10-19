import type { ReactNode } from 'react'
import { useId } from 'react'

/**
 * Responsive data table.
 * Desktop: real table. Mobile (<sm): stacked rows rendered from the same
 * column definitions so financial data stays readable on a phone (SRS NFR).
 */
export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  className?: string
  /** Hide on mobile stacked view */
  hideOnMobile?: boolean
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  dense,
  caption,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: ReactNode
  dense?: boolean
  caption?: string
}) {
  const id = useId()
  if (rows.length === 0 && empty) {
    return <>{empty}</>
  }
  const pad = dense ? 'px-3 py-2' : 'px-3 py-2.5 sm:px-4'
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm" aria-labelledby={caption ? id : undefined}>
        {caption && (
          <caption id={id} className="sr-only">
            {caption}
          </caption>
        )}
        <thead>
          <tr className="border-b border-border-base text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`${pad} text-xs font-semibold uppercase tracking-wide text-text-muted ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''} ${c.className ?? ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-b border-border-base last:border-0 hover:bg-ink-50/60 dark:hover:bg-ink-900/40">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`${pad} align-top text-text-primary ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''} ${c.className ?? ''}`}
                >
                  <span className={c.hideOnMobile ? 'hidden sm:inline' : undefined}>{c.render(row)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Mobile-friendly record list: each row rendered as a card on small screens
 * where a wide table would be unusable.
 */
export function RecordList<T>({
  items,
  renderItem,
  rowKey,
}: {
  items: T[]
  renderItem: (item: T) => ReactNode
  rowKey: (item: T) => string
}) {
  return (
    <ul className="divide-y divide-border-base">
      {items.map((item) => (
        <li key={rowKey(item)} className="px-4 py-3">
          {renderItem(item)}
        </li>
      ))}
    </ul>
  )
}
