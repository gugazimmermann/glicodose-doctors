import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Alert } from './Alert'

describe('Alert', () => {
  it('renders variants with expected classes', () => {
    const { rerender } = render(<Alert variant="error">Erro</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('text-danger')

    rerender(<Alert variant="success">Ok</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('text-ok')

    rerender(<Alert variant="info">Info</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('text-brand-dark')
  })

  it('calls onDismiss when Fechar is clicked', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(
      <Alert onDismiss={onDismiss}>Mensagem</Alert>,
    )

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('omits dismiss button when onDismiss is absent', () => {
    render(<Alert>Só texto</Alert>)
    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument()
  })
})
