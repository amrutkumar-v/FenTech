import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from 'react'

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className = '',
}: {
  label: string
  htmlFor: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-text-primary">
        {label}
        {required && (
          <span className="ml-0.5 text-red-600 dark:text-red-400" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

const inputBase =
  'w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary ' +
  'placeholder:text-text-muted shadow-none ' +
  'focus:border-brand-500 focus:outline-2 focus:outline-brand-500/40 ' +
  'disabled:bg-ink-50 disabled:text-text-muted dark:bg-ink-900 dark:border-ink-700 ' +
  'aria-[invalid=true]:border-red-500'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className = '', invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={`${inputBase} ${className}`}
        {...rest}
      />
    )
  },
)

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className = '', invalid, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${inputBase} appearance-none pr-8 ${className}`}
      {...rest}
    >
      {children}
    </select>
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className = '', invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      rows={3}
      className={`${inputBase} resize-y ${className}`}
      {...rest}
    />
  )
})
