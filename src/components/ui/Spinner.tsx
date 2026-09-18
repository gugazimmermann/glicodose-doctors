type SpinnerProps = {
  label?: string
  className?: string
}

export function Spinner({ label = 'Carregando…', className = '' }: SpinnerProps) {
  return (
    <div
      className={`flex items-center gap-3 text-sm text-muted ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span
        className="inline-block size-5 shrink-0 animate-spin rounded-full border-2 border-brand-soft border-t-brand"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  )
}

export function FullPageSpinner(props: SpinnerProps) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Spinner {...props} />
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-brand-soft/60 ${className}`.trim()}
      aria-hidden
    />
  )
}
