import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from './Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Conteúdo do card</Card>)
    expect(screen.getByText('Conteúdo do card')).toBeInTheDocument()
  })

  it('applies padding by default', () => {
    const { container } = render(<Card>Padded</Card>)
    expect(container.firstChild).toHaveClass('p-5')
  })

  it('omits padding when padded is false', () => {
    const { container } = render(<Card padded={false}>Sem padding</Card>)
    expect(container.firstChild).not.toHaveClass('p-5')
    expect(container.firstChild).not.toHaveClass('sm:p-6')
  })
})
