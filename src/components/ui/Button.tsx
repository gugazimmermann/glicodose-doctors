import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-dark disabled:opacity-60 shadow-sm',
  secondary:
    'border border-line bg-card text-ink hover:border-brand hover:text-brand disabled:opacity-60',
  danger:
    'border border-line bg-card text-muted hover:border-danger hover:text-danger disabled:opacity-60',
  ghost: 'text-muted hover:text-ink disabled:opacity-60',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'rounded-lg px-3 py-1.5 text-sm font-medium',
  md: 'rounded-xl px-4 py-2.5 text-sm font-semibold',
  lg: 'rounded-xl px-5 py-3 text-sm font-semibold',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      className = '',
      type = 'button',
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={[
          'inline-flex items-center justify-center gap-2 transition',
          variantClass[variant],
          sizeClass[size],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </button>
    )
  },
)
