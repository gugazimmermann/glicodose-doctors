import { useCallback, useEffect, useState } from 'react'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Select } from './ui/Input'
import { Spinner } from './ui/Spinner'
import {
  analyzePatientHistory,
  listPatientAiAnalyses,
  mapSugestaoToProfilePatch,
  type AnalyzePatientHistoryResult,
  type HistoryAiAchado,
  type HistoryAiSeveridade,
  type HistoryAiSugestao,
  type SavedAiAnalysis,
} from '../lib/analyzeHistoryApi'
import {
  HISTORY_PERIOD_LABELS,
  type HistoryPeriod,
} from '../lib/historyPeriod'
import type { Profile } from '../types/database'
import { formatBrazilDateTime } from '../lib/format'

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
  profile: Profile
  onApplySuggestion: (patch: Partial<Profile>) => void | Promise<void>
}

export function PatientHistoryAiPanel({
  patientId,
  profile,
  onApplySuggestion,
}: PatientHistoryAiPanelProps) {
  const [period, setPeriod] = useState<HistoryPeriod>('days30')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzePatientHistoryResult | null>(null)
  const [history, setHistory] = useState<SavedAiAnalysis[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [applyingKey, setApplyingKey] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const rows = await listPatientAiAnalyses(patientId)
      setHistory(rows)
    } catch {
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  async function onAnalyze() {
    setLoading(true)
    setError(null)
    try {
      const data = await analyzePatientHistory({ patientId, period })
      setResult(data)
      await loadHistory()
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

  async function onApply(sugestao: HistoryAiSugestao, index: number) {
    const patch = mapSugestaoToProfilePatch(sugestao, profile)
    if (!patch) {
      setError(
        'Esta sugestão não tem valor numérico aplicável. Ajuste manualmente na aba Prescrição.',
      )
      return
    }
    const ok = window.confirm(
      `Aplicar ${sugestao.parametro} na prescrição do paciente?\n\n${sugestao.observacao}${
        sugestao.valor_sugerido != null
          ? `\nValor: ${sugestao.valor_sugerido}`
          : ''
      }`,
    )
    if (!ok) return
    setApplyingKey(`${sugestao.parametro}-${index}`)
    try {
      await onApplySuggestion(patch)
    } finally {
      setApplyingKey(null)
    }
  }

  function renderSuggestions(list: HistoryAiSugestao[]) {
    if (list.length === 0) return null
    return (
      <div>
        <h4 className="text-sm font-semibold text-ink">
          Sugestões de parâmetros
        </h4>
        <ul className="mt-2 space-y-2">
          {list.map((s, index) => {
            const patch = mapSugestaoToProfilePatch(s, profile)
            const key = `${s.parametro}-${index}`
            return (
              <li
                key={key}
                className="flex flex-col gap-2 rounded-lg border border-line bg-surface/50 p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 text-sm text-ink">
                  <span className="font-semibold">{s.parametro}:</span>{' '}
                  {s.observacao}
                  {s.valor_sugerido != null && (
                    <span className="mt-1 block text-xs text-muted">
                      Valor sugerido: {s.valor_sugerido}
                    </span>
                  )}
                </div>
                {patch && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={applyingKey === key}
                    onClick={() => void onApply(s, index)}
                  >
                    {applyingKey === key ? 'Aplicando…' : 'Aplicar'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink">Análise com IA</h3>
          <p className="mt-1 text-sm text-muted">
            Identifica discrepâncias, irregularidades e possíveis ajustes no
            período selecionado. Análises ficam salvas para revisitar.
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
              {result.analysisId ? ' · salva' : ''}
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

          {renderSuggestions(result.analysis.sugestoes_prescricao)}

          {result.analysis.disclaimer && (
            <Alert variant="info">{result.analysis.disclaimer}</Alert>
          )}
        </div>
      )}

      <div className="border-t border-line pt-4">
        <h4 className="text-sm font-semibold text-ink">Análises anteriores</h4>
        {historyLoading ? (
          <p className="mt-2 text-sm text-muted">Carregando…</p>
        ) : history.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nenhuma análise salva ainda.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {history.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="w-full rounded-lg border border-line px-3 py-2 text-left text-sm transition hover:border-brand/40 hover:bg-brand-softer/40"
                  onClick={() =>
                    setResult({
                      period: (row.period as HistoryPeriod) || 'days30',
                      entryCount: row.entry_count,
                      stats: row.stats as AnalyzePatientHistoryResult['stats'],
                      analysis: row.analysis,
                      analysisId: row.id,
                    })
                  }
                >
                  <span className="font-medium text-ink">
                    {HISTORY_PERIOD_LABELS[
                      row.period as HistoryPeriod
                    ] ?? row.period}{' '}
                    · {row.entry_count} registros
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {formatBrazilDateTime(row.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
