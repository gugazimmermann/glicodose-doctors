import { supabase } from './supabase'
import type { HistoryPeriod } from './historyPeriod'
import {
  parseRatioSchedule,
  patchMidnightSegment,
} from './ratioSchedule'
import type { Profile } from '../types/database'

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
  valor_sugerido?: number | null
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
  analysisId?: string | null
}

export type SavedAiAnalysis = {
  id: string
  doctor_id: string
  patient_id: string
  period: string
  entry_count: number
  stats: HistoryAiStats | Record<string, unknown>
  analysis: HistoryAiAnalysis
  created_at: string
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

export async function listPatientAiAnalyses(
  patientId: string,
  limit = 10,
): Promise<SavedAiAnalysis[]> {
  const { data, error } = await supabase
    .from('patient_ai_analyses')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as SavedAiAnalysis[]
}

/** Map AI suggestion parameter + optional numeric value to a profile patch. */
export function mapSugestaoToProfilePatch(
  sugestao: HistoryAiSugestao,
  profile: Profile,
): Partial<Profile> | null {
  const valor = sugestao.valor_sugerido
  if (valor == null || !Number.isFinite(valor) || valor <= 0) return null

  const key = sugestao.parametro.trim().toLowerCase()
  if (key === 'fsi' || key === 'isf' || key.includes('fsi')) {
    const schedule = patchMidnightSegment(
      parseRatioSchedule(profile.isf_schedule),
      valor,
      profile.isf_mgdl_per_u,
    )
    return {
      isf_mgdl_per_u: valor,
      isf_schedule: schedule,
    }
  }
  if (key === 'i:c' || key === 'ic' || key.includes('i:c') || key.includes('ic')) {
    const schedule = patchMidnightSegment(
      parseRatioSchedule(profile.ic_schedule),
      valor,
      profile.ic_ratio,
    )
    return {
      ic_ratio: valor,
      ic_schedule: schedule,
    }
  }
  if (key.includes('meta_dia') || key.includes('meta dia') || key === 'meta_dia') {
    return { target_glucose_mgdl: valor }
  }
  if (
    key.includes('meta_noite') ||
    key.includes('meta noite') ||
    key === 'meta_noite'
  ) {
    return { target_night_mgdl: valor }
  }
  if (key.includes('dose_step') || key.includes('passo')) {
    return { dose_step: valor }
  }
  if (key.includes('duracao') || key.includes('duração') || key.includes('iob')) {
    return { insulin_duration_hours: valor }
  }
  return null
}
