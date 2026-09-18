import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from './SegmentedControl'

const items = [
  { value: 'a' as const, label: 'A' },
  { value: 'b' as const, label: 'B' },
  { value: 'c' as const, label: 'C', disabled: true },
]

describe('SegmentedControl', () => {
  it('renders pills as a tablist', () => {
    render(
      <SegmentedControl
        items={items}
        value="a"
        onChange={vi.fn()}
        variant="pills"
        ariaLabel="Período"
      />,
    )
    expect(screen.getByRole('tablist', { name: 'Período' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('renders underline tabs', () => {
    render(
      <SegmentedControl
        items={items}
        value="b"
        onChange={vi.fn()}
        variant="underline"
        ariaLabel="Aba"
      />,
    )
    expect(screen.getByRole('tablist', { name: 'Aba' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('renders chips as a toggle group with aria-pressed', () => {
    render(
      <SegmentedControl
        items={items}
        value="a"
        onChange={vi.fn()}
        variant="chips"
        ariaLabel="Filtros"
      />,
    )
    expect(screen.getByRole('group', { name: 'Filtros' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('calls onChange when an enabled item is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl
        items={items}
        value="a"
        onChange={onChange}
        variant="pills"
        ariaLabel="Período"
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('does not call onChange for disabled items', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl
        items={items}
        value="a"
        onChange={onChange}
        variant="pills"
        ariaLabel="Período"
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'C' }))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: 'C' })).toBeDisabled()
  })
})
