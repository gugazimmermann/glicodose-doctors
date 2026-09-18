import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const rpc = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
  },
}))

import { LinkPatientPage } from './LinkPatientPage'

describe('LinkPatientPage', () => {
  beforeEach(() => {
    rpc.mockReset()
  })

  it('validates code length', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LinkPatientPage />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('Código do paciente'), 'AB')
    await user.click(screen.getByRole('button', { name: 'Vincular' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Digite um código de 6 caracteres',
    )
    expect(rpc).not.toHaveBeenCalled()
  })

  it('links patient and shows named success', async () => {
    const user = userEvent.setup()
    rpc.mockResolvedValue({
      data: [{ id: 'p1', full_name: 'Ana' }],
      error: null,
    })
    render(
      <MemoryRouter>
        <LinkPatientPage />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('Código do paciente'), 'abc123')
    await user.click(screen.getByRole('button', { name: 'Vincular' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Paciente Ana vinculado.',
      ),
    )
    expect(rpc).toHaveBeenCalledWith('link_patient_by_code', {
      p_code: 'ABC123',
    })
  })

  it('maps rpc errors', async () => {
    const user = userEvent.setup()
    const cases = [
      ['patient not found', 'Código não encontrado.'],
      ['invalid share code', 'Código inválido'],
      ['cannot link to yourself', 'próprio código'],
      ['doctor profile required', 'Perfil de médico necessário'],
      ['other', 'other'],
    ] as const

    for (const [msg, expected] of cases) {
      rpc.mockResolvedValueOnce({
        data: null,
        error: new Error(msg),
      })
      const { unmount } = render(
        <MemoryRouter>
          <LinkPatientPage />
        </MemoryRouter>,
      )
      await user.type(screen.getByLabelText('Código do paciente'), 'ABC123')
      await user.click(screen.getByRole('button', { name: 'Vincular' }))
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toMatch(
          new RegExp(expected, 'i'),
        ),
      )
      unmount()
    }

    rpc.mockResolvedValueOnce({ data: null, error: 'x' })
    render(
      <MemoryRouter>
        <LinkPatientPage />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('Código do paciente'), 'ABC123')
    await user.click(screen.getByRole('button', { name: 'Vincular' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não foi possível vincular o paciente.',
      ),
    )
  })

  it('dismisses success and error alerts', async () => {
    const user = userEvent.setup()
    rpc.mockResolvedValue({
      data: [{ id: 'p1', full_name: 'Ana' }],
      error: null,
    })
    render(
      <MemoryRouter>
        <LinkPatientPage />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('Código do paciente'), 'ABC123')
    await user.click(screen.getByRole('button', { name: 'Vincular' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Ana'),
    )
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText(/Ana/)).not.toBeInTheDocument()
  })

  it('shows generic success without name', async () => {
    const user = userEvent.setup()
    rpc.mockResolvedValue({
      data: [{ id: 'p1', full_name: null }],
      error: null,
    })
    render(
      <MemoryRouter>
        <LinkPatientPage />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('Código do paciente'), 'ZZZZZZ')
    await user.click(screen.getByRole('button', { name: 'Vincular' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Paciente vinculado com sucesso.',
      ),
    )
  })

  it('dismisses error alert via onDismiss', async () => {
    const user = userEvent.setup()
    rpc.mockResolvedValue({
      data: null,
      error: new Error('patient not found'),
    })
    render(
      <MemoryRouter>
        <LinkPatientPage />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('Código do paciente'), 'ABC123')
    await user.click(screen.getByRole('button', { name: 'Vincular' }))
    expect(await screen.findByText('Código não encontrado.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('Código não encontrado.')).not.toBeInTheDocument()
  })

  it('handles non-array rpc data as anonymous success', async () => {
    const user = userEvent.setup()
    rpc.mockResolvedValue({ data: { id: 'x' }, error: null })
    render(
      <MemoryRouter>
        <LinkPatientPage />
      </MemoryRouter>,
    )
    await user.type(screen.getByLabelText('Código do paciente'), 'ABC123')
    await user.click(screen.getByRole('button', { name: 'Vincular' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Paciente vinculado com sucesso.',
      ),
    )
  })
})
