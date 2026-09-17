import type { Entry, Profile } from '../types/database'

export type HistoryStats = {
  count: number
  avgGlucose: number | null
  minGlucose: number | null
  maxGlucose: number | null
  inTargetPercent: number | null
  inTargetCount: number
  totalAppliedU: number
  avgAppliedU: number | null
  appliedCount: number
  totalRecommendedU: number
  recommendedCount: number
  /** Mean of (recommended − applied) when both present. */
  avgDoseDeltaU: number | null
  doseDeltaCount: number
  avgCarbsG: number | null
  carbsCount: number
  dayTargetMgdl: number | null
}

/** Readings within ±20% of the day/night target for that timestamp. */
export const TARGET_TOLERANCE = 0.2

type TargetProfile = Pick<
  Profile,
  | 'target_glucose_mgdl'
  | 'target_night_mgdl'
  | 'night_start_minute'
  | 'night_end_minute'
>

/** Night window may cross midnight (e.g. 20:00–05:59). */
export function isNightWindow(
  minuteOfDay: number,
  nightStartMinute: number,
  nightEndMinute: number,
): boolean {
  if (nightStartMinute === nightEndMinute) return false
  if (nightStartMinute < nightEndMinute) {
    return minuteOfDay >= nightStartMinute && minuteOfDay <= nightEndMinute
  }
  return minuteOfDay >= nightStartMinute || minuteOfDay <= nightEndMinute
}

/** Minute of day (0–1439) in America/Sao_Paulo for an ISO timestamp. */
export function brazilMinuteOfDay(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  // en-GB can return "24" for midnight in some engines
  const h = hour === 24 ? 0 : hour
  return h * 60 + minute
}

export function resolveTargetMgdl(
  profile: TargetProfile,
  recordedAtIso: string,
): number {
  const night = isNightWindow(
    brazilMinuteOfDay(recordedAtIso),
    profile.night_start_minute,
    profile.night_end_minute,
  )
  const dayTarget = profile.target_glucose_mgdl ?? 110
  const nightTarget = profile.target_night_mgdl ?? dayTarget
  return night ? nightTarget : dayTarget
}

function carbsFromEntry(entry: Entry): number | null {
  const raw = entry.gpt_raw_response
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const carbs = (raw as Record<string, unknown>).carboidratos_g
  if (typeof carbs === 'number' && Number.isFinite(carbs)) return carbs
  if (typeof carbs === 'string') {
    const n = Number(carbs.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function historyStatsFromEntries(
  entries: Entry[],
  profile: TargetProfile | null,
): HistoryStats {
  const dayTargetMgdl = profile?.target_glucose_mgdl ?? null

  if (entries.length === 0) {
    return {
      count: 0,
      avgGlucose: null,
      minGlucose: null,
      maxGlucose: null,
      inTargetPercent: null,
      inTargetCount: 0,
      totalAppliedU: 0,
      avgAppliedU: null,
      appliedCount: 0,
      totalRecommendedU: 0,
      recommendedCount: 0,
      avgDoseDeltaU: null,
      doseDeltaCount: 0,
      avgCarbsG: null,
      carbsCount: 0,
      dayTargetMgdl,
    }
  }

  let glucoseSum = 0
  let minG = entries[0].glucose_mgdl
  let maxG = entries[0].glucose_mgdl
  let inTarget = 0

  let appliedSum = 0
  let appliedN = 0
  let recommendedSum = 0
  let recommendedN = 0
  let deltaSum = 0
  let deltaN = 0
  let carbsSum = 0
  let carbsN = 0

  for (const e of entries) {
    const g = e.glucose_mgdl
    glucoseSum += g
    if (g < minG) minG = g
    if (g > maxG) maxG = g

    if (profile) {
      const target = resolveTargetMgdl(profile, e.recorded_at)
      const lo = target * (1 - TARGET_TOLERANCE)
      const hi = target * (1 + TARGET_TOLERANCE)
      if (g >= lo && g <= hi) inTarget++
    }

    if (e.applied_insulin != null) {
      appliedSum += e.applied_insulin
      appliedN++
    }
    if (e.recommended_insulin != null) {
      recommendedSum += e.recommended_insulin
      recommendedN++
    }
    if (e.applied_insulin != null && e.recommended_insulin != null) {
      deltaSum += e.recommended_insulin - e.applied_insulin
      deltaN++
    }

    const carbs = carbsFromEntry(e)
    if (carbs != null) {
      carbsSum += carbs
      carbsN++
    }
  }

  const n = entries.length
  return {
    count: n,
    avgGlucose: glucoseSum / n,
    minGlucose: minG,
    maxGlucose: maxG,
    inTargetPercent: profile == null ? null : (inTarget / n) * 100,
    inTargetCount: inTarget,
    totalAppliedU: appliedSum,
    avgAppliedU: appliedN === 0 ? null : appliedSum / appliedN,
    appliedCount: appliedN,
    totalRecommendedU: recommendedSum,
    recommendedCount: recommendedN,
    avgDoseDeltaU: deltaN === 0 ? null : deltaSum / deltaN,
    doseDeltaCount: deltaN,
    avgCarbsG: carbsN === 0 ? null : carbsSum / carbsN,
    carbsCount: carbsN,
    dayTargetMgdl,
  }
}
