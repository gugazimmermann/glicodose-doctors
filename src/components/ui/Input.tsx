import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

export const controlClass =
  'box-border w-full min-w-0 max-w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60'

type LabelProps = {
  children: ReactNode
  htmlFor?: string
  hint?: string
  /** 'default' = DoctorProfileForm; 'stacked' = prescription units on second line */
  density?: 'default' | 'stacked'
  /** stacked: second line under title (units) */
  subtitle?: string
  className?: string
}

export function Label({
  children,
  htmlFor,
  hint,
  density = 'default',
  subtitle,
  className = '',
}: LabelProps) {
  if (density === 'stacked') {
    return (
      <label htmlFor={htmlFor} className={`block ${className}`.trim()}>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          {children}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block text-[11px] text-muted">{subtitle}</span>
        ) : null}
      </label>
    )
  }

  return (
    <label htmlFor={htmlFor} className={`block ${className}`.trim()}>
      <span className="mb-1.5 block text-sm font-medium text-ink">
        {children}
        {hint ? (
          <span className="ml-1 font-normal text-muted">({hint})</span>
        ) : null}
      </span>
    </label>
  )
}

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={[controlClass, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className = '', children, ...props }: SelectProps) {
  return (
    <select
      className={[controlClass, className].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </select>
  )
}
