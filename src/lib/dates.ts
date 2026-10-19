import {
  format,
  formatDistanceToNowStrict,
  isToday,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
} from 'date-fns'
import type { DateRange, ISODate, ReportPeriod } from '@/domain/types'

/** Format an ISO date (yyyy-MM-dd) for display: "19 Oct 2026" */
export function formatDate(iso: ISODate | null | undefined): string {
  if (!iso) return '—'
  return format(parseISO(iso), 'dd MMM yyyy')
}

/** Format an ISO datetime for display: "19 Oct 2026, 3:45 pm" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return format(parseISO(iso), 'dd MMM yyyy, h:mm a')
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return format(parseISO(iso), 'h:mm a')
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
  return formatDistanceToNowStrict(parseISO(iso), { addSuffix: true })
}

/** Today as yyyy-MM-dd in LOCAL time. */
export function todayISO(): ISODate {
  return format(new Date(), 'yyyy-MM-dd')
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

export function parseISOLocal(iso: ISODate): Date {
  const [y, m, dd] = iso.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, dd ?? 1)
}

/**
 * Resolve a named report period to an explicit range (SRS RPT-002).
 * Week starts Monday.
 */
export function resolvePeriod(period: ReportPeriod, custom?: DateRange): DateRange {
  const now = new Date()
  switch (period) {
    case 'today': {
      const t = toISODate(now)
      return { from: t, to: t }
    }
    case 'this_week':
      return {
        from: toISODate(startOfWeek(now, { weekStartsOn: 1 })),
        to: toISODate(endOfWeek(now, { weekStartsOn: 1 })),
      }
    case 'this_month':
      return {
        from: toISODate(startOfMonth(now)),
        to: toISODate(endOfMonth(now)),
      }
    case 'last_month': {
      const prev = subMonths(now, 1)
      return {
        from: toISODate(startOfMonth(prev)),
        to: toISODate(endOfMonth(prev)),
      }
    }
    case 'custom':
      return custom ?? { from: toISODate(now), to: toISODate(now) }
  }
}

export function periodLabel(range: DateRange): string {
  if (range.from === range.to) return formatDate(range.from)
  return `${formatDate(range.from)} – ${formatDate(range.to)}`
}

export function isSameDay(a: ISODate, b: ISODate): boolean {
  return a === b
}

export function dateIsToday(iso: ISODate): boolean {
  return isToday(parseISO(iso))
}
