type StatTileProps = {
  label: string
  value: string
  hint?: string | null
  density?: 'compact' | 'comfortable'
  className?: string
}

export function StatTile({
  label,
  value,
  hint,
  density = 'comfortable',
  className = '',
}: StatTileProps) {
  const compact = density === 'compact'

  return (
    <div
      className={[
        'rounded-xl border border-line',
        compact
          ? 'bg-brand-softer/40 px-3 py-2.5'
          : 'bg-brand-softer/50 px-3 py-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p
        className={
          compact
            ? 'text-[11px] font-semibold uppercase tracking-wide text-muted'
            : 'text-xs font-semibold text-muted'
        }
      >
        {label}
      </p>
      <p
        className={
          compact
            ? 'mt-0.5 text-sm font-semibold text-ink'
            : 'mt-1.5 truncate text-base font-extrabold text-ink'
        }
      >
        {value}
      </p>
      {!compact && hint ? (
        <p className="mt-1 truncate text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  )
}
