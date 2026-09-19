import { supabase } from './supabase'
import type { HistoryPeriod } from './historyPeriod'

export type HistoryAiAchadoTipo =
  | 'discrepancia'
  | 'irregularidade'
  | 'melhoria'
  | 'ajuste'

export type HistoryAiSeveridade = 'alta' | 'media' | 'baixa'

export type HistoryAiAchado = {
  tipo: HistoryAiAchadoTipo
  severidade: HistoryAiSeveridade
  titulo: string
  detalhe: string
  evidencia: string
}

export type HistoryAiSugestao = {
  parametro: string
  observacao: string
}

export type HistoryAiAnalysis = {
  resumo: string
  achados: HistoryAiAchado[]
  sugestoes_prescricao: HistoryAiSugestao[]
  disclaimer: string
}

export type HistoryAiStats = {
  count: number
  avgGlucose: number | null
  minGlucose: number | null
  maxGlucose: number | null
  glucoseSd: number | null
  glucoseCvPercent: number | null
  inRange70_180Percent: number | null
  hypoPercent: number | null
  hypoCount: number
  hyperPercent: number | null
  hyperCount: number
  inTargetPercent: number | null
  avgAppliedU: number | null
  avgRecommendedU: number | null
  avgDoseDeltaU: number | null
  avgCarbsG: number | null
}

export type AnalyzePatientHistoryResult = {
  period: HistoryPeriod
  entryCount: number
  stats: HistoryAiStats
  analysis: HistoryAiAnalysis
}

function functionsErrorMessage(error: unknown, data: unknown): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const msg = (data as { error?: unknown }).error
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  if (error instanceof Error && error.message) return error.message
  return 'Não foi possível analisar o histórico.'
}

export async function analyzePatientHistory(options: {
  patientId: string
  period?: HistoryPeriod
}): Promise<AnalyzePatientHistoryResult> {
  const { data, error } = await supabase.functions.invoke(
    'analyze-patient-history',
    {
      body: {
        patientId: options.patientId,
        period: options.period ?? 'days30',
      },
    },
  )

  if (error) {
    throw new Error(functionsErrorMessage(error, data))
  }

  const result = data as AnalyzePatientHistoryResult | null
  if (!result?.analysis) {
    throw new Error('Resposta inválida da análise.')
  }

  return result
}
