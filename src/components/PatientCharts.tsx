import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { EmptyState } from './ui/EmptyState'
import { SegmentedControl } from './ui/SegmentedControl'
import { Spinner } from './ui/Spinner'
import { StatTile } from './ui/StatTile'
import type { ChartColors } from '../lib/chartTheme'
import { resolveChartColors } from '../lib/chartTheme'
import {
  buildCarbsSeries,
  buildGlucoseSeries,
  buildInsulinSeries,
  CLINICAL_HIGH,
  CLINICAL_LOW,
  glucoseYDomain,
  type CarbsPoint,
  type GlucosePoint,
  type InsulinPoint,
} from '../lib/chartSeries'
import {
  formatDose,
  formatDoseWithUnit,
  formatU,
} from '../lib/format'
import {
  HISTORY_PERIOD_LABELS,
  HISTORY_PERIODS,
  type HistoryPeriod,
} from '../lib/historyPeriod'
import {
  historyStatsFromEntries,
  type GlucoseZone,
  type HistoryStats,
} from '../lib/historyStats'
import { fetchPatientEntries } from '../lib/entriesApi'
import type { Entry, Profile } from '../types/database'

type PatientChartsProps = {
  patientId: string
  profile: Profile
}

const ALL_LIMIT = 200

function fmtPct(value: number | null): string {
  if (value == null) return '—'
  return `${Math.round(value)}%`
}

/** @internal exported for tests */
export function zoneStroke(zone: GlucoseZone, colors: ChartColors): string {
  if (zone === 'hypo') return colors.danger
  if (zone === 'hyper') return colors.warning
  return colors.ok
}

function StatsSummary({ stats }: { stats: HistoryStats }) {
  const deltaLabel =
    stats.avgDoseDeltaU == null
      ? '—'
      : `${stats.avgDoseDeltaU > 0 ? '+' : ''}${formatU(stats.avgDoseDeltaU)}`

  const meanHintParts: string[] = []
  if (stats.minGlucose != null && stats.maxGlucose != null) {
    meanHintParts.push(`${stats.minGlucose}–${stats.maxGlucose} mg/dL`)
  }
  if (stats.glucoseCvPercent != null && stats.count >= 3) {
    meanHintParts.push(`CV ${Math.round(stats.glucoseCvPercent)}%`)
  }

  return (
    <Card className="min-w-0 overflow-hidden sm:p-5">
      <h3 className="text-sm font-semibold text-ink">Resumo do período</h3>
      <p className="mt-1 text-sm text-muted">
        {stats.count} leitura{stats.count === 1 ? '' : 's'}
        {stats.count >= ALL_LIMIT ? ` (até ${ALL_LIMIT} mais recentes)` : ''}
        {' · '}
        % das leituras (não tempo em faixa)
      </p>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Glicose média"
          value={formatDoseWithUnit(stats.avgGlucose, ' mg/dL')}
          hint={meanHintParts.length > 0 ? meanHintParts.join(' · ') : null}
        />
        <StatTile
          label="% na faixa 70–180"
          value={fmtPct(stats.inRange70_180Percent)}
          hint={`${stats.inRange70_180Count} de ${stats.count}`}
        />
        <StatTile
          label="Hipo (<70)"
          value={fmtPct(stats.hypoPercent)}
          hint={`${stats.hypoCount} de ${stats.count}`}
        />
        <StatTile
          label="Hiper (>180)"
          value={fmtPct(stats.hyperPercent)}
          hint={`${stats.hyperCount} de ${stats.count}`}
        />
        <StatTile
          label="Na meta pessoal (±20%)"
          value={fmtPct(stats.inTargetPercent)}
          hint={
            stats.inTargetPercent == null
              ? 'Cadastre a meta no perfil'
              : `${stats.inTargetCount} de ${stats.count}`
          }
        />
        <StatTile
          label="Desvio vs recomendada"
          value={deltaLabel}
          hint={
            stats.doseDeltaCount === 0
              ? 'Sem pares para comparar'
              : 'Média rec. − aplicada'
          }
        />
      </div>
      {(stats.appliedCount > 0 || stats.carbsCount > 0) && (
        <p className="mt-3 text-xs text-muted">
          {stats.appliedCount > 0
            ? `Insulina aplicada ${formatU(stats.totalAppliedU)}${
                stats.avgAppliedU != null
                  ? ` (média ${formatU(stats.avgAppliedU)})`
                  : ''
              }`
            : null}
          {stats.appliedCount > 0 && stats.carbsCount > 0 ? ' · ' : null}
          {stats.carbsCount > 0
            ? `Carbs médios ${formatDoseWithUnit(stats.avgCarbsG, ' g')} (${stats.carbsCount} refeição${stats.carbsCount === 1 ? '' : 'ões'})`
            : null}
        </p>
      )}
    </Card>
  )
}

