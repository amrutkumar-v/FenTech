import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { Camera, X } from 'lucide-react'
import { formatFileSize } from '@/lib/format'

export function PhotoInput({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  error?: string
  required?: boolean
  value: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const handle = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null
      onChange(file)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(file ? URL.createObjectURL(file) : null)
    },
    [onChange, preview],
  )

  const clear = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [onChange, preview])

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-primary">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600 dark:text-red-400" aria-hidden>
            *
          </span>
        )}
      </span>
      <div className="flex items-start gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={`flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed
            ${error ? 'border-red-400' : 'border-border-strong'} bg-surface-sunken text-text-muted
            hover:border-brand-500 hover:text-brand-600 disabled:opacity-60`}
          aria-label={preview ? `Change ${label}` : `Add ${label}`}
        >
          {preview ? (
            <img src={preview} alt="Selected" className="size-full object-cover" />
          ) : (
            <Camera className="size-6" aria-hidden />
          )}
        </button>
        <div className="min-w-0 flex-1 text-xs text-text-muted">
          {hint && <p>{hint}</p>}
          {value && (
            <p className="mt-1 text-text-secondary">
              {value.name} · {formatFileSize(value.size)}
              <button
                type="button"
                onClick={clear}
                className="ml-2 inline-flex items-center gap-0.5 font-medium text-red-600 hover:underline dark:text-red-400"
              >
                <X className="size-3" aria-hidden /> Remove
              </button>
            </p>
          )}
          {error && <p className="mt-1 font-medium text-red-600 dark:text-red-400">{error}</p>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handle}
        disabled={disabled}
      />
    </div>
  )
}

export function PhotoGallery({
  photos,
  emptyLabel = 'No photos',
}: {
  photos: { id: string; url: string; fileName: string; pendingSync?: boolean }[]
  emptyLabel?: string
}) {
  if (photos.length === 0) {
    return <p className="text-xs text-text-muted">{emptyLabel}</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((p) => (
        <a
          key={p.id}
          href={p.url || undefined}
          target="_blank"
          rel="noreferrer"
          className="group relative block size-24 overflow-hidden rounded-lg border border-border-base bg-surface-sunken"
        >
          {p.url ? (
            <img src={p.url} alt={p.fileName} className="size-full object-cover" loading="lazy" />
          ) : (
            <span className="flex size-full items-center justify-center text-[10px] text-text-muted">
              {p.pendingSync ? 'Pending sync' : 'Unavailable'}
            </span>
          )}
        </a>
      ))}
    </div>
  )
}
