import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeEntry, makeProfile } from '../test/fixtures'

const fetchPatientEntries = vi.fn()

vi.mock('../lib/entriesApi', () => ({
  fetchPatientEntries: (...args: unknown[]) => fetchPatientEntries(...args),
}))

vi.mock('../lib/historyStats', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/historyStats')>()
  return {
    ...actual,
    historyStatsFromEntries: vi.fn((entries, profile) => {
      const base = actual.historyStatsFromEntries(entries, profile)
      const flags = globalThis as {
        __forceNullPct?: boolean
        __forceAppliedNoAvg?: boolean
      }
      if (flags.__forceNullPct) {
        return {
          ...base,
          inRange70_180Percent: null,
          hypoPercent: null,
          hyperPercent: null,
          inTargetPercent: null,
          avgDoseDeltaU: null,
          doseDeltaCount: 0,
          appliedCount: 0,
          carbsCount: 0,
          minGlucose: null,
          maxGlucose: null,
          glucoseCvPercent: null,
          count: 0,
        }
      }
      if (flags.__forceAppliedNoAvg) {
        return {
          ...base,
          appliedCount: 2,
          avgAppliedU: null,
          totalAppliedU: 4,
          carbsCount: 0,
          avgDoseDeltaU: -1.5,
          doseDeltaCount: 1,
        }
      }
      if (flags.__forceCarbsOnly) {
        return {
          ...base,
          appliedCount: 0,
          avgAppliedU: null,
          totalAppliedU: 0,
          carbsCount: 1,
          avgCarbsG: 25,
        }
      }
      return base
    }),
  }
})

vi.mock('recharts', async () => {
  const React = await import('react')

  function invokeTooltip(props: {
    formatter?: (value: unknown, name: unknown) => unknown
    labelFormatter?: (label: unknown, payload: unknown) => unknown
  }) {
    props.formatter?.(120, 'glucose')
    props.formatter?.(null, 'recommended')
    props.formatter?.(Number.NaN, 'applied')
    props.formatter?.(3.5, 'recommended')
    props.formatter?.(2, 'applied')
    props.formatter?.(40, 'carbs')
    props.labelFormatter?.('x', [{ payload: { when: 'agora' } }])
    props.labelFormatter?.('x', [])
  }

  function ChartShell({
    children,
    data,
  }: {
    children?: React.ReactNode
    data?: unknown[]
  }) {
    const kids = React.Children.toArray(children)
    for (const child of kids) {
      if (!React.isValidElement(child)) continue
      const p = child.props as Record<string, unknown>
      if (typeof p.formatter === 'function' || typeof p.labelFormatter === 'function') {
        invokeTooltip(p as Parameters<typeof invokeTooltip>[0])
      }
      if (typeof p.dot === 'function') {
        ;(p.dot as (args: object) => unknown)({
          cx: 10,
          cy: 20,
          payload: {
            zone: 'hypo',
            glucose: 60,
            label: 'x',
            when: 'y',
            index: 0,
            target: null,
            readingCount: 1,
            aggregated: false,
          },
        })
        ;(p.dot as (args: object) => unknown)({
          cx: 10,
          cy: 20,
          payload: {
            zone: 'hyper',
            glucose: 200,
            label: 'x',
            when: 'y',
            index: 0,
            target: null,
            readingCount: 1,
            aggregated: false,
          },
        })
        ;(p.dot as (args: object) => unknown)({
          cx: 10,
          cy: 20,
          payload: {
            zone: 'inRange',
            glucose: 110,
            label: 'x',
            when: 'y',
            index: 0,
            target: null,
            readingCount: 1,
            aggregated: false,
          },
        })
        ;(p.dot as (args: object) => unknown)({})
      }
      if (typeof p.formatter === 'function' && child.type && String(child.type).includes('Legend') === false) {
        // already handled
      }
      if (typeof (child.type as { name?: string })?.name === 'string') {
        /* noop */
      }
      // Legend formatter
      if ('formatter' in p && typeof p.formatter === 'function' && !('labelFormatter' in p)) {
        ;(p.formatter as (v: string) => unknown)('recommended')
        ;(p.formatter as (v: string) => unknown)('applied')
      }
    }
    return React.createElement(
      'div',
      { 'data-testid': 'chart', 'data-count': data?.length ?? 0 },
      children,
    )
  }

  const passthrough =
    (name: string) =>
    (props: Record<string, unknown>) =>
      React.createElement('div', { 'data-testid': name }, props.children as React.ReactNode)

  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(
        'div',
        { style: { width: 800, height: 400 }, 'data-testid': 'ResponsiveContainer' },
        children,
      ),
    LineChart: ChartShell,
    BarChart: ChartShell,
    Line: passthrough('Line'),
    Bar: passthrough('Bar'),
    XAxis: passthrough('XAxis'),
    YAxis: passthrough('YAxis'),
    CartesianGrid: passthrough('CartesianGrid'),
    Tooltip: (props: Record<string, unknown>) => {
      invokeTooltip(props as Parameters<typeof invokeTooltip>[0])
      return React.createElement('div', { 'data-testid': 'Tooltip' })
    },
    Legend: (props: { formatter?: (v: string) => unknown }) => {
      props.formatter?.('recommended')
      props.formatter?.('applied')
      return React.createElement('div', { 'data-testid': 'Legend' })
    },
    ReferenceArea: passthrough('ReferenceArea'),
    ReferenceLine: passthrough('ReferenceLine'),
  }
})

