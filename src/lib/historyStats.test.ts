import { describe, expect, it, vi } from 'vitest'
import { makeEntry, makeProfile } from '../test/fixtures'
import {
  brazilMinuteOfDay,
  glucoseToneClass,
  glucoseZone,
  historyStatsFromEntries,
  isInTarget,
  isNightWindow,
  resolveTargetMgdl,
} from './historyStats'

describe('glucoseZone', () => {
  it('classifies hypo, in-range, and hyper at boundaries', () => {
    expect(glucoseZone(69.9)).toBe('hypo')
    expect(glucoseZone(70)).toBe('inRange')
    expect(glucoseZone(180)).toBe('inRange')
    expect(glucoseZone(180.1)).toBe('hyper')
  })
})

describe('isNightWindow', () => {
  it('returns false when start equals end', () => {
    expect(isNightWindow(100, 50, 50)).toBe(false)
  })

  it('handles non-crossing window', () => {
    expect(isNightWindow(10, 0, 60)).toBe(true)
    expect(isNightWindow(0, 0, 60)).toBe(true)
    expect(isNightWindow(60, 0, 60)).toBe(true)
    expect(isNightWindow(61, 0, 60)).toBe(false)
  })

  it('handles midnight-crossing window', () => {
    const start = 22 * 60
    const end = 6 * 60
    expect(isNightWindow(23 * 60, start, end)).toBe(true)
    expect(isNightWindow(3 * 60, start, end)).toBe(true)
    expect(isNightWindow(12 * 60, start, end)).toBe(false)
    expect(isNightWindow(start, start, end)).toBe(true)
    expect(isNightWindow(end, start, end)).toBe(true)
  })
})

describe('brazilMinuteOfDay', () => {
  it('returns minute of day in America/Sao_Paulo', () => {
    // 15:00 UTC = 12:00 BRT (UTC-3 in June)
    const minute = brazilMinuteOfDay('2024-06-15T15:00:00.000Z')
    expect(minute).toBe(12 * 60)
  })

  it('treats hour 24 as midnight and defaults missing parts to 0', () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')
    spy.mockReturnValueOnce([
      { type: 'hour', value: '24' },
      { type: 'minute', value: '30' },
    ] as Intl.DateTimeFormatPart[])
    expect(brazilMinuteOfDay('2024-01-01T00:00:00.000Z')).toBe(30)

    spy.mockReturnValueOnce([] as Intl.DateTimeFormatPart[])
    expect(brazilMinuteOfDay('2024-01-01T00:00:00.000Z')).toBe(0)
    spy.mockRestore()
  })
})

describe('resolveTargetMgdl', () => {
  const profile = makeProfile({
    target_glucose_mgdl: 110,
    target_night_mgdl: 130,
    night_start_minute: 22 * 60,
    night_end_minute: 6 * 60,
  })

  it('uses day and night targets', () => {
    expect(resolveTargetMgdl(profile, '2024-06-15T15:00:00.000Z')).toBe(110)
    // 03:00 BRT = 06:00 UTC
    expect(resolveTargetMgdl(profile, '2024-06-15T06:00:00.000Z')).toBe(130)
  })

  it('defaults day target to 110 and night to day', () => {
    const noTargets = makeProfile({
      target_glucose_mgdl: null,
      target_night_mgdl: null,
      night_start_minute: 0,
      night_end_minute: 0,
    })
    expect(resolveTargetMgdl(noTargets, '2024-06-15T15:00:00.000Z')).toBe(110)

    const nightFallback = makeProfile({
      target_glucose_mgdl: 100,
      target_night_mgdl: null,
      night_start_minute: 22 * 60,
      night_end_minute: 6 * 60,
    })
    expect(resolveTargetMgdl(nightFallback, '2024-06-15T06:00:00.000Z')).toBe(100)
  })
})

describe('isInTarget', () => {
  it('includes ±20% boundaries', () => {
    expect(isInTarget(88, 110)).toBe(true)
    expect(isInTarget(132, 110)).toBe(true)
    expect(isInTarget(87, 110)).toBe(false)
    expect(isInTarget(133, 110)).toBe(false)
  })

  it('accepts custom tolerance', () => {
    expect(isInTarget(100, 100, 0)).toBe(true)
    expect(isInTarget(101, 100, 0)).toBe(false)
  })
})

