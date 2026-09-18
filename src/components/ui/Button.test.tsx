import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders variants with expected classes', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>)
    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass(
      'bg-brand',
    )

    rerender(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass(
      'border-line',
    )

    rerender(<Button variant="danger">Danger</Button>)
    expect(screen.getByRole('button', { name: 'Danger' }).className).toContain(
      'hover:text-danger',
    )

    rerender(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole('button', { name: 'Ghost' })).toHaveClass(
      'text-muted',
    )
  })

  it('renders sizes with expected classes', () => {
    const { rerender } = render(<Button size="sm">Sm</Button>)
    expect(screen.getByRole('button', { name: 'Sm' })).toHaveClass('px-3')

    rerender(<Button size="md">Md</Button>)
    expect(screen.getByRole('button', { name: 'Md' })).toHaveClass('px-4')

    rerender(<Button size="lg">Lg</Button>)
    expect(screen.getByRole('button', { name: 'Lg' })).toHaveClass('px-5')
  })

  it('respects disabled', () => {
    render(<Button disabled>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Clique</Button>)

    await user.click(screen.getByRole('button', { name: 'Clique' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('defaults type to button', () => {
    render(<Button>OK</Button>)
    expect(screen.getByRole('button', { name: 'OK' })).toHaveAttribute(
      'type',
      'button',
    )
  })
})
