import { formatMinuteOfDay } from './timeOfDay'

export type RatioSegment = {
  start_minute: number
  value: number
}

export type RatioResolveResult = {
  value: number
  segment: RatioSegment
  end_minute: number
  range_label: string
}

export const MAX_RATIO_SEGMENTS = 12

function formatEnd(endExclusive: number): string {
  if (endExclusive >= 1440) return '24:00'
  return formatMinuteOfDay(endExclusive)
}

function rangeLabel(start: number, endExclusive: number): string {
  return `${formatMinuteOfDay(start)}–${formatEnd(endExclusive)}`
}

export function normalizeRatioSchedule(
  raw: RatioSegment[],
  fallbackValue?: number | null,
): RatioSegment[] {
  const byStart = new Map<number, RatioSegment>()
  for (const s of raw) {
    const start = Math.max(0, Math.min(1439, Math.round(s.start_minute)))
    const value = Number(s.value)
    if (!Number.isFinite(value) || value <= 0) continue
    if (!byStart.has(start)) {
      byStart.set(start, { start_minute: start, value })
    }
    if (byStart.size >= MAX_RATIO_SEGMENTS) break
  }
  let list = [...byStart.values()].sort(
    (a, b) => a.start_minute - b.start_minute,
  )
  if (
    list.length === 0 &&
    fallbackValue != null &&
    Number.isFinite(fallbackValue) &&
    fallbackValue > 0
  ) {
    list = [{ start_minute: 0, value: fallbackValue }]
  }
  if (list.length > 0 && list[0].start_minute !== 0) {
    const midnightValue =
      fallbackValue != null && Number.isFinite(fallbackValue) && fallbackValue > 0
        ? fallbackValue
        : list[0].value
    list = [{ start_minute: 0, value: midnightValue }, ...list]
    const seen = new Set<number>()
    list = list.filter((s) => {
      if (seen.has(s.start_minute)) return false
      seen.add(s.start_minute)
      return true
    })
    if (list.length > MAX_RATIO_SEGMENTS) {
      list = list.slice(0, MAX_RATIO_SEGMENTS)
    }
  }
  return list
}

/** Portuguese error or null if valid. */
export function validateRatioSchedule(
  schedule: RatioSegment[],
  label = 'Faixa',
): string | null {
  if (schedule.length === 0) {
    return `${label}: informe pelo menos uma faixa (começando em 00:00).`
  }
  if (schedule.length > MAX_RATIO_SEGMENTS) {
    return `${label}: no máximo ${MAX_RATIO_SEGMENTS} faixas.`
  }
  let hasMidnight = false
  const starts = new Set<number>()
  for (const s of schedule) {
    if (
      !Number.isFinite(s.start_minute) ||
      s.start_minute < 0 ||
      s.start_minute > 1439
    ) {
      return `${label}: horário inválido.`
    }
    if (!Number.isFinite(s.value) || s.value <= 0) {
      return `${label}: valor deve ser positivo.`
    }
    if (starts.has(s.start_minute)) {
      return `${label}: horários de início duplicados.`
    }
    starts.add(s.start_minute)
    if (s.start_minute === 0) hasMidnight = true
  }
  if (!hasMidnight) {
    return `${label}: é obrigatório ter uma faixa começando em 00:00.`
  }
  return null
}

export function mirrorMidnightValue(
  schedule: RatioSegment[],
): number | null {
  for (const s of schedule) {
    if (s.start_minute === 0) return s.value
  }
  return schedule.length > 0 ? schedule[0].value : null
}

export function resolveRatioSchedule(
  schedule: RatioSegment[],
  minuteOfDay: number,
  fallback?: number | null,
): RatioResolveResult | null {
  const minute = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440
  const normalized = normalizeRatioSchedule(schedule, fallback)
  if (normalized.length === 0) {
    if (fallback != null && Number.isFinite(fallback) && fallback > 0) {
      return {
        value: fallback,
        segment: { start_minute: 0, value: fallback },
        end_minute: 1440,
        range_label: rangeLabel(0, 1440),
      }
    }
    return null
  }

  let active = normalized[0]
  for (const s of normalized) {
    if (s.start_minute <= minute) active = s
    else break
  }

  const idx = normalized.indexOf(active)
  const endMinute =
    idx + 1 < normalized.length ? normalized[idx + 1].start_minute : 1440

  return {
    value: active.value,
    segment: active,
    end_minute: endMinute,
    range_label: rangeLabel(active.start_minute, endMinute),
  }
}

export function parseRatioSchedule(raw: unknown): RatioSegment[] {
  if (!Array.isArray(raw)) return []
  const out: RatioSegment[] = []
  for (const e of raw) {
    if (e == null || typeof e !== 'object') continue
    const row = e as Record<string, unknown>
    const start = Number(row.start_minute)
    const value = Number(row.value)
    if (!Number.isFinite(start) || !Number.isFinite(value)) continue
    out.push({ start_minute: Math.round(start), value })
    if (out.length >= MAX_RATIO_SEGMENTS) break
  }
  return out
}

/** Patch midnight band (and scalar mirror) for AI single-value suggestions. */
export function patchMidnightSegment(
  schedule: RatioSegment[],
  value: number,
  fallbackScalar?: number | null,
): RatioSegment[] {
  const base = normalizeRatioSchedule(schedule, fallbackScalar)
  if (base.length === 0) {
    return [{ start_minute: 0, value }]
  }
  return base.map((s) =>
    s.start_minute === 0 ? { ...s, value } : s,
  )
}

export function formatRatioScheduleSummary(
  schedule: RatioSegment[],
  unitLabel: string,
): string {
  if (schedule.length === 0) return '—'
  const sorted = [...schedule].sort(
    (a, b) => a.start_minute - b.start_minute,
  )
  return sorted
    .map((s, i) => {
      const end =
        i + 1 < sorted.length ? sorted[i + 1].start_minute : 1440
      return `${rangeLabel(s.start_minute, end)}: ${s.value} ${unitLabel}`
    })
    .join('; ')
}
