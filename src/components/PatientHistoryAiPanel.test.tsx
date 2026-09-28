import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDoctor, makeProfile } from '../test/fixtures'
import { createAuthMock } from '../test/renderWithProviders'
import type { HistoryAiStats } from '../lib/analyzeHistoryApi'
import { PatientHistoryAiPanel } from './PatientHistoryAiPanel'

const useAuth = vi.fn()
const analyzePatientHistory = vi.fn()
const listPatientAiAnalyses = vi.fn()

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => useAuth(),
}))

vi.mock('../lib/analyzeHistoryApi', () => ({
  analyzePatientHistory: (...args: unknown[]) => analyzePatientHistory(...args),
  listPatientAiAnalyses: (...args: unknown[]) => listPatientAiAnalyses(...args),
  mapSugestaoToProfilePatch: () => null,
}))

function renderPanel(ui: ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/pacientes/1']}>
      <Routes>
        <Route path="/pacientes/1" element={ui} />
        <Route path="/apoiar" element={<div>Página apoiar</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const baseStats: HistoryAiStats = {
  count: 4,
  avgGlucose: 130,
  minGlucose: 50,
  maxGlucose: 260,
  glucoseSd: 40,
  glucoseCvPercent: 30,
  inRange70_180Percent: 50,
  hypoPercent: 25,
  hypoCount: 1,
  hyperPercent: 25,
  hyperCount: 1,
  inTargetPercent: 50,
  avgAppliedU: 4,
  avgRecommendedU: 5,
  avgDoseDeltaU: 1,
  avgCarbsG: 40,
}

const highlightedStats: HistoryAiStats = {
  ...baseStats,
  severeHypoCount: 1,
  severeHypoPercent: 25,
  doseGapCount: 2,
  doseGapPercent: 66.7,
  appliedLessCount: 2,
  appliedMoreCount: 0,
  day: {
    count: 3,
    avgGlucose: 148.3,
    inRange70_180Percent: 33.3,
    hypoCount: 1,
    severeHypoCount: 0,
  },
  night: {
    count: 0,
    avgGlucose: null,
    inRange70_180Percent: null,
    hypoCount: 0,
    severeHypoCount: 0,
  },
}

describe('PatientHistoryAiPanel', () => {
  beforeEach(() => {
    analyzePatientHistory.mockReset()
    listPatientAiAnalyses.mockReset()
    listPatientAiAnalyses.mockResolvedValue([])
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({ supporter_status: 'none' }),
      }),
    )
  })

  it('warns non-supporters and does not load or run analysis', async () => {
    const user = userEvent.setup()
    renderPanel(
      <PatientHistoryAiPanel
        patientId="patient-1"
        profile={makeProfile()}
        onApplySuggestion={() => undefined}
      />,
    )

    expect(
      screen.getByText(
        'A Análise com IA está disponível para médicos que apoiam o GlicoDose.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Analisar com IA' }),
    ).not.toBeInTheDocument()
    expect(listPatientAiAnalyses).not.toHaveBeenCalled()
    expect(analyzePatientHistory).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Quero apoiar' }))
    expect(await screen.findByText('Página apoiar')).toBeInTheDocument()
  })

  it('lets a supporter analyze and shows the clinical highlights', async () => {
    const user = userEvent.setup()
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({ supporter_status: 'active' }),
      }),
    )
    analyzePatientHistory.mockResolvedValue({
      period: 'days30',
      entryCount: 4,
      stats: highlightedStats,
      analysis: {
        resumo: 'Hipo noturna isolada.',
        achados: [],
        sugestoes_prescricao: [],
        disclaimer: 'Apoio clínico.',
      },
      analysisId: 'analysis-1',
    })

    renderPanel(
      <PatientHistoryAiPanel
        patientId="patient-1"
        profile={makeProfile()}
        onApplySuggestion={() => undefined}
      />,
    )

    expect(
      await screen.findByText('Nenhuma análise salva ainda.'),
    ).toBeInTheDocument()
    expect(listPatientAiAnalyses).toHaveBeenCalledWith('patient-1')

    await user.click(screen.getByRole('button', { name: 'Analisar com IA' }))

    expect(await screen.findByText('Hipo noturna isolada.')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Prioridades da consulta' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Tempo 70–180')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Hipo < 54')).toBeInTheDocument()
    expect(screen.getByText('1 (25%)')).toBeInTheDocument()
    expect(screen.getByText('30%')).toBeInTheDocument()
    expect(screen.getByText('66.7% · 2 a menos, 0 a mais')).toBeInTheDocument()
    expect(screen.getByText('sem registros')).toBeInTheDocument()
    expect(analyzePatientHistory).toHaveBeenCalledWith({
      patientId: 'patient-1',
      period: 'days30',
    })
  })

  it('hides the numeric block on analyses saved before the extra stats', async () => {
    const user = userEvent.setup()
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({ supporter_status: 'grace' }),
      }),
    )
    analyzePatientHistory.mockResolvedValue({
      period: 'days7',
      entryCount: 2,
      stats: baseStats,
      analysis: {
        resumo: 'Texto antigo.',
        achados: [],
        sugestoes_prescricao: [],
        disclaimer: '',
      },
    })

    renderPanel(
      <PatientHistoryAiPanel
        patientId="patient-1"
        profile={makeProfile()}
        onApplySuggestion={() => undefined}
      />,
    )

    await screen.findByRole('button', { name: 'Analisar com IA' })
    await user.selectOptions(screen.getByRole('combobox'), 'days7')
    await user.click(screen.getByRole('button', { name: 'Analisar com IA' }))

    expect(await screen.findByText('Texto antigo.')).toBeInTheDocument()
    expect(screen.queryByText('Hipo < 54')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Prioridades da consulta' }),
    ).not.toBeInTheDocument()
    expect(analyzePatientHistory).toHaveBeenCalledWith({
      patientId: 'patient-1',
      period: 'days7',
    })
  })

  it('shows visit priorities and hides the section when a saved analysis has none', async () => {
    const user = userEvent.setup()
    useAuth.mockReturnValue(
      createAuthMock({
        doctor: makeDoctor({ supporter_status: 'active' }),
      }),
    )
    listPatientAiAnalyses.mockResolvedValue([
      {
        id: 'old-analysis',
        period: 'days30',
        entry_count: 2,
        created_at: '2026-09-01T12:00:00.000Z',
        stats: baseStats,
        analysis: {
          resumo: 'Análise antiga sem prioridades.',
          achados: [],
          sugestoes_prescricao: [],
          disclaimer: '',
        },
      },
    ])
    analyzePatientHistory.mockResolvedValue({
      period: 'days30',
      entryCount: 4,
      stats: highlightedStats,
      analysis: {
        resumo: 'Controle instável no almoço.',
        prioridades: [
          {
            titulo: 'Revisar I:C do almoço',
            porque: 'Média de 210 mg/dL em 8 registros.',
            o_que_fazer: 'Confirmar se a faixa do meio-dia subestima o bolus.',
          },
        ],
        achados: [],
        sugestoes_prescricao: [],
        disclaimer: 'Apoio clínico.',
      },
      analysisId: 'analysis-2',
    })

    renderPanel(
      <PatientHistoryAiPanel
        patientId="patient-1"
        profile={makeProfile()}
        onApplySuggestion={() => undefined}
      />,
    )

    await user.click(
      await screen.findByRole('button', { name: /30 dias · 2 registros/ }),
    )
    expect(
      await screen.findByText('Análise antiga sem prioridades.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Prioridades da consulta' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Analisar com IA' }))

    expect(
      await screen.findByRole('heading', { name: 'Prioridades da consulta' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1. Revisar I:C do almoço')).toBeInTheDocument()
    expect(
      screen.getByText('Média de 210 mg/dL em 8 registros.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Confirmar se a faixa do meio-dia subestima o bolus.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('2.')).not.toBeInTheDocument()
  })
})
