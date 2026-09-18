import type { ReactNode } from 'react'

type SegmentedItem<T extends string> = {
  value: T
  label: ReactNode
  disabled?: boolean
}

type SegmentedControlProps<T extends string> = {
  items: SegmentedItem<T>[]
  value: T
  onChange: (value: T) => void
  variant: 'pills' | 'underline' | 'chips'
  ariaLabel: string
  getTabId?: (value: T) => string
  getPanelId?: (value: T) => string
  className?: string
}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  variant,
  ariaLabel,
  getTabId,
  getPanelId,
  className = '',
}: SegmentedControlProps<T>) {
  const isToggle = variant === 'chips'

  const containerClass =
    variant === 'pills'
      ? 'flex rounded-xl bg-brand-softer p-1'
      : variant === 'underline'
        ? 'flex max-w-full gap-1 overflow-x-auto border-b border-line'
        : 'flex flex-wrap gap-2'

  return (
    <div
      role={isToggle ? 'group' : 'tablist'}
      aria-label={ariaLabel}
      className={[containerClass, className].filter(Boolean).join(' ')}
    >
      {items.map((item) => {
        const selected = item.value === value
        const tabId = getTabId?.(item.value)
        const panelId = getPanelId?.(item.value)

        const buttonClass =
          variant === 'pills'
            ? `flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                selected
                  ? 'bg-card text-brand shadow-sm'
                  : 'text-muted hover:text-ink'
              }`
            : variant === 'underline'
              ? `-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                  selected
                    ? 'border-brand text-brand-dark'
                    : 'border-transparent text-muted hover:text-ink'
                }`
              : `rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                  selected
                    ? 'border-brand bg-brand-soft text-brand-dark'
                    : 'border-line bg-white text-ink hover:border-brand/50'
                }`

        return (
          <button
            key={item.value}
            type="button"
            role={isToggle ? undefined : 'tab'}
            id={tabId}
            aria-selected={isToggle ? undefined : selected}
            aria-pressed={isToggle ? selected : undefined}
            aria-controls={isToggle ? undefined : panelId}
            tabIndex={isToggle ? undefined : selected ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={buttonClass}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
