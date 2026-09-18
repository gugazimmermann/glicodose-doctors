import type { Entry, Profile } from '../types/database'
import { parseEntryRecommendation } from './entryDetail'

/** Clinical hypo / in-range / hyper thresholds (mg/dL). */
export const CLINICAL_LOW = 70
export const CLINICAL_HIGH = 180

export type HistoryStats = {
  count: number
  avgGlucose: number | null
  minGlucose: number | null
  maxGlucose: number | null
  glucoseSd: number | null
  glucoseCvPercent: number | null
  inRange70_180Percent: number | null
  inRange70_180Count: number
  hypoPercent: number | null
  hypoCount: number
  hyperPercent: number | null
  hyperCount: number
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
  nightTargetMgdl: number | null
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

export type GlucoseZone = 'hypo' | 'inRange' | 'hyper'

export function glucoseZone(glucose: number): GlucoseZone {
  if (glucose < CLINICAL_LOW) return 'hypo'
  if (glucose > CLINICAL_HIGH) return 'hyper'
  return 'inRange'
}

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

export function isInTarget(
  glucose: number,
  target: number,
  tolerance = TARGET_TOLERANCE,
): boolean {
  const lo = target * (1 - tolerance)
  const hi = target * (1 + tolerance)
  return glucose >= lo && glucose <= hi
}

/** CSS text color for a glucose reading relative to target (±20%). */
export function glucoseToneClass(
  glucose: number,
  target: number | null | undefined,
): string {
  if (glucose < 70) return 'text-danger'
  if (target != null && target > 0) {
    if (isInTarget(glucose, target)) return 'text-ok'
    const high = target * (1 + TARGET_TOLERANCE)
    if (glucose > high * 1.15) return 'text-danger'
    return 'text-warning'
  }
  if (glucose > 180) return 'text-danger'
  if (glucose > 140) return 'text-warning'
  return 'text-ink'
}

function carbsFromEntry(entry: Entry): number | null {
  return parseEntryRecommendation(entry).carboidratosG
}

function sampleSd(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  let sumSq = 0
  for (const v of values) {
    const d = v - mean
    sumSq += d * d
  }
  return Math.sqrt(sumSq / (values.length - 1))
}

export function historyStatsFromEntries(
  entries: Entry[],
  profile: TargetProfile | null,
): HistoryStats {
  const dayTargetMgdl = profile?.target_glucose_mgdl ?? null
  const nightTargetMgdl =
    profile?.target_night_mgdl ?? dayTargetMgdl

  if (entries.length === 0) {
    return {
      count: 0,
      avgGlucose: null,
      minGlucose: null,
      maxGlucose: null,
      glucoseSd: null,
      glucoseCvPercent: null,
      inRange70_180Percent: null,
      inRange70_180Count: 0,
      hypoPercent: null,
      hypoCount: 0,
      hyperPercent: null,
      hyperCount: 0,
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
      nightTargetMgdl,
    }
  }

  let glucoseSum = 0
  let minG = entries[0].glucose_mgdl
  let maxG = entries[0].glucose_mgdl
  let inTarget = 0
  let inRange = 0
  let hypo = 0
  let hyper = 0

  let appliedSum = 0
  let appliedN = 0
  let recommendedSum = 0
  let recommendedN = 0
  let deltaSum = 0
  let deltaN = 0
  let carbsSum = 0
  let carbsN = 0

  const glucoseValues: number[] = []

  for (const e of entries) {
    const g = e.glucose_mgdl
    glucoseValues.push(g)
    glucoseSum += g
    if (g < minG) minG = g
    if (g > maxG) maxG = g

    const zone = glucoseZone(g)
    if (zone === 'hypo') hypo++
    else if (zone === 'hyper') hyper++
    else inRange++

    if (profile) {
      const target = resolveTargetMgdl(profile, e.recorded_at)
      if (isInTarget(g, target)) inTarget++
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
  const avgGlucose = glucoseSum / n
  const sd = sampleSd(glucoseValues)
  const cv =
    sd != null && avgGlucose > 0 ? (sd / avgGlucose) * 100 : null

  return {
    count: n,
    avgGlucose,
    minGlucose: minG,
    maxGlucose: maxG,
    glucoseSd: sd,
    glucoseCvPercent: cv,
    inRange70_180Percent: (inRange / n) * 100,
    inRange70_180Count: inRange,
    hypoPercent: (hypo / n) * 100,
    hypoCount: hypo,
    hyperPercent: (hyper / n) * 100,
    hyperCount: hyper,
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
    nightTargetMgdl,
  }
}
