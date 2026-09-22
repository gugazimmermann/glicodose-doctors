import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { makeEntry, makeProfile } from '../test/fixtures'
import { createQueryBuilder } from '../test/supabaseMock'

const fromMock = vi.fn()
const fetchPatientEntries = vi.fn()
const getUserMock = vi.fn().mockResolvedValue({
  data: { user: { id: 'doctor-1' } },
  error: null,
})

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
  },
}))

vi.mock('../lib/entriesApi', () => ({
  fetchPatientEntries: (...args: unknown[]) => fetchPatientEntries(...args),
}))

vi.mock('../components/PatientCharts', () => ({
  PatientCharts: () => <div>Charts mock</div>,
}))

vi.mock('../components/PatientHistoryAiPanel', () => ({
  PatientHistoryAiPanel: () => <div>AI panel mock</div>,
}))

vi.mock('../components/PatientAlertsPanel', () => ({
  PatientAlertsPanel: () => <div>Alerts mock</div>,
}))

vi.mock('../components/EntryDetailModal', () => ({
  EntryDetailModal: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog">
      Detalhe mock
      <button type="button" onClick={onClose}>
        Fechar mock
      </button>
    </div>
  ),
}))

import { PatientDetailPage } from './PatientDetailPage'

function renderDetail(id = 'patient-1') {
  return render(
    <MemoryRouter initialEntries={[`/pacientes/${id}`]}>
      <Routes>
        <Route path="/pacientes/:patientId" element={<PatientDetailPage />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PatientDetailPage', () => {
  beforeEach(() => {
    fromMock.mockReset()
    fetchPatientEntries.mockReset()
    fetchPatientEntries.mockResolvedValue({
      entries: [makeEntry({ glucose_mgdl: 142 })],
      total: 55,
    })
  })

  it('shows not found when profile missing', async () => {
    fromMock.mockReturnValue(createQueryBuilder({ data: null, error: null }))
    renderDetail()
    expect(
      await screen.findByText('Paciente não encontrado ou sem vínculo.'),
    ).toBeInTheDocument()
  })

  it('shows profile error', async () => {
    fromMock.mockReturnValue(
      createQueryBuilder({ data: null, error: { message: 'profile err' } }),
    )
    renderDetail()
    expect(await screen.findByText('profile err')).toBeInTheDocument()
  })

  it('loads patient, opens entry modal, paginates and sorts', async () => {
    const user = userEvent.setup()
    const profile = makeProfile({ full_name: 'Paciente X' })
    fromMock.mockReturnValue(createQueryBuilder({ data: profile, error: null }))

    renderDetail()
    expect(await screen.findByText('Paciente X')).toBeInTheDocument()
    const food = await screen.findAllByText('Almoço')
    await user.click(food[0].closest('button')!)
    expect(screen.getByText('Detalhe mock')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fechar mock' }))
    expect(screen.queryByText('Detalhe mock')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByDisplayValue('Mais recentes'), 'oldest')
    await waitFor(() =>
      expect(fetchPatientEntries).toHaveBeenCalledWith(
        'patient-1',
        expect.objectContaining({ sort: 'oldest', page: 0 }),
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Próxima' }))
    await waitFor(() =>
      expect(fetchPatientEntries).toHaveBeenCalledWith(
        'patient-1',
        expect.objectContaining({ page: 1 }),
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Anterior' }))
  })

  it('validates and saves prescription', async () => {
    const user = userEvent.setup()
    const profile = makeProfile()
    const updated = { ...profile, target_glucose_mgdl: 115 }
    fromMock.mockImplementation(() =>
      createQueryBuilder({ data: profile, error: null }),
    )

    renderDetail()
    expect(await screen.findByText('Paciente Teste')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Prescrição' }))
    const form = screen.getByRole('tabpanel')
    const insulin = screen.getByLabelText(/Insulina rápida/)
    await user.clear(insulin)
    fireEvent.submit(form)
    expect(
      await screen.findByText('Informe o nome da insulina rápida.'),
    ).toBeInTheDocument()

    await user.type(insulin, 'NovoRapid')
    await user.clear(screen.getByLabelText(/Meta dia/))
    await user.type(screen.getByLabelText(/Meta dia/), '0')
    fireEvent.submit(form)
    expect(
      await screen.findByText(/Meta dia deve ser um número maior que zero/),
    ).toBeInTheDocument()

    fromMock.mockImplementation(() =>
      createQueryBuilder({ data: updated, error: null }),
    )
    await user.clear(screen.getByLabelText(/Meta dia/))
    await user.type(screen.getByLabelText(/Meta dia/), '115')
    fireEvent.submit(form)
    await waitFor(() =>
      expect(screen.getByText('Prescrição atualizada.')).toBeInTheDocument(),
    )
  })

  it('loads and saves basal insulin fields', async () => {
    const user = userEvent.setup()
    const profile = makeProfile({
      basal_insulin_name: 'Lantus',
      basal_dose_u: 12,
      basal_times_minutes: [22 * 60],
    })
    const updated = {
      ...profile,
      basal_insulin_name: 'Tresiba',
      basal_dose_u: 14,
      basal_times_minutes: [22 * 60, 8 * 60],
    }
    let updatePayload: Record<string, unknown> | null = null
    fromMock.mockImplementation(() => {
      const builder = createQueryBuilder({ data: profile, error: null })
      ;(builder.update as ReturnType<typeof vi.fn>).mockImplementation(
        (payload: Record<string, unknown>) => {
          updatePayload = payload
          return createQueryBuilder({ data: updated, error: null })
        },
      )
      return builder
    })

    renderDetail()
    expect(await screen.findByText('Paciente Teste')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Prescrição' }))

    expect(screen.getByLabelText(/Insulina basal/)).toHaveValue('Lantus')
    expect(screen.getByLabelText(/Dose padrão basal/)).toHaveValue(12)
    expect(screen.getByLabelText('Horário basal 1')).toHaveValue('22:00')

    await user.clear(screen.getByLabelText(/Insulina basal/))
    await user.type(screen.getByLabelText(/Insulina basal/), 'Tresiba')
    await user.clear(screen.getByLabelText(/Dose padrão basal/))
    await user.type(screen.getByLabelText(/Dose padrão basal/), '14')
    await user.click(screen.getByRole('button', { name: 'Adicionar horário' }))
    await user.type(screen.getByLabelText('Horário basal 2'), '08:00')

    fireEvent.submit(screen.getByRole('tabpanel'))
    await waitFor(() =>
      expect(screen.getByText('Prescrição atualizada.')).toBeInTheDocument(),
    )
    expect(updatePayload).toEqual(
      expect.objectContaining({
        basal_insulin_name: 'Tresiba',
        basal_dose_u: 14,
        basal_times_minutes: [8 * 60, 22 * 60],
      }),
    )
  })

  it('rejects duplicate basal times', async () => {
    const user = userEvent.setup()
    const profile = makeProfile({ basal_times_minutes: [22 * 60] })
    fromMock.mockReturnValue(createQueryBuilder({ data: profile, error: null }))

    renderDetail()
    expect(await screen.findByText('Paciente Teste')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Prescrição' }))
    await user.click(screen.getByRole('button', { name: 'Adicionar horário' }))
    await user.type(screen.getByLabelText('Horário basal 2'), '22:00')
    fireEvent.submit(screen.getByRole('tabpanel'))
    expect(
      await screen.findByText('Horários da basal não podem ser duplicados.'),
    ).toBeInTheDocument()
  })

  it('handles save failure and charts tab', async () => {
    const user = userEvent.setup()
    const profile = makeProfile()
    let call = 0
    fromMock.mockImplementation(() => {
      call += 1
      if (call === 1) return createQueryBuilder({ data: profile, error: null })
      return createQueryBuilder({
        data: null,
        error: Object.assign(new Error('save boom'), { message: 'save boom' }),
      })
    })

    renderDetail()
    expect(await screen.findByText('Paciente Teste')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Prescrição' }))
    fireEvent.submit(screen.getByRole('tabpanel'))
    expect(await screen.findByText('save boom')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Gráficos' }))
    expect(screen.getByText('Charts mock')).toBeInTheDocument()
  })

  it('shows history fetch error', async () => {
    fromMock.mockReturnValue(
      createQueryBuilder({ data: makeProfile(), error: null }),
    )
    fetchPatientEntries.mockRejectedValueOnce(new Error('hist fail'))
    renderDetail()
    expect(await screen.findByText('hist fail')).toBeInTheDocument()
  })

  it('covers profile resolveTarget with night and keyboard entry open', async () => {
    const user = userEvent.setup()
    const profile = makeProfile({ full_name: null })
    fromMock.mockReturnValue(createQueryBuilder({ data: profile, error: null }))
    fetchPatientEntries.mockResolvedValue({
      entries: [
        makeEntry({
          food_text: null,
          food_image_path: 'photo.jpg',
          glucose_mgdl: 142,
        }),
      ],
      total: 1,
    })
    renderDetail()
    expect(await screen.findByText('Paciente sem nome')).toBeInTheDocument()
    expect(await screen.findByText('Foto anexada')).toBeInTheDocument()

    const tableRow = document.querySelector(
      'tr[role="button"]',
    ) as HTMLElement | null
    if (tableRow) {
      await user.click(tableRow)
      expect(screen.getByText('Detalhe mock')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Fechar mock' }))
      tableRow.focus()
      await user.keyboard('{Enter}')
      expect(screen.getByText('Detalhe mock')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Fechar mock' }))
      tableRow.focus()
      await user.keyboard(' ')
      expect(screen.getByText('Detalhe mock')).toBeInTheDocument()
    } else {
      await user.click(screen.getAllByText('Foto anexada')[0].closest('button')!)
      expect(screen.getByText('Detalhe mock')).toBeInTheDocument()
    }
  })

  it('shows empty history and save missing data', async () => {
    const user = userEvent.setup()
    const profile = makeProfile()
    fromMock.mockImplementation(() =>
      createQueryBuilder({ data: null, error: null }),
    )
    // First call profile, then update with null data
    let n = 0
    fromMock.mockImplementation(() => {
      n += 1
      if (n === 1) return createQueryBuilder({ data: profile, error: null })
      return createQueryBuilder({ data: null, error: null })
    })
    fetchPatientEntries.mockResolvedValue({ entries: [], total: 0 })
    renderDetail()
    expect(await screen.findByText('Nenhum registro ainda.')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Prescrição' }))
    fireEvent.submit(screen.getByRole('tabpanel'))
    expect(
      await screen.findByText(/Não foi possível salvar/),
    ).toBeInTheDocument()
  })

  it('dismisses save alerts', async () => {
    const user = userEvent.setup()
    const profile = makeProfile()
    fromMock.mockReturnValue(createQueryBuilder({ data: profile, error: null }))
    renderDetail()
    expect(await screen.findByText('Paciente Teste')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Prescrição' }))
    const form = screen.getByRole('tabpanel')
    fromMock.mockReturnValue(
      createQueryBuilder({
        data: { ...profile, target_glucose_mgdl: 111 },
        error: null,
      }),
    )
    fireEvent.submit(form)
    expect(await screen.findByText('Prescrição atualizada.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('Prescrição atualizada.')).not.toBeInTheDocument()
  })

  it('edits prescription fields and dismisses save error', async () => {
    const user = userEvent.setup()
    const profile = makeProfile({
      target_glucose_mgdl: null,
      target_night_mgdl: null,
      isf_mgdl_per_u: null,
      ic_ratio: null,
      rapid_insulin_name: null,
    })
    let n = 0
    fromMock.mockImplementation(() => {
      n += 1
      if (n === 1) return createQueryBuilder({ data: profile, error: null })
      return createQueryBuilder({ data: null, error: new Error('save-err') })
    })
    renderDetail()
    expect(await screen.findByText('Paciente Teste')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Prescrição' }))

    await user.type(screen.getByLabelText(/Meta dia/), '100')
    await user.type(screen.getByLabelText(/Meta noite/), '110')
    await user.type(screen.getByLabelText(/^FSI/), '40')
    await user.type(screen.getByLabelText(/I:C/), '12')
    await user.type(screen.getByLabelText(/Insulina rápida/), 'Apidra')

    fireEvent.submit(screen.getByRole('tabpanel'))
    expect(await screen.findByText('save-err')).toBeInTheDocument()
    await user.click(
      screen
        .getByText('save-err')
        .closest('[role="alert"]')!
        .querySelector('button')!,
    )
    expect(screen.queryByText('save-err')).not.toBeInTheDocument()
  })

  it('no-ops when patientId is missing from the route', () => {
    fromMock.mockReturnValue(createQueryBuilder({ data: makeProfile(), error: null }))
    render(
      <MemoryRouter initialEntries={['/pacientes']}>
        <Routes>
          <Route path="/pacientes" element={<PatientDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('ignores profile result after unmount', async () => {
    let resolveProfile!: (v: unknown) => void
    const pending = new Promise((resolve) => {
      resolveProfile = resolve
    })
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockReturnThis(),
      then: (onFulfilled: (v: unknown) => unknown) => pending.then(onFulfilled),
    })
    const { unmount } = renderDetail()
    unmount()
    await act(async () => {
      resolveProfile({ data: makeProfile(), error: null })
    })
  })

  it('covers history food fallbacks and ignores unrelated keys', async () => {
    const user = userEvent.setup()
    fromMock.mockReturnValue(
      createQueryBuilder({ data: makeProfile(), error: null }),
    )
    fetchPatientEntries.mockResolvedValue({
      entries: [
        makeEntry({
          food_text: '   ',
          food_image_path: null,
          glucose_mgdl: 99,
        }),
      ],
      total: 1,
    })
    renderDetail()
    expect(await screen.findByText('99')).toBeInTheDocument()
    const tableRow = await screen.findByRole('row', { name: /99/ }).catch(() =>
      document.querySelector('tr[role="button"]'),
    )
    if (tableRow instanceof HTMLElement) {
      tableRow.focus()
      await user.keyboard('a')
      expect(screen.queryByText('Detalhe mock')).not.toBeInTheDocument()
    }
  })
})
