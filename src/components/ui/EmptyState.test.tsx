import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Nenhum paciente" />)
    expect(screen.getByText('Nenhum paciente')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    render(
      <EmptyState
        title="Vazio"
        description="Vincule um paciente para começar."
      />,
    )
    expect(
      screen.getByText('Vincule um paciente para começar.'),
    ).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    render(
      <EmptyState title="Vazio" icon={<span data-testid="icon">★</span>} />,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders action when provided', () => {
    render(
      <EmptyState
        title="Vazio"
        action={<button type="button">Vincular</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Vincular' })).toBeInTheDocument()
  })

  it('uses muted title styles when muted', () => {
    render(<EmptyState title="Sem dados" muted />)
    expect(screen.getByText('Sem dados')).toHaveClass('text-muted')
  })

  it('uses muted description spacing when muted with description', () => {
    render(
      <EmptyState title="Sem dados" description="Tente outro período" muted />,
    )
    expect(screen.getByText('Tente outro período')).toHaveClass('mt-1')
  })
})
