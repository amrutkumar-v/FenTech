import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
}

const variantCls: Record<Variant, string> = {
  primary:
    'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 disabled:bg-brand-200 dark:bg-brand-600 dark:hover:bg-brand-500 dark:disabled:bg-brand-900',
  secondary:
    'bg-ink-100 text-ink-900 hover:bg-ink-200 active:bg-ink-300 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700',
  ghost:
    'bg-transparent text-text-secondary hover:bg-ink-100 hover:text-text-primary dark:hover:bg-ink-800',
  outline:
    'border border-border-strong bg-surface text-text-primary hover:bg-ink-50 dark:hover:bg-ink-800',
  danger:
    'bg-red-700 text-white hover:bg-red-800 active:bg-red-900 disabled:bg-red-200 dark:bg-red-700 dark:hover:bg-red-600',
}

const sizeCls: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, className = '', children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors
        focus-visible:outline-2 focus-visible:outline-brand-500 focus-visible:outline-offset-2
        disabled:cursor-not-allowed disabled:opacity-70
        ${variantCls[variant]} ${sizeCls[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

export function IconButton({
  label,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-md text-text-secondary
        hover:bg-ink-100 hover:text-text-primary dark:hover:bg-ink-800 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
