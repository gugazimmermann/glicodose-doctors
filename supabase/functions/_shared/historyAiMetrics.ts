/** Clinical aggregates sent to the history-analysis model. */

export const CLINICAL_LOW = 70
export const CLINICAL_HIGH = 180
export const SEVERE_HYPO = 54
export const VERY_HIGH = 250
export const DOSE_GAP_U = 2
export const TARGET_TOLERANCE = 0.2

export type HistoryAiEntry = {
  recorded_at: string
  glucose_mgdl: number
  recommended_insulin: number | null
  applied_insulin: number | null
  gpt_raw_response: unknown
}

export type HistoryAiProfile = {
  target_glucose_mgdl: number | null
  target_night_mgdl: number | null
  night_start_minute: number | null
  night_end_minute: number | null
}

export type WindowMetrics = {
  count: number
  avgGlucose: number | null
  inRange70_180Percent: number | null
  hypoCount: number
  severeHypoCount: number
}

export type DayBandId =
  | 'madrugada'
  | 'manha'
  | 'almoco'
  | 'tarde'
  | 'noite'

export type BandMetrics = {
  faixa: DayBandId
  count: number
  avgGlucose: number | null
  hypoCount: number
}

export type HistoryAiMetrics = {
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
  severeHypoCount: number
  severeHypoPercent: number | null
  veryHighCount: number
  veryHighPercent: number | null
  day: WindowMetrics
  night: WindowMetrics
  bands: BandMetrics[]
  doseGapCount: number
  doseGapPercent: number | null
  appliedLessCount: number
  appliedMoreCount: number
}

const BANDS: DayBandId[] = [
  'madrugada',
  'manha',
  'almoco',
  'tarde',
  'noite',
]

