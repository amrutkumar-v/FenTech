/**
 * Typed API error surface. Every adapter (HTTP or mock) normalises failures
 * into ApiError so the UI can render actionable messages (SRS 8.1).
 */

export type ApiErrorKind =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'network'
  | 'server'
  | 'offline'
  | 'unknown'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly fieldErrors?: Record<string, string>
  readonly opId?: string

  constructor(
    kind: ApiErrorKind,
    message: string,
    opts?: { status?: number; fieldErrors?: Record<string, string>; opId?: string; cause?: unknown },
  ) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = 'ApiError'
    this.kind = kind
    this.status = opts?.status
    this.fieldErrors = opts?.fieldErrors
    this.opId = opts?.opId
  }

  static validation(message: string, fieldErrors?: Record<string, string>): ApiError {
    return new ApiError('validation', message, { fieldErrors })
  }

  static unauthorized(message = 'Your session has expired. Please sign in again.'): ApiError {
    return new ApiError('unauthorized', message, { status: 401 })
  }

  static forbidden(message = 'You do not have permission for this action.'): ApiError {
    return new ApiError('forbidden', message, { status: 403 })
  }

  static notFound(what = 'Record'): ApiError {
    return new ApiError('not_found', `${what} not found.`, { status: 404 })
  }

  static conflict(message: string): ApiError {
    return new ApiError('conflict', message, { status: 409 })
  }

  static network(message = 'Network unavailable. Check your connection and try again.'): ApiError {
    return new ApiError('network', message)
  }

  static offline(
    message = 'You are offline. The record is saved on this device and will sync when you reconnect.',
  ): ApiError {
    return new ApiError('offline', message)
  }

  static server(message = 'The server could not complete the request.'): ApiError {
    return new ApiError('server', message, { status: 500 })
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}