import { PatientCharts, GlucoseDot, zoneStroke } from './PatientCharts'
import { resolveChartColors } from '../lib/chartTheme'

describe('zoneStroke / GlucoseDot', () => {
  const colors = resolveChartColors()

  it('maps zones to colors', () => {
    expect(zoneStroke('hypo', colors)).toBe(colors.danger)
    expect(zoneStroke('hyper', colors)).toBe(colors.warning)
    expect(zoneStroke('inRange', colors)).toBe(colors.ok)
  })

  it('returns null without coordinates or payload', () => {
    const { container, rerender } = render(
      <svg>
        <GlucoseDot colors={colors} />
      </svg>,
    )
    expect(container.querySelector('circle')).toBeNull()
    rerender(
      <svg>
        <GlucoseDot cx={1} cy={2} colors={colors} />
      </svg>,
    )
    expect(container.querySelector('circle')).toBeNull()
  })

  it('renders a circle for a valid point', () => {
    const { container } = render(
      <svg>
        <GlucoseDot
          cx={5}
          cy={6}
          colors={colors}
          payload={{
            index: 0,
            label: 'a',
            when: 'b',
            glucose: 60,
            zone: 'hypo',
            target: null,
            readingCount: 1,
            aggregated: false,
          }}
        />
      </svg>,
    )
    expect(container.querySelector('circle')).toBeTruthy()
  })
})

