import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  padded?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { children, padded = true, className = '', ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={[
        'w-full min-w-0 max-w-full rounded-2xl border border-line bg-card shadow-sm',
        padded ? 'p-5 sm:p-6' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </div>
  )
})
