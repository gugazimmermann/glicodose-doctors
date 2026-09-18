import type { Entry, Profile } from '../types/database'
import { parseEntryRecommendation } from './entryDetail'
import {
  formatBrazilDate,
  formatBrazilDateTime,
  formatBrazilDayMonth,
} from './format'
import {
  CLINICAL_HIGH,
  CLINICAL_LOW,
  glucoseZone,
  resolveTargetMgdl,
  type GlucoseZone,
} from './historyStats'

/** Switch to daily averages when the raw series is dense. */
export const DENSE_SERIES_THRESHOLD = 40

type TargetProfile = Pick<
  Profile,
  | 'target_glucose_mgdl'
  | 'target_night_mgdl'
  | 'night_start_minute'
  | 'night_end_minute'
>

const brazilDayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** YYYY-MM-DD in America/Sao_Paulo. */
export function brazilDayKey(iso: string): string {
  return brazilDayKeyFmt.format(new Date(iso))
}

export type GlucosePoint = {
  index: number
  label: string
  when: string
  glucose: number
  zone: GlucoseZone
  target: number | null
  readingCount: number
  aggregated: boolean
}

export type InsulinPoint = {
  index: number
  label: string
  when: string
  recommended: number | null
  applied: number | null
  readingCount: number
  aggregated: boolean
}

export type CarbsPoint = {
  index: number
  label: string
  when: string
  carbs: number
  readingCount: number
  aggregated: boolean
}

function zoneFromMean(mean: number): GlucoseZone {
  return glucoseZone(mean)
}

export function buildGlucoseSeries(
  entries: Entry[],
  profile: TargetProfile | null,
): GlucosePoint[] {
  if (entries.length === 0) return []

  if (entries.length <= DENSE_SERIES_THRESHOLD) {
    return entries.map((e, i) => ({
      index: i,
      label: formatBrazilDayMonth(e.recorded_at),
      when: formatBrazilDateTime(e.recorded_at),
      glucose: e.glucose_mgdl,
      zone: glucoseZone(e.glucose_mgdl),
      target: profile ? resolveTargetMgdl(profile, e.recorded_at) : null,
      readingCount: 1,
      aggregated: false,
    }))
  }

  const byDay = new Map<
    string,
    { sum: number; count: number; firstIso: string }
  >()
  for (const e of entries) {
    const key = brazilDayKey(e.recorded_at)
    const prev = byDay.get(key)
    if (prev) {
      prev.sum += e.glucose_mgdl
      prev.count += 1
    } else {
      byDay.set(key, {
        sum: e.glucose_mgdl,
        count: 1,
        firstIso: e.recorded_at,
      })
    }
  }

  return [...byDay.values()].map((row, i) => {
    const mean = row.sum / row.count
    return {
      index: i,
      label: formatBrazilDayMonth(row.firstIso),
      when:
        row.count === 1
          ? formatBrazilDateTime(row.firstIso)
          : `${formatBrazilDate(row.firstIso)} · ${row.count} leituras · média`,
      glucose: Math.round(mean * 10) / 10,
      zone: zoneFromMean(mean),
      target: profile ? resolveTargetMgdl(profile, row.firstIso) : null,
      readingCount: row.count,
      aggregated: true,
    }
  })
}

export function buildInsulinSeries(entries: Entry[]): InsulinPoint[] {
  const withDose = entries.filter(
    (e) => e.recommended_insulin != null || e.applied_insulin != null,
  )
  if (withDose.length === 0) return []

  if (withDose.length <= DENSE_SERIES_THRESHOLD) {
    return withDose.map((e, i) => ({
      index: i,
      label: formatBrazilDayMonth(e.recorded_at),
      when: formatBrazilDateTime(e.recorded_at),
      recommended: e.recommended_insulin,
      applied: e.applied_insulin,
      readingCount: 1,
      aggregated: false,
    }))
  }

  const byDay = new Map<
    string,
    {
      recSum: number
      recN: number
      appSum: number
      appN: number
      firstIso: string
    }
  >()
  for (const e of withDose) {
    const key = brazilDayKey(e.recorded_at)
    let row = byDay.get(key)
    if (!row) {
      row = {
        recSum: 0,
        recN: 0,
        appSum: 0,
        appN: 0,
        firstIso: e.recorded_at,
      }
      byDay.set(key, row)
    }
    if (e.recommended_insulin != null) {
      row.recSum += e.recommended_insulin
      row.recN += 1
    }
    if (e.applied_insulin != null) {
      row.appSum += e.applied_insulin
      row.appN += 1
    }
  }

  return [...byDay.values()].map((row, i) => ({
    index: i,
    label: formatBrazilDayMonth(row.firstIso),
    when:
      row.recN + row.appN <= 2 && (row.recN === 1 || row.appN === 1)
        ? formatBrazilDate(row.firstIso)
        : `${formatBrazilDate(row.firstIso)} · totais do dia`,
    recommended: row.recN === 0 ? null : Math.round(row.recSum * 10) / 10,
    applied: row.appN === 0 ? null : Math.round(row.appSum * 10) / 10,
    readingCount: Math.max(row.recN, row.appN),
    aggregated: true,
  }))
}

export function buildCarbsSeries(entries: Entry[]): CarbsPoint[] {
  const withCarbs: { entry: Entry; carbs: number }[] = []
  for (const e of entries) {
    const carbs = parseEntryRecommendation(e).carboidratosG
    if (carbs != null) withCarbs.push({ entry: e, carbs })
  }
  if (withCarbs.length === 0) return []

  if (withCarbs.length <= DENSE_SERIES_THRESHOLD) {
    return withCarbs.map(({ entry, carbs }, i) => ({
      index: i,
      label: formatBrazilDayMonth(entry.recorded_at),
      when: formatBrazilDateTime(entry.recorded_at),
      carbs,
      readingCount: 1,
      aggregated: false,
    }))
  }

  const byDay = new Map<
    string,
    { sum: number; count: number; firstIso: string }
  >()
  for (const { entry, carbs } of withCarbs) {
    const key = brazilDayKey(entry.recorded_at)
    const prev = byDay.get(key)
    if (prev) {
      prev.sum += carbs
      prev.count += 1
    } else {
      byDay.set(key, {
        sum: carbs,
        count: 1,
        firstIso: entry.recorded_at,
      })
    }
  }

  return [...byDay.values()].map((row, i) => {
    const mean = row.sum / row.count
    return {
      index: i,
      label: formatBrazilDayMonth(row.firstIso),
      when:
        row.count === 1
          ? formatBrazilDateTime(row.firstIso)
          : `${formatBrazilDate(row.firstIso)} · média ${row.count} refeições`,
      carbs: Math.round(mean * 10) / 10,
      readingCount: row.count,
      aggregated: true,
    }
  })
}

/** Y-domain padded around data and clinical bands. */
export function glucoseYDomain(
  points: GlucosePoint[],
): [number, number] {
  let min = CLINICAL_LOW
  let max = CLINICAL_HIGH
  for (const p of points) {
    if (p.glucose < min) min = p.glucose
    if (p.glucose > max) max = p.glucose
  }
  return [Math.max(40, Math.floor(min - 20)), Math.ceil(max + 20)]
}

export { CLINICAL_HIGH, CLINICAL_LOW }
