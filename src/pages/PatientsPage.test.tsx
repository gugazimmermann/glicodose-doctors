import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { createAuthMock } from '../test/renderWithProviders'
import { createQueryBuilder } from '../test/supabaseMock'

const auth = createAuthMock()
const fromMock = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => auth,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { PatientsPage } from './PatientsPage'

const patientRow = {
  id: 'link-1',
  linked_at: '2024-06-01T00:00:00.000Z',
  profiles: {
    id: 'patient-1',
    full_name: 'José Silva',
    share_code: 'ABC123',
    target_glucose_mgdl: 110,
    target_night_mgdl: 120,
    isf_mgdl_per_u: 40,
    ic_ratio: 10,
    rapid_insulin_name: 'Humalog',
    diabetes_type: 'type_1',
  },
}

describe('PatientsPage', () => {
  beforeEach(() => {
    Object.assign(auth, createAuthMock())
    fromMock.mockReset()
  })

  it('shows empty state when no patients', async () => {
    fromMock.mockReturnValue(
      createQueryBuilder({ data: [], error: null }),
    )
    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/Nenhum paciente/i)).toBeInTheDocument()
  })

  it('loads patients, filters by accent-insensitive search, and sorts', async () => {
    const user = userEvent.setup()
    const rows = [
      patientRow,
      {
        id: 'link-2',
        linked_at: '2024-07-01T00:00:00.000Z',
        profiles: {
          ...patientRow.profiles,
          id: 'patient-2',
          full_name: null,
          share_code: 'XYZ999',
        },
      },
      {
        id: 'link-3',
        linked_at: '2024-05-01T00:00:00.000Z',
        profiles: [
          {
            ...patientRow.profiles,
            id: 'patient-3',
            full_name: 'Ana',
            share_code: 'ANA111',
          },
        ],
      },
      {
        id: 'link-4',
        linked_at: '2024-04-01T00:00:00.000Z',
        profiles: null,
      },
    ]
    fromMock.mockReturnValue(createQueryBuilder({ data: rows, error: null }))

    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText('José Silva')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/Buscar/i), 'jose')
    expect(screen.getByText('José Silva')).toBeInTheDocument()
    expect(screen.queryByText('Ana')).not.toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText(/Buscar/i))
    await user.selectOptions(screen.getByRole('combobox'), 'recent')
    const links = screen.getAllByRole('link')
    expect(links.some((l) => l.getAttribute('href')?.includes('patient-2'))).toBe(
      true,
    )
  })

  it('shows load error', async () => {
    fromMock.mockReturnValue(
      createQueryBuilder({ data: null, error: { message: 'fail load' } }),
    )
    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('fail load')).toBeInTheDocument()
  })

  it('confirms unlink and handles delete error', async () => {
    const user = userEvent.setup()
    const selectBuilder = createQueryBuilder({ data: [patientRow], error: null })
    const deleteBuilder = createQueryBuilder({
      data: null,
      error: { message: 'del fail' },
    })
    fromMock
      .mockReturnValueOnce(selectBuilder)
      .mockReturnValueOnce(deleteBuilder)

    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('José Silva')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Remover$/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Remover$/i }))
    const removers = screen.getAllByRole('button', { name: 'Remover' })
    await user.click(removers[removers.length - 1])
    await waitFor(() =>
      expect(screen.getByText('del fail')).toBeInTheDocument(),
    )
  })

  it('unlinks successfully and reloads', async () => {
    const user = userEvent.setup()
    const selectBuilder = createQueryBuilder({ data: [patientRow], error: null })
    const deleteOk = createQueryBuilder({ data: null, error: null })
    const selectEmpty = createQueryBuilder({ data: [], error: null })
    fromMock
      .mockReturnValueOnce(selectBuilder)
      .mockReturnValueOnce(deleteOk)
      .mockReturnValueOnce(selectEmpty)

    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('José Silva')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Remover$/i }))
    const confirmBtns = screen.getAllByRole('button', { name: 'Remover' })
    await user.click(confirmBtns[confirmBtns.length - 1])
    await waitFor(() =>
      expect(screen.queryByText('José Silva')).not.toBeInTheDocument(),
    )
  })

  it('dismisses load error and clears search', async () => {
    const user = userEvent.setup()
    fromMock.mockReturnValue(
      createQueryBuilder({ data: [patientRow], error: null }),
    )
    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('José Silva')).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText(/Buscar/i), 'zzz')
    expect(screen.getByText('Nenhum paciente encontrado')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Limpar busca' }))
    expect(screen.getByText('José Silva')).toBeInTheDocument()
  })

  it('dismisses error alert', async () => {
    const user = userEvent.setup()
    fromMock.mockReturnValue(
      createQueryBuilder({ data: null, error: { message: 'fail load' } }),
    )
    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('fail load')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('fail load')).not.toBeInTheDocument()
  })

  it('does nothing when doctor is missing', () => {
    auth.doctor = null
    fromMock.mockReturnValue(createQueryBuilder({ data: [], error: null }))
    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    )
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('maps null data on successful load to empty list', async () => {
    fromMock.mockReturnValue(
      createQueryBuilder({ data: null, error: null }),
    )
    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/Nenhum paciente/i)).toBeInTheDocument()
  })

  it('confirm dialog falls back when patient has no name', async () => {
    const user = userEvent.setup()
    const row = {
      id: 'link-anon',
      linked_at: '2024-06-01T00:00:00.000Z',
      profiles: {
        ...patientRow.profiles,
        id: 'p-anon',
        full_name: '   ',
        share_code: 'NONAME',
      },
    }
    fromMock.mockReturnValue(createQueryBuilder({ data: [row], error: null }))
    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Paciente sem nome')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Remover$/i }))
    expect(screen.getByText(/Este paciente/)).toBeInTheDocument()
  })
})