describe('glucoseToneClass', () => {
  it('marks hypo as danger regardless of target', () => {
    expect(glucoseToneClass(60, 110)).toBe('text-danger')
  })

  it('uses target bands when target is set', () => {
    expect(glucoseToneClass(110, 110)).toBe('text-ok')
    expect(glucoseToneClass(140, 110)).toBe('text-warning')
    // high = 132, high*1.15 = 151.8
    expect(glucoseToneClass(160, 110)).toBe('text-danger')
  })

  it('falls back without target', () => {
    expect(glucoseToneClass(100, null)).toBe('text-ink')
    expect(glucoseToneClass(150, undefined)).toBe('text-warning')
    expect(glucoseToneClass(190, 0)).toBe('text-danger')
  })
})

describe('historyStatsFromEntries', () => {
  it('returns empty stats for empty entries', () => {
    const stats = historyStatsFromEntries([], makeProfile())
    expect(stats.count).toBe(0)
    expect(stats.avgGlucose).toBeNull()
    expect(stats.inTargetPercent).toBeNull()
    expect(stats.dayTargetMgdl).toBe(110)
    expect(stats.nightTargetMgdl).toBe(120)
  })

  it('nulls inTargetPercent without profile and skips target counting', () => {
    const stats = historyStatsFromEntries(
      [makeEntry({ glucose_mgdl: 110 })],
      null,
    )
    expect(stats.inTargetPercent).toBeNull()
    expect(stats.inTargetCount).toBe(0)
    expect(stats.dayTargetMgdl).toBeNull()
    expect(stats.nightTargetMgdl).toBeNull()
  })

  it('aggregates glucose zones, insulin, dose delta, and carbs', () => {
    const entries = [
      makeEntry({
        id: '1',
        glucose_mgdl: 60,
        applied_insulin: 2,
        recommended_insulin: 3,
        gpt_raw_response: { carboidratos_g: 40 },
      }),
      makeEntry({
        id: '2',
        glucose_mgdl: 120,
        applied_insulin: 4,
        recommended_insulin: 4,
        gpt_raw_response: { carboidratos_g: 50 },
      }),
      makeEntry({
        id: '3',
        glucose_mgdl: 200,
        applied_insulin: null,
        recommended_insulin: null,
        gpt_raw_response: null,
      }),
    ]
    const stats = historyStatsFromEntries(entries, makeProfile())
    expect(stats.count).toBe(3)
    expect(stats.avgGlucose).toBeCloseTo(380 / 3)
    expect(stats.minGlucose).toBe(60)
    expect(stats.maxGlucose).toBe(200)
    expect(stats.hypoCount).toBe(1)
    expect(stats.hyperCount).toBe(1)
    expect(stats.inRange70_180Count).toBe(1)
    expect(stats.appliedCount).toBe(2)
    expect(stats.recommendedCount).toBe(2)
    expect(stats.avgDoseDeltaU).toBeCloseTo(0.5)
    expect(stats.doseDeltaCount).toBe(2)
    expect(stats.avgCarbsG).toBe(45)
    expect(stats.carbsCount).toBe(2)
    expect(stats.glucoseSd).not.toBeNull()
    expect(stats.glucoseCvPercent).not.toBeNull()
  })

  it('nulls CV when only one reading', () => {
    const stats = historyStatsFromEntries(
      [makeEntry({ glucose_mgdl: 100 })],
      makeProfile(),
    )
    expect(stats.glucoseSd).toBeNull()
    expect(stats.glucoseCvPercent).toBeNull()
  })

  it('nulls insulin averages when none present', () => {
    const stats = historyStatsFromEntries(
      [
        makeEntry({
          applied_insulin: null,
          recommended_insulin: null,
          gpt_raw_response: {},
        }),
      ],
      makeProfile(),
    )
    expect(stats.avgAppliedU).toBeNull()
    expect(stats.avgDoseDeltaU).toBeNull()
    expect(stats.avgCarbsG).toBeNull()
  })

  it('nulls CV when avgGlucose is 0', () => {
    const stats = historyStatsFromEntries(
      [makeEntry({ glucose_mgdl: 0 }), makeEntry({ id: '2', glucose_mgdl: 0 })],
      makeProfile(),
    )
    expect(stats.avgGlucose).toBe(0)
    expect(stats.glucoseSd).not.toBeNull()
    expect(stats.glucoseCvPercent).toBeNull()
  })

  it('updates min when a later reading is lower', () => {
    const stats = historyStatsFromEntries(
      [
        makeEntry({ glucose_mgdl: 150 }),
        makeEntry({ id: '2', glucose_mgdl: 80 }),
      ],
      makeProfile(),
    )
    expect(stats.minGlucose).toBe(80)
    expect(stats.maxGlucose).toBe(150)
  })
})
