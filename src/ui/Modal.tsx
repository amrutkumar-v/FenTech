import { useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const onCancel = (e: Event) => {
      e.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [onClose])

  return (
    <dialog
      ref={ref}
      className="m-auto w-full rounded-xl border border-border-base bg-surface-raised p-0 text-text-primary shadow-popover backdrop:bg-ink-950/50 open:animate-fade-in"
      style={{ maxWidth: wide ? '44rem' : '28rem' }}
      aria-labelledby="modal-title"
    >
      <div className="flex items-center justify-between border-b border-border-base px-4 py-3">
        <h2 id="modal-title" className="text-sm font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-text-muted hover:bg-ink-100 hover:text-text-primary dark:hover:bg-ink-800"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="px-4 py-4">{children}</div>
      {footer && (
        <div className="flex justify-end gap-2 border-t border-border-base px-4 py-3">{footer}</div>
      )}
    </dialog>
  )
}

/**
 * Confirmation dialog for sensitive / irreversible financial operations
 * (SRS 8.1: confirm closure, reversal, restore, agreement changes).
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  loading,
  requirePhrase,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  requirePhrase?: string
}) {
  const [phrase, setPhrase] = useState('')
  const canConfirm = !requirePhrase || phrase.trim() === requirePhrase

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              if (!canConfirm) return
              onConfirm()
            }}
            loading={loading}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-text-secondary [&_p]:mb-2">{message}</div>
      {requirePhrase && (
        <div className="mt-3">
          <label htmlFor="confirm-phrase" className="mb-1 block text-xs font-medium text-text-secondary">
            Type <span className="font-mono font-semibold">{requirePhrase}</span> to confirm
          </label>
          <input
            id="confirm-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm"
            autoComplete="off"
          />
        </div>
      )}
    </Modal>
  )
}
