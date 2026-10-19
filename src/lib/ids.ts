/**
 * Stable unique ID generation for offline-first operation (BR-011).
 *
 * IDs are assigned CLIENT-SIDE before any network call so queued offline
 * operations keep the same identity through retries and sync. The server
 * treats these as idempotency keys and must not create duplicates.
 */

export function newId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : fallbackUuid()
  return `${prefix}_${uuid}`
}

function fallbackUuid(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Receipt numbers: RCP-YYYYMMDD-XXXX (display only; server is authoritative). */
export function previewReceiptNo(dateCompact: string): string {
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `RCP-${dateCompact}-${rand}`
}