describe('PatientCharts', () => {
  beforeEach(() => {
    fetchPatientEntries.mockReset()
  })

  it('shows empty state', async () => {
    fetchPatientEntries.mockResolvedValue({ entries: [], total: null })
    render(<PatientCharts patientId="p1" profile={makeProfile()} />)
    expect(await screen.findByText('Sem dados no período')).toBeInTheDocument()
  })

  it('shows error and retries', async () => {
    const user = userEvent.setup()
    fetchPatientEntries
      .mockRejectedValueOnce(new Error('chart fail'))
      .mockResolvedValueOnce({ entries: [makeEntry()], total: null })
    render(<PatientCharts patientId="p1" profile={makeProfile()} />)
    expect(await screen.findByText('chart fail')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Resumo do período')).toBeInTheDocument()
  })

  it('changes period and maps non-Error failures', async () => {
    const user = userEvent.setup()
    fetchPatientEntries.mockRejectedValueOnce('nope')
    render(<PatientCharts patientId="p1" profile={makeProfile()} />)
    expect(
      await screen.findByText('Erro ao carregar gráficos.'),
    ).toBeInTheDocument()

    fetchPatientEntries.mockResolvedValue({
      entries: [makeEntry()],
      total: null,
    })
    await user.click(screen.getByRole('button', { name: '7 dias' }))
    await waitFor(() =>
      expect(fetchPatientEntries).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ period: 'days7' }),
      ),
    )
  })

  it('renders charts with night target, insulin and carbs empty branches', async () => {
    fetchPatientEntries.mockResolvedValue({
      entries: [
        makeEntry({
          glucose_mgdl: 90,
          recommended_insulin: null,
          applied_insulin: null,
          gpt_raw_response: null,
        }),
        makeEntry({
          id: 'e2',
          glucose_mgdl: 200,
          recommended_insulin: 5,
          applied_insulin: 4,
          gpt_raw_response: { carboidratos_g: 30 },
        }),
        makeEntry({
          id: 'e3',
          glucose_mgdl: 110,
          recommended_insulin: 2,
          applied_insulin: 2,
          gpt_raw_response: { carboidratos_g: 50 },
        }),
      ],
      total: null,
    })
    render(
      <PatientCharts
        patientId="p1"
        profile={makeProfile({
          target_glucose_mgdl: 110,
          target_night_mgdl: 130,
        })}
      />,
    )
    expect(await screen.findByText('Resumo do período')).toBeInTheDocument()
    expect(screen.getByText(/meta noite/)).toBeInTheDocument()
    expect(screen.getByText('Insulina')).toBeInTheDocument()
    expect(screen.getByText('Carbs estimados')).toBeInTheDocument()
  })

  it('shows empty insulin/carbs messages and stats without pairs', async () => {
    fetchPatientEntries.mockResolvedValue({
      entries: [
        makeEntry({
          recommended_insulin: null,
          applied_insulin: null,
          gpt_raw_response: null,
          glucose_mgdl: 100,
        }),
      ],
      total: null,
    })
    render(
      <PatientCharts
        patientId="p1"
        profile={makeProfile({
          target_glucose_mgdl: null,
          target_night_mgdl: null,
        })}
      />,
    )
    expect(
      await screen.findByText('Nenhuma dose registrada no período.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Sem estimativa TACO no período.')).toBeInTheDocument()
    expect(screen.getByText(/Sem pares/)).toBeInTheDocument()
  })

  it('covers ALL_LIMIT hint and single reading grammar', async () => {
    const entries = Array.from({ length: 200 }, (_, i) =>
      makeEntry({
        id: `e-${i}`,
        glucose_mgdl: 100 + (i % 5),
        recorded_at: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
      }),
    )
    fetchPatientEntries.mockResolvedValue({ entries, total: null })
    render(<PatientCharts patientId="p1" profile={makeProfile()} />)
    expect(await screen.findByText(/até 200 mais recentes/)).toBeInTheDocument()
  })

  it('covers single leitura grammar', async () => {
    fetchPatientEntries.mockResolvedValue({
      entries: [makeEntry({ glucose_mgdl: 100 })],
      total: null,
    })
    render(<PatientCharts patientId="p1" profile={makeProfile()} />)
    expect(await screen.findByText(/1 leitura ·/)).toBeInTheDocument()
  })

  it('renders null percent tiles as em dash', async () => {
    ;(globalThis as { __forceNullPct?: boolean }).__forceNullPct = true
    fetchPatientEntries.mockResolvedValue({
      entries: [makeEntry()],
      total: null,
    })
    render(<PatientCharts patientId="p1" profile={makeProfile()} />)
    expect(await screen.findByText('Resumo do período')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.getByText('Cadastre a meta no perfil')).toBeInTheDocument()
    ;(globalThis as { __forceNullPct?: boolean }).__forceNullPct = false
  })

  it('covers dose delta sign, footnote combos, and dense dots off', async () => {
    const many = Array.from({ length: 45 }, (_, i) =>
      makeEntry({
        id: `d-${i}`,
        glucose_mgdl: 100 + i,
        recommended_insulin: 2,
        applied_insulin: 3,
        gpt_raw_response: i === 0 ? { carboidratos_g: 20 } : null,
        recorded_at: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
      }),
    )
    fetchPatientEntries.mockResolvedValue({ entries: many, total: null })
    render(<PatientCharts patientId="p1" profile={makeProfile()} />)
    expect(await screen.findByText(/Insulina aplicada/)).toBeInTheDocument()
  })

  it('shows carbs-only footnote and negative dose delta', async () => {
    fetchPatientEntries.mockResolvedValue({
      entries: [
        makeEntry({
          recommended_insulin: 2,
          applied_insulin: 5,
          gpt_raw_response: { carboidratos_g: 10 },
        }),
      ],
      total: null,
    })
    render(<PatientCharts patientId="p1" profile={makeProfile()} />)
    expect(await screen.findByText(/Carbs médios/)).toBeInTheDocument()
    expect(screen.getAllByText(/1 refeição/).length).toBeGreaterThan(0)
  })

  it('shows insulin footnote without carbs and applied avg', async () => {
    ;(globalThis as { __forceAppliedNoAvg?: boolean }).__forceAppliedNoAvg =
      true
    fetchPatientEntries.mockResolvedValue({
      entries: [makeEntry(), makeEntry({ id: '2' })],
      total: null,
    })
    render(<PatientCharts patientId="p1" profile={makeProfile()} />)
    expect(await screen.findByText(/Insulina aplicada/)).toBeInTheDocument()
    expect(screen.queryByText(/\(média/)).not.toBeInTheDocument()
    ;(globalThis as { __forceAppliedNoAvg?: boolean }).__forceAppliedNoAvg =
      false
  })

  it('disables glucose dots when series has more than 40 points', async () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      makeEntry({
        id: `day-${i}`,
        glucose_mgdl: 100,
        recommended_insulin: null,
        applied_insulin: null,
        gpt_raw_response: null,
        recorded_at: new Date(Date.UTC(2023, 0, 1 + i, 15)).toISOString(),
      }),
    )
    fetchPatientEntries.mockResolvedValue({ entries: many, total: null })
    render(<PatientCharts patientId="p1" profile={makeProfile()} />)
    expect(await screen.findByText('Glicose')).toBeInTheDocument()
  })

  it('shows carbs-only footnote without insulin', async () => {
    ;(globalThis as { __forceCarbsOnly?: boolean }).__forceCarbsOnly = true
    fetchPatientEntries.mockResolvedValue({
      entries: [makeEntry()],
      total: null,
    })
    render(<PatientCharts patientId="p1" profile={makeProfile()} />)
    expect(await screen.findByText(/Carbs médios/)).toBeInTheDocument()
    expect(screen.queryByText(/Insulina aplicada/)).not.toBeInTheDocument()
    ;(globalThis as { __forceCarbsOnly?: boolean }).__forceCarbsOnly = false
  })
})