export function carbsFromEntry(entry: HistoryAiEntry): number | null {
  const raw = entry.gpt_raw_response
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = (raw as Record<string, unknown>).carboidratos_g
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function isNightWindow(
  minuteOfDay: number,
  nightStart: number,
  nightEnd: number,
): boolean {
  if (nightStart === nightEnd) return false
  if (nightStart < nightEnd) {
    return minuteOfDay >= nightStart && minuteOfDay <= nightEnd
  }
  return minuteOfDay >= nightStart || minuteOfDay <= nightEnd
}

function brazilMinuteOfDay(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const h = hour === 24 ? 0 : hour
  return h * 60 + minute
}

function dayBand(minuteOfDay: number): DayBandId {
  if (minuteOfDay < 6 * 60) return 'madrugada'
  if (minuteOfDay < 11 * 60) return 'manha'
  if (minuteOfDay < 15 * 60) return 'almoco'
  if (minuteOfDay < 18 * 60) return 'tarde'
  return 'noite'
}

function resolveTarget(profile: HistoryAiProfile, recordedAt: string): number {
  const night = isNightWindow(
    brazilMinuteOfDay(recordedAt),
    Number(profile.night_start_minute ?? 1200),
    Number(profile.night_end_minute ?? 359),
  )
  const day = profile.target_glucose_mgdl ?? 110
  const nightTarget = profile.target_night_mgdl ?? day
  return night ? nightTarget : day
}

function isInTarget(glucose: number, target: number): boolean {
  const lo = target * (1 - TARGET_TOLERANCE)
  const hi = target * (1 + TARGET_TOLERANCE)
  return glucose >= lo && glucose <= hi
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

function round1(n: number | null): number | null {
  if (n == null || !Number.isFinite(n)) return null
  return Math.round(n * 10) / 10
}

type Bucket = {
  glucoseSum: number
  count: number
  inRange: number
  hypo: number
  severe: number
}

function emptyBucket(): Bucket {
  return { glucoseSum: 0, count: 0, inRange: 0, hypo: 0, severe: 0 }
}

function addGlucose(bucket: Bucket, glucose: number) {
  bucket.glucoseSum += glucose
  bucket.count += 1
  if (glucose < SEVERE_HYPO) bucket.severe += 1
  if (glucose < CLINICAL_LOW) bucket.hypo += 1
  else if (glucose <= CLINICAL_HIGH) bucket.inRange += 1
}

function windowMetrics(bucket: Bucket): WindowMetrics {
  if (bucket.count === 0) {
    return {
      count: 0,
      avgGlucose: null,
      inRange70_180Percent: null,
      hypoCount: 0,
      severeHypoCount: 0,
    }
  }
  return {
    count: bucket.count,
    avgGlucose: round1(bucket.glucoseSum / bucket.count),
    inRange70_180Percent: round1((bucket.inRange / bucket.count) * 100),
    hypoCount: bucket.hypo,
    severeHypoCount: bucket.severe,
  }
}

function emptyMetrics(): HistoryAiMetrics {
  return {
    count: 0,
    avgGlucose: null,
    minGlucose: null,
    maxGlucose: null,
    glucoseSd: null,
    glucoseCvPercent: null,
    inRange70_180Percent: null,
    hypoPercent: null,
    hypoCount: 0,
    hyperPercent: null,
    hyperCount: 0,
    inTargetPercent: null,
    avgAppliedU: null,
    avgRecommendedU: null,
    avgDoseDeltaU: null,
    avgCarbsG: null,
    severeHypoCount: 0,
    severeHypoPercent: null,
    veryHighCount: 0,
    veryHighPercent: null,
    day: windowMetrics(emptyBucket()),
    night: windowMetrics(emptyBucket()),
    bands: BANDS.map((faixa) => ({
      faixa,
      count: 0,
      avgGlucose: null,
      hypoCount: 0,
    })),
    doseGapCount: 0,
    doseGapPercent: null,
    appliedLessCount: 0,
    appliedMoreCount: 0,
  }
}

export function computeHistoryAiStats(
  entries: HistoryAiEntry[],
  profile: HistoryAiProfile,
): HistoryAiMetrics {
  if (entries.length === 0) return emptyMetrics()

  let glucoseSum = 0
  let minG = entries[0].glucose_mgdl
  let maxG = entries[0].glucose_mgdl
  let inTarget = 0
  let inRange = 0
  let hypo = 0
  let hyper = 0
  let severe = 0
  let veryHigh = 0
  let appliedSum = 0
  let appliedN = 0
  let recommendedSum = 0
  let recommendedN = 0
  let deltaSum = 0
  let deltaN = 0
  let doseGap = 0
  let appliedLess = 0
  let appliedMore = 0
  let carbsSum = 0
  let carbsN = 0
  const glucoseValues: number[] = []
  const day = emptyBucket()
  const night = emptyBucket()
  const bands = new Map<DayBandId, Bucket>(
    BANDS.map((id) => [id, emptyBucket()]),
  )

  for (const e of entries) {
    const g = e.glucose_mgdl
    glucoseValues.push(g)
    glucoseSum += g
    if (g < minG) minG = g
    if (g > maxG) maxG = g
    if (g < SEVERE_HYPO) severe++
    if (g >= VERY_HIGH) veryHigh++
    if (g < CLINICAL_LOW) hypo++
    else if (g > CLINICAL_HIGH) hyper++
    else inRange++
    if (isInTarget(g, resolveTarget(profile, e.recorded_at))) inTarget++

    const minute = brazilMinuteOfDay(e.recorded_at)
    const nightReading = isNightWindow(
      minute,
      Number(profile.night_start_minute ?? 1200),
      Number(profile.night_end_minute ?? 359),
    )
    addGlucose(nightReading ? night : day, g)
    addGlucose(bands.get(dayBand(minute))!, g)

    if (e.applied_insulin != null) {
      appliedSum += e.applied_insulin
      appliedN++
    }
    if (e.recommended_insulin != null) {
      recommendedSum += e.recommended_insulin
      recommendedN++
    }
    if (e.applied_insulin != null && e.recommended_insulin != null) {
      const delta = e.recommended_insulin - e.applied_insulin
      deltaSum += delta
      deltaN++
      if (Math.abs(delta) >= DOSE_GAP_U) {
        doseGap++
        if (e.applied_insulin < e.recommended_insulin) appliedLess++
        else appliedMore++
      }
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
  const cv = sd != null && avgGlucose > 0 ? (sd / avgGlucose) * 100 : null

  return {
    count: n,
    avgGlucose: round1(avgGlucose),
    minGlucose: minG,
    maxGlucose: maxG,
    glucoseSd: round1(sd),
    glucoseCvPercent: round1(cv),
    inRange70_180Percent: round1((inRange / n) * 100),
    hypoPercent: round1((hypo / n) * 100),
    hypoCount: hypo,
    hyperPercent: round1((hyper / n) * 100),
    hyperCount: hyper,
    inTargetPercent: round1((inTarget / n) * 100),
    avgAppliedU: round1(appliedN === 0 ? null : appliedSum / appliedN),
    avgRecommendedU: round1(
      recommendedN === 0 ? null : recommendedSum / recommendedN,
    ),
    avgDoseDeltaU: round1(deltaN === 0 ? null : deltaSum / deltaN),
    avgCarbsG: round1(carbsN === 0 ? null : carbsSum / carbsN),
    severeHypoCount: severe,
    severeHypoPercent: round1((severe / n) * 100),
    veryHighCount: veryHigh,
    veryHighPercent: round1((veryHigh / n) * 100),
    day: windowMetrics(day),
    night: windowMetrics(night),
    bands: BANDS.map((faixa) => {
      const bucket = bands.get(faixa)!
      return {
        faixa,
        count: bucket.count,
        avgGlucose:
          bucket.count === 0 ? null : round1(bucket.glucoseSum / bucket.count),
        hypoCount: bucket.hypo,
      }
    }),
    doseGapCount: doseGap,
    doseGapPercent: round1(deltaN === 0 ? null : (doseGap / deltaN) * 100),
    appliedLessCount: appliedLess,
    appliedMoreCount: appliedMore,
  }
}
