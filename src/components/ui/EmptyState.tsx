import type { ReactNode } from 'react'
import { Card } from './Card'

type EmptyStateProps = {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
  /** Quieter single-line empty (history/charts). */
  muted?: boolean
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
  muted = false,
}: EmptyStateProps) {
  return (
    <Card
      className={[
        'border-dashed bg-card/70 py-10 text-center',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon ? <div className="mx-auto mb-4 w-fit opacity-90">{icon}</div> : null}
      <p
        className={
          muted
            ? 'text-sm font-semibold text-muted'
            : 'text-base font-semibold text-ink'
        }
      >
        {title}
      </p>
      {description ? (
        <p
          className={`mx-auto max-w-sm text-sm text-muted ${muted ? 'mt-1' : 'mt-2'}`}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </Card>
  )
}
