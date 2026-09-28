import { describe, expect, it } from 'vitest'
import {
  carbsFromEntry,
  computeHistoryAiStats,
  type HistoryAiEntry,
  type HistoryAiProfile,
} from '../../supabase/functions/_shared/historyAiMetrics'

const profile: HistoryAiProfile = {
  target_glucose_mgdl: 110,
  target_night_mgdl: 140,
  night_start_minute: 22 * 60,
  night_end_minute: 6 * 60,
}

function entry(
  partial: Partial<HistoryAiEntry> &
    Pick<HistoryAiEntry, 'recorded_at' | 'glucose_mgdl'>,
): HistoryAiEntry {
  return {
    recommended_insulin: null,
    applied_insulin: null,
    gpt_raw_response: null,
    ...partial,
  }
}

describe('computeHistoryAiStats', () => {
  it('returns empty metrics when there are no entries', () => {
    const stats = computeHistoryAiStats([], profile)
    expect(stats.count).toBe(0)
    expect(stats.severeHypoPercent).toBeNull()
    expect(stats.doseGapPercent).toBeNull()
    expect(stats.day.count).toBe(0)
    expect(stats.night.count).toBe(0)
    expect(stats.bands.map((band) => band.faixa)).toEqual([
      'madrugada',
      'manha',
      'almoco',
      'tarde',
      'noite',
    ])
  })

  it('splits severe hypos, night, day bands and dose bias', () => {
    const stats = computeHistoryAiStats(
      [
        entry({
          recorded_at: '2024-06-15T15:00:00.000Z',
          glucose_mgdl: 120,
          recommended_insulin: 6,
          applied_insulin: 3,
          gpt_raw_response: { carboidratos_g: '40,5' },
        }),
        entry({
          recorded_at: '2024-06-15T06:00:00.000Z',
          glucose_mgdl: 50,
          recommended_insulin: 2,
          applied_insulin: 5,
        }),
        entry({
          recorded_at: '2024-06-15T19:00:00.000Z',
          glucose_mgdl: 260,
        }),
        entry({
          recorded_at: '2024-06-15T11:00:00.000Z',
          glucose_mgdl: 65,
          recommended_insulin: 4,
          applied_insulin: 3.5,
          gpt_raw_response: { carboidratos_g: 'nope' },
        }),
        entry({
          recorded_at: '2024-06-15T22:00:00.000Z',
          glucose_mgdl: 100,
          gpt_raw_response: [],
        }),
      ],
      profile,
    )

    expect(stats.severeHypoCount).toBe(1)
    expect(stats.severeHypoPercent).toBe(20)
    expect(stats.veryHighCount).toBe(1)
    expect(stats.hypoCount).toBe(2)
    expect(stats.inRange70_180Percent).toBe(40)
    expect(stats.avgCarbsG).toBe(40.5)
    expect(stats.doseGapCount).toBe(2)
    expect(stats.doseGapPercent).toBe(66.7)
    expect(stats.appliedLessCount).toBe(1)
    expect(stats.appliedMoreCount).toBe(1)

    expect(stats.night).toMatchObject({
      count: 1,
      avgGlucose: 50,
      hypoCount: 1,
      severeHypoCount: 1,
      inRange70_180Percent: 0,
    })
    expect(stats.day).toMatchObject({
      count: 4,
      hypoCount: 1,
      severeHypoCount: 0,
    })

    const byBand = Object.fromEntries(
      stats.bands.map((band) => [band.faixa, band]),
    )
    expect(byBand.madrugada).toMatchObject({ count: 1, hypoCount: 1, avgGlucose: 50 })
    expect(byBand.manha).toMatchObject({ count: 1, avgGlucose: 65, hypoCount: 1 })
    expect(byBand.almoco).toMatchObject({ count: 1, avgGlucose: 120, hypoCount: 0 })
    expect(byBand.tarde).toMatchObject({ count: 1, avgGlucose: 260 })
    expect(byBand.noite).toMatchObject({ count: 1, avgGlucose: 100, hypoCount: 0 })
  })

  it('treats a non-wrapping night window and equal bounds', () => {
    const atNight = entry({
      recorded_at: '2024-06-15T06:00:00.000Z',
      glucose_mgdl: 90,
    })
    const inside = computeHistoryAiStats([atNight], {
      ...profile,
      night_start_minute: 60,
      night_end_minute: 6 * 60,
    })
    expect(inside.night.count).toBe(1)
    expect(inside.day.count).toBe(0)

    const collapsed = computeHistoryAiStats([atNight], {
      ...profile,
      night_start_minute: 120,
      night_end_minute: 120,
    })
    expect(collapsed.night.count).toBe(0)
    expect(collapsed.day.count).toBe(1)
  })
})

describe('carbsFromEntry', () => {
  it('reads numeric and blank carb fields', () => {
    expect(
      carbsFromEntry(
        entry({
          recorded_at: '2024-06-15T15:00:00.000Z',
          glucose_mgdl: 100,
          gpt_raw_response: { carboidratos_g: 12 },
        }),
      ),
    ).toBe(12)
    expect(
      carbsFromEntry(
        entry({
          recorded_at: '2024-06-15T15:00:00.000Z',
          glucose_mgdl: 100,
          gpt_raw_response: { carboidratos_g: '  ' },
        }),
      ),
    ).toBeNull()
  })
})
