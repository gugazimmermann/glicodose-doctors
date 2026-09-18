import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog, Modal } from './Modal'

describe('Modal', () => {
  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal title="Detalhe" onClose={onClose} size="lg">
        <p>Conteúdo</p>
      </Modal>,
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when overlay is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal title="Detalhe" onClose={onClose} size="lg">
        <p>Conteúdo</p>
      </Modal>,
    )

    await user.click(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close when dialog content is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal title="Detalhe" onClose={onClose} size="lg">
        <p>Conteúdo</p>
      </Modal>,
    )

    await user.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('traps Tab focus within the dialog', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal title="Detalhe" onClose={onClose} size="lg" showCloseButton>
        <button type="button">Ação</button>
      </Modal>,
    )

    const closeBtn = screen.getByRole('button', { name: 'Fechar' })
    const actionBtn = screen.getByRole('button', { name: 'Ação' })
    expect(closeBtn).toHaveFocus()

    await user.tab()
    expect(actionBtn).toHaveFocus()

    await user.tab()
    expect(closeBtn).toHaveFocus()

    await user.tab({ shift: true })
    expect(actionBtn).toHaveFocus()
  })
})

describe('ConfirmDialog', () => {
  it('calls onConfirm and onCancel', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Remover vínculo?"
        description="Esta ação não pode ser desfeita."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(
      screen.getByText('Esta ação não pode ser desfeita.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows confirming state and disables actions', () => {
    render(
      <ConfirmDialog
        title="Remover vínculo?"
        description="Aguarde…"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        confirming
      />,
    )

    expect(screen.getByRole('button', { name: '…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })
})

describe('Modal focus edge cases', () => {
  it('handles Tab when dialog has no focusable elements', async () => {
    const user = userEvent.setup()
    render(
      <Modal title="Só texto" onClose={vi.fn()} size="sm" showCloseButton={false}>
        <p>Sem botões</p>
      </Modal>,
    )
    await user.tab()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
