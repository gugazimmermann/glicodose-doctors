import type { ReactNode } from 'react'

type AlertVariant = 'error' | 'success' | 'info'

type AlertProps = {
  variant?: AlertVariant
  children: ReactNode
  className?: string
  onDismiss?: () => void
}

const variantClass: Record<AlertVariant, string> = {
  error: 'bg-danger-soft text-danger',
  success: 'bg-ok-soft text-ok',
  info: 'bg-brand-soft text-brand-dark',
}

export function Alert({
  variant = 'info',
  children,
  className = '',
  onDismiss,
}: AlertProps) {
  return (
    <div
      role="alert"
      className={[
        'flex items-start gap-3 rounded-xl px-3.5 py-2.5 text-sm',
        variantClass[variant],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold opacity-70 transition hover:opacity-100"
          aria-label="Fechar"
        >
          Fechar
        </button>
      ) : null}
    </div>
  )
}
