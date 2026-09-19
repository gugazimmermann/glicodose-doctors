import { useState } from 'react'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Select } from './ui/Input'
import { Spinner } from './ui/Spinner'
import {
  analyzePatientHistory,
  type AnalyzePatientHistoryResult,
  type HistoryAiAchado,
  type HistoryAiSeveridade,
} from '../lib/analyzeHistoryApi'
import {
  HISTORY_PERIOD_LABELS,
  type HistoryPeriod,
} from '../lib/historyPeriod'

const TIPO_LABEL: Record<HistoryAiAchado['tipo'], string> = {
  discrepancia: 'Discrepância',
  irregularidade: 'Irregularidade',
  melhoria: 'Melhoria',
  ajuste: 'Ajuste',
}

const SEVERIDADE_CLASS: Record<HistoryAiSeveridade, string> = {
  alta: 'bg-danger-soft text-danger',
  media: 'bg-warning-soft text-warning',
  baixa: 'bg-brand-soft text-brand-dark',
}

type PatientHistoryAiPanelProps = {
  patientId: string
}

export function PatientHistoryAiPanel({ patientId }: PatientHistoryAiPanelProps) {
  const [period, setPeriod] = useState<HistoryPeriod>('days30')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzePatientHistoryResult | null>(null)

  async function onAnalyze() {
    setLoading(true)
    setError(null)
    try {
      const data = await analyzePatientHistory({ patientId, period })
      setResult(data)
    } catch (err) {
      setResult(null)
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível analisar o histórico.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">Análise com IA</h3>
          <p className="mt-1 text-sm text-muted">
            Identifica discrepâncias, irregularidades e possíveis ajustes no
            período selecionado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="whitespace-nowrap">Período</span>
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value as HistoryPeriod)}
              className="w-auto py-2"
              disabled={loading}
            >
              {(Object.keys(HISTORY_PERIOD_LABELS) as HistoryPeriod[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {HISTORY_PERIOD_LABELS[key]}
                  </option>
                ),
              )}
            </Select>
          </label>
          <Button onClick={onAnalyze} disabled={loading} size="sm">
            {loading ? 'Analisando…' : 'Analisar com IA'}
          </Button>
        </div>
      </div>

      {loading && <Spinner label="Analisando histórico…" />}

      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {result && !loading && (
        <div className="space-y-4 border-t border-line pt-4">
          <div>
            <p className="text-sm text-ink">{result.analysis.resumo}</p>
            <p className="mt-1 text-xs text-muted">
              {result.entryCount} registro
              {result.entryCount === 1 ? '' : 's'} ·{' '}
              {HISTORY_PERIOD_LABELS[result.period]}
            </p>
          </div>

          {result.analysis.achados.length > 0 ? (
            <ul className="space-y-3">
              {result.analysis.achados.map((achado, index) => (
                <li
                  key={`${achado.titulo}-${index}`}
                  className="rounded-xl border border-line bg-surface/60 p-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${SEVERIDADE_CLASS[achado.severidade]}`}
                    >
                      {achado.severidade}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-wide text-muted">
                      {TIPO_LABEL[achado.tipo]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">
                    {achado.titulo}
                  </p>
                  {achado.detalhe && (
                    <p className="mt-1 text-sm text-ink/90">{achado.detalhe}</p>
                  )}
                  {achado.evidencia && (
                    <p className="mt-2 text-xs text-muted">
                      Evidência: {achado.evidencia}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Nenhum achado relevante no período.
            </p>
          )}

          {result.analysis.sugestoes_prescricao.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-ink">
                Sugestões de parâmetros
              </h4>
              <ul className="mt-2 space-y-2">
                {result.analysis.sugestoes_prescricao.map((s, index) => (
                  <li
                    key={`${s.parametro}-${index}`}
                    className="text-sm text-ink"
                  >
                    <span className="font-semibold">{s.parametro}:</span>{' '}
                    {s.observacao}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.analysis.disclaimer && (
            <Alert variant="info">{result.analysis.disclaimer}</Alert>
          )}
        </div>
      )}
    </Card>
  )
}
