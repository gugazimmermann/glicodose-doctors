import type { Entry, Profile } from '../types/database'
import { resolveTargetMgdl } from './historyStats'

export type ClinicalAlert = {
  id: string
  severity: 'high' | 'medium' | 'low'
  title: string
  detail: string
}

const HYPO_MGDL = 70
const HYPER_MGDL = 250
const DOSE_GAP_U = 2

/** Deterministic clinical flags for doctor review (no LLM). */
export function computeDeterministicAlerts(
  entries: Entry[],
  profile: Profile,
): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = []
  if (entries.length === 0) return alerts

  const sorted = [...entries].sort(
    (a, b) =>
      new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
  )

  let hypoStreak = 0
  let maxHypoStreak = 0
  for (const e of sorted) {
    if (e.glucose_mgdl < HYPO_MGDL) {
      hypoStreak += 1
      maxHypoStreak = Math.max(maxHypoStreak, hypoStreak)
    } else {
      hypoStreak = 0
    }
  }
  if (maxHypoStreak >= 3) {
    alerts.push({
      id: 'hypo-streak',
      severity: 'high',
      title: 'Hipoglicemias em sequência',
      detail: `${maxHypoStreak} registros consecutivos abaixo de ${HYPO_MGDL} mg/dL.`,
    })
  } else {
    const hypoCount = sorted.filter((e) => e.glucose_mgdl < HYPO_MGDL).length
    if (hypoCount >= 3) {
      alerts.push({
        id: 'hypo-count',
        severity: 'medium',
        title: 'Várias hipoglicemias',
        detail: `${hypoCount} registros < ${HYPO_MGDL} mg/dL nos últimos ${sorted.length} eventos.`,
      })
    }
  }

  const hyperCount = sorted.filter((e) => e.glucose_mgdl >= HYPER_MGDL).length
  if (hyperCount >= 3) {
    alerts.push({
      id: 'hyper-count',
      severity: 'medium',
      title: 'Hiperglicemias elevadas',
      detail: `${hyperCount} registros ≥ ${HYPER_MGDL} mg/dL.`,
    })
  }

  const withBoth = sorted.filter(
    (e) => e.recommended_insulin != null && e.applied_insulin != null,
  )
  const largeGaps = withBoth.filter(
    (e) =>
      Math.abs((e.recommended_insulin ?? 0) - (e.applied_insulin ?? 0)) >=
      DOSE_GAP_U,
  )
  if (largeGaps.length >= 3) {
    alerts.push({
      id: 'dose-gap',
      severity: 'medium',
      title: 'Gap recomendada vs aplicada',
      detail: `${largeGaps.length} vezes com diferença ≥ ${DOSE_GAP_U} U entre recomendada e aplicada.`,
    })
  }

  if (sorted.length >= 5) {
    const values = sorted.map((e) => e.glucose_mgdl)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
      values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
    const sd = Math.sqrt(variance)
    const cv = mean > 0 ? (sd / mean) * 100 : 0
    if (cv >= 36) {
      alerts.push({
        id: 'high-cv',
        severity: 'medium',
        title: 'Alta variabilidade glicêmica',
        detail: `CV estimado ~${cv.toFixed(0)}% (meta típica < 36%).`,
      })
    }
  }

  const recent = sorted.slice(0, 5)
  const aboveTarget = recent.filter((e) => {
    const target = resolveTargetMgdl(profile, e.recorded_at)
    return e.glucose_mgdl > target + 40
  })
  if (aboveTarget.length >= 4) {
    alerts.push({
      id: 'above-target',
      severity: 'low',
      title: 'Acima da meta recente',
      detail: `${aboveTarget.length} dos últimos 5 registros bem acima da meta dia/noite.`,
    })
  }

  return alerts
}
