import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBrazilDateTime, formatDose } from '../lib/format'
import {
  HISTORY_PERIOD_LABELS,
  HISTORY_PERIODS,
  historyPeriodSince,
  type HistoryPeriod,
} from '../lib/historyPeriod'
import {
  historyStatsFromEntries,
  type HistoryStats,
} from '../lib/historyStats'
import { supabase } from '../lib/supabase'
import type { Entry, Profile } from '../types/database'

type PatientChartsProps = {
  patientId: string
  profile: Profile
}

const ALL_LIMIT = 200
const BRAND = '#1a6f9a'
const ACCENT = '#0f4d6e'
const MUTED = '#5a6b7d'
const LINE = '#c9d6e2'

function formatWhole(value: number | null | undefined, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return '—'
  const rounded = Math.round(value * 10) / 10
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1)
  return `${text}${suffix}`
}

function shortDateLabel(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso))
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string | null
}) {
  return (
    <div className="rounded-xl border border-line bg-surface/80 px-3 py-3">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1.5 truncate text-base font-extrabold text-ink">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 truncate text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

function StatsSummary({ stats }: { stats: HistoryStats }) {
  const fmtPct =
    stats.inTargetPercent == null
      ? '—'
      : `${Math.round(stats.inTargetPercent)}%`

  const deltaLabel =
    stats.avgDoseDeltaU == null
      ? '—'
      : `${stats.avgDoseDeltaU > 0 ? '+' : ''}${formatWhole(stats.avgDoseDeltaU)} U`

  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold text-ink">Resumo do período</h3>
      <p className="mt-1 text-sm text-muted">
        {stats.count} registro{stats.count === 1 ? '' : 's'}
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <MetricTile
          label="Glicose média"
          value={formatWhole(stats.avgGlucose, ' mg/dL')}
          hint={
            stats.minGlucose != null && stats.maxGlucose != null
              ? `${stats.minGlucose}–${stats.maxGlucose} mg/dL`
              : null
          }
        />
        <MetricTile
          label="Na meta (±20%)"
          value={fmtPct}
          hint={
            stats.inTargetPercent == null
              ? 'Cadastre a meta no perfil'
              : `${stats.inTargetCount} de ${stats.count}`
          }
        />
        <MetricTile
          label="Insulina aplicada"
          value={formatWhole(stats.totalAppliedU, ' U')}
          hint={
            stats.avgAppliedU == null
              ? null
              : `Média ${formatWhole(stats.avgAppliedU)} U`
          }
        />
        <MetricTile
          label="Desvio vs recomendada"
          value={deltaLabel}
          hint={
            stats.doseDeltaCount === 0
              ? 'Sem pares para comparar'
              : 'Média rec. − aplicada'
          }
        />
        <MetricTile
          label="Carbs médios"
          value={formatWhole(stats.avgCarbsG, ' g')}
          hint={
            stats.carbsCount === 0
              ? 'Sem estimativa TACO'
              : `${stats.carbsCount} refeição${stats.carbsCount === 1 ? '' : 'ões'}`
          }
        />
        <MetricTile
          label="Insulina recomendada"
          value={formatWhole(stats.totalRecommendedU, ' U')}
          hint={`${stats.recommendedCount} dose${stats.recommendedCount === 1 ? '' : 's'}`}
        />
      </div>
    </div>
  )
}

export function PatientCharts({ patientId, profile }: PatientChartsProps) {
  const [period, setPeriod] = useState<HistoryPeriod>('days30')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const since = historyPeriodSince(period)
    let query = supabase
      .from('entries')
      .select('*')
      .eq('user_id', patientId)
      .order('recorded_at', { ascending: true })

    if (since) {
      query = query.gte('recorded_at', since.toISOString())
    } else {
      query = query.limit(ALL_LIMIT)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setEntries([])
    } else {
      setEntries((data ?? []) as Entry[])
    }
    setLoading(false)
  }, [patientId, period])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(
    () => historyStatsFromEntries(entries, profile),
    [entries, profile],
  )

  const glucoseData = useMemo(
    () =>
      entries.map((e, i) => ({
        index: i,
        label: shortDateLabel(e.recorded_at),
        when: formatBrazilDateTime(e.recorded_at),
        glucose: e.glucose_mgdl,
      })),
    [entries],
  )

  const insulinData = useMemo(
    () =>
      entries
        .filter(
          (e) => e.recommended_insulin != null || e.applied_insulin != null,
        )
        .map((e, i) => ({
          index: i,
          label: shortDateLabel(e.recorded_at),
          when: formatBrazilDateTime(e.recorded_at),
          recommended: e.recommended_insulin ?? 0,
          applied: e.applied_insulin ?? 0,
          hasRecommended: e.recommended_insulin != null,
          hasApplied: e.applied_insulin != null,
        })),
    [entries],
  )

  const dayTarget = stats.dayTargetMgdl

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {HISTORY_PERIODS.map((p) => {
          const selected = p === period
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                selected
                  ? 'border-brand bg-brand-soft text-brand-dark'
                  : 'border-line bg-white text-ink hover:border-brand/50'
              }`}
            >
              {HISTORY_PERIOD_LABELS[p]}
            </button>
          )
        })}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando gráficos…</p>
      ) : error ? (
        <div className="space-y-3 rounded-2xl border border-line bg-card p-5">
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            Tentar novamente
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card/60 px-5 py-10 text-center">
          <p className="text-sm font-semibold text-muted">
            Sem dados no período
          </p>
        </div>
      ) : (
        <>
          <StatsSummary stats={stats} />

          <div className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
            <h3 className="text-sm font-semibold text-ink">Glicose</h3>
            {dayTarget != null ? (
              <p className="mt-1 text-xs text-muted">
                Linha guia: meta dia {dayTarget} mg/dL
              </p>
            ) : null}
            <div className="mt-3 h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={glucoseData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke={LINE} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: MUTED, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: LINE }}
                    interval="preserveStartEnd"
                    minTickGap={28}
                  />
                  <YAxis
                    tick={{ fill: MUTED, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: LINE }}
                    width={40}
                    domain={['dataMin - 20', 'dataMax + 20']}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: LINE,
                      fontSize: 12,
                    }}
                    formatter={(value) => [
                      `${Number(value)} mg/dL`,
                      'Glicose',
                    ]}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.when ?? ''
                    }
                  />
                  {dayTarget != null ? (
                    <ReferenceLine
                      y={dayTarget}
                      stroke={MUTED}
                      strokeDasharray="6 4"
                      strokeOpacity={0.7}
                    />
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="glucose"
                    stroke={BRAND}
                    strokeWidth={3}
                    dot={glucoseData.length <= 40}
                    activeDot={{ r: 5 }}
                    fill={BRAND}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5">
            <h3 className="text-sm font-semibold text-ink">Insulina</h3>
            {insulinData.length === 0 ? (
              <p className="mt-3 text-sm text-muted">
                Nenhuma dose registrada no período.
              </p>
            ) : (
              <div className="mt-3 h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={insulinData}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke={LINE}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: MUTED, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: LINE }}
                      interval="preserveStartEnd"
                      minTickGap={28}
                    />
                    <YAxis
                      tick={{ fill: MUTED, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: LINE }}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        borderColor: LINE,
                        fontSize: 12,
                      }}
                      formatter={(value, name, item) => {
                        const row = item?.payload as
                          | {
                              hasRecommended?: boolean
                              hasApplied?: boolean
                            }
                          | undefined
                        const missing =
                          name === 'recommended'
                            ? !row?.hasRecommended
                            : !row?.hasApplied
                        if (missing) return ['—', name === 'recommended' ? 'Rec.' : 'Apl.']
                        return [
                          `${formatDose(Number(value))} U`,
                          name === 'recommended' ? 'Rec.' : 'Apl.',
                        ]
                      }}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.when ?? ''
                      }
                    />
                    <Legend
                      formatter={(value) =>
                        value === 'recommended' ? 'Recomendada' : 'Aplicada'
                      }
                    />
                    <Bar
                      dataKey="recommended"
                      name="recommended"
                      fill={BRAND}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={insulinData.length > 20 ? 10 : 18}
                    />
                    <Bar
                      dataKey="applied"
                      name="applied"
                      fill={ACCENT}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={insulinData.length > 20 ? 10 : 18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