function GlucoseDot(props: {
  cx?: number
  cy?: number
  payload?: GlucosePoint
  colors: ChartColors
}) {
  const { cx, cy, payload, colors } = props
  if (cx == null || cy == null || !payload) return null
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={zoneStroke(payload.zone, colors)}
      stroke="#fff"
      strokeWidth={1.5}
    />
  )
}

/** @internal exported for tests */
export { GlucoseDot }

function GlucoseChart({
  data,
  dayTarget,
  nightTarget,
  colors,
  aggregated,
}: {
  data: GlucosePoint[]
  dayTarget: number | null
  nightTarget: number | null
  colors: ChartColors
  aggregated: boolean
}) {
  const yDomain = useMemo(() => glucoseYDomain(data), [data])
  const showDots = data.length <= 40
  const nightDistinct =
    nightTarget != null &&
    dayTarget != null &&
    nightTarget !== dayTarget

  return (
    <Card className="min-w-0 overflow-hidden sm:p-5">
      <h3 className="text-sm font-semibold text-ink">Glicose</h3>
      <p className="mt-1 text-xs text-muted">
        Faixa clínica 70–180
        {dayTarget != null ? ` · meta dia ${dayTarget} mg/dL` : ''}
        {nightDistinct ? ` · meta noite ${nightTarget} mg/dL` : ''}
        {aggregated ? ' · média diária' : ''}
      </p>
      <div className="mt-3 h-60 w-full min-w-0 overflow-hidden sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              stroke={colors.line}
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: colors.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.line }}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={{ fill: colors.muted, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: colors.line }}
              width={40}
              domain={yDomain}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                borderColor: colors.line,
                fontSize: 12,
              }}
              formatter={(value) => [
                `${Number(value)} mg/dL`,
                aggregated ? 'Média' : 'Glicose',
              ]}
              labelFormatter={(_, payload) =>
                payload?.[0]?.payload?.when ?? ''
              }
            />
            <ReferenceArea
              y1={yDomain[0]}
              y2={CLINICAL_LOW}
              fill={colors.dangerSoft}
              fillOpacity={0.55}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              y1={CLINICAL_LOW}
              y2={CLINICAL_HIGH}
              fill={colors.okSoft}
              fillOpacity={0.45}
              ifOverflow="extendDomain"
            />
            <ReferenceArea
              y1={CLINICAL_HIGH}
              y2={yDomain[1]}
              fill={colors.warningSoft}
              fillOpacity={0.55}
              ifOverflow="extendDomain"
            />
            {dayTarget != null ? (
              <ReferenceLine
                y={dayTarget}
                stroke={colors.muted}
                strokeDasharray="6 4"
                strokeOpacity={0.85}
              />
            ) : null}
            {nightDistinct ? (
              <ReferenceLine
                y={nightTarget!}
                stroke={colors.muted}
                strokeDasharray="2 4"
                strokeOpacity={0.7}
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="glucose"
              stroke={colors.brand}
              strokeWidth={2.5}
              dot={
                showDots
                  ? (dotProps) => (
                      <GlucoseDot
                        {...dotProps}
                        colors={colors}
                      />
                    )
                  : false
              }
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function InsulinChart({
  data,
  colors,
  totalApplied,
  totalRecommended,
  aggregated,
}: {
  data: InsulinPoint[]
  colors: ChartColors
  totalApplied: number
  totalRecommended: number
  aggregated: boolean
}) {
  return (
    <Card className="min-w-0 overflow-hidden sm:p-5">
      <h3 className="text-sm font-semibold text-ink">Insulina</h3>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nenhuma dose registrada no período.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">
            Aplicada {formatU(totalApplied)} · Recomendada{' '}
            {formatU(totalRecommended)}
            {aggregated ? ' · totais diários' : ''}
          </p>
          <div className="mt-3 h-60 w-full min-w-0 overflow-hidden sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke={colors.line}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: colors.muted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: colors.line }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: colors.muted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: colors.line }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: colors.line,
                    fontSize: 12,
                  }}
                  formatter={(value, name) => {
                    if (value == null || Number.isNaN(Number(value))) {
                      return ['—', name === 'recommended' ? 'Rec.' : 'Apl.']
                    }
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
                      fill={colors.brand}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={data.length > 20 ? 10 : 18}
                    />
                    <Bar
                      dataKey="applied"
                      name="applied"
                      fill={colors.ok}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={data.length > 20 ? 10 : 18}
                    />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  )
}

function CarbsChart({
  data,
  colors,
  avgCarbs,
  carbsCount,
  aggregated,
}: {
  data: CarbsPoint[]
  colors: ChartColors
  avgCarbs: number | null
  carbsCount: number
  aggregated: boolean
}) {
  return (
    <Card className="min-w-0 overflow-hidden sm:p-5">
      <h3 className="text-sm font-semibold text-ink">Carbs estimados</h3>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Sem estimativa TACO no período.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">
            Média {formatDoseWithUnit(avgCarbs, ' g')} · {carbsCount}{' '}
            refeição{carbsCount === 1 ? '' : 'ões'}
            {aggregated ? ' · média diária' : ''}
          </p>
          <div className="mt-3 h-60 w-full min-w-0 overflow-hidden sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke={colors.line}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: colors.muted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: colors.line }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                />
                <YAxis
                  tick={{ fill: colors.muted, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: colors.line }}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: colors.line,
                    fontSize: 12,
                  }}
                  formatter={(value) => [
                    `${formatDose(Number(value))} g`,
                    aggregated ? 'Média' : 'Carbs',
                  ]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.when ?? ''
                  }
                />
                <Bar
                  dataKey="carbs"
                  fill={colors.brand}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={data.length > 20 ? 10 : 18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  )
}

export function PatientCharts({ patientId, profile }: PatientChartsProps) {
  const [period, setPeriod] = useState<HistoryPeriod>('days30')
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const colors = useMemo(() => resolveChartColors(), [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { entries: rows } = await fetchPatientEntries(patientId, {
        mode: 'series',
        period,
        allLimit: ALL_LIMIT,
      })
      setEntries(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar gráficos.')
      setEntries([])
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
    () => buildGlucoseSeries(entries, profile),
    [entries, profile],
  )
  const insulinData = useMemo(
    () => buildInsulinSeries(entries),
    [entries],
  )
  const carbsData = useMemo(() => buildCarbsSeries(entries), [entries])

  const glucoseAggregated =
    glucoseData.length > 0 && glucoseData[0].aggregated
  const insulinAggregated =
    insulinData.length > 0 && insulinData[0].aggregated
  const carbsAggregated =
    carbsData.length > 0 && carbsData[0].aggregated

  return (
    <section className="min-w-0 space-y-4">
      <SegmentedControl
        variant="chips"
        ariaLabel="Período do gráfico"
        value={period}
        onChange={setPeriod}
        items={HISTORY_PERIODS.map((p) => ({
          value: p,
          label: HISTORY_PERIOD_LABELS[p],
        }))}
      />

      {loading ? (
        <Spinner label="Carregando gráficos…" />
      ) : error ? (
        <Card className="space-y-3">
          <Alert variant="error">{error}</Alert>
          <Button onClick={() => void load()}>Tentar novamente</Button>
        </Card>
      ) : entries.length === 0 ? (
        <EmptyState muted title="Sem dados no período" />
      ) : (
        <>
          <StatsSummary stats={stats} />

          <GlucoseChart
            data={glucoseData}
            dayTarget={stats.dayTargetMgdl}
            nightTarget={stats.nightTargetMgdl}
            colors={colors}
            aggregated={glucoseAggregated}
          />

          <InsulinChart
            data={insulinData}
            colors={colors}
            totalApplied={stats.totalAppliedU}
            totalRecommended={stats.totalRecommendedU}
            aggregated={insulinAggregated}
          />

          <CarbsChart
            data={carbsData}
            colors={colors}
            avgCarbs={stats.avgCarbsG}
            carbsCount={stats.carbsCount}
            aggregated={carbsAggregated}
          />
        </>
      )}
    </section>
  )
}
