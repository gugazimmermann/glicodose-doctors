import type { Entry } from '../types/database'
import { formatDose } from './format'

export type EntryRecommendation = {
  carboidratosG: number | null
  correcaoU: number | null
  bolusComidaU: number | null
  iobU: number | null
  insulinaRecomendadaU: number | null
  observacao: string | null
  metaMgdl: number | null
  metaPeriodo: string | null
  source: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function parseEntryRecommendation(entry: Entry): EntryRecommendation {
  const raw = asRecord(entry.gpt_raw_response)
  return {
    carboidratosG: asNumber(raw?.carboidratos_g),
    correcaoU: asNumber(raw?.correcao_u),
    bolusComidaU: asNumber(raw?.bolus_comida_u),
    iobU: asNumber(raw?.iob_u),
    insulinaRecomendadaU:
      asNumber(raw?.insulina_recomendada_u) ?? entry.recommended_insulin,
    observacao: asString(raw?.observacao),
    metaMgdl: asNumber(raw?.meta_mgdl),
    metaPeriodo: asString(raw?.meta_periodo),
    source: asString(raw?.source),
  }
}

export function formatMetaLabel(rec: EntryRecommendation): string | null {
  if (rec.metaMgdl == null) return null
  const period = rec.metaPeriodo ? ` (${rec.metaPeriodo})` : ''
  return `Meta aplicada: ${rec.metaMgdl} mg/dL${period}`
}

export function formatU(value: number | null | undefined): string {
  return `${formatDose(value)} U`
}
