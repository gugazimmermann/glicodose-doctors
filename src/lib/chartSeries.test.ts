import { describe, expect, it } from 'vitest'
import { makeEntry, makeProfile } from '../test/fixtures'
import {
  brazilDayKey,
  buildCarbsSeries,
  buildGlucoseSeries,
  buildInsulinSeries,
  DENSE_SERIES_THRESHOLD,
  glucoseYDomain,
} from './chartSeries'

function manyEntries(
  count: number,
  factory: (i: number) => ReturnType<typeof makeEntry>,
) {
  return Array.from({ length: count }, (_, i) => factory(i))
}

describe('brazilDayKey', () => {
  it('formats YYYY-MM-DD in America/Sao_Paulo', () => {
    expect(brazilDayKey('2024-06-15T15:00:00.000Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('buildGlucoseSeries', () => {
  it('returns empty for no entries', () => {
    expect(buildGlucoseSeries([], makeProfile())).toEqual([])
  })

  it('builds sparse points without aggregation', () => {
    const points = buildGlucoseSeries(
      [makeEntry({ glucose_mgdl: 90 }), makeEntry({ id: '2', glucose_mgdl: 200 })],
      makeProfile(),
    )
    expect(points).toHaveLength(2)
    expect(points[0].aggregated).toBe(false)
    expect(points[0].zone).toBe('inRange')
    expect(points[1].zone).toBe('hyper')
    expect(points[0].target).toBe(110)
  })

  it('nulls target without profile', () => {
    const points = buildGlucoseSeries([makeEntry()], null)
    expect(points[0].target).toBeNull()
  })

  it('aggregates when denser than threshold', () => {
    const entries = manyEntries(DENSE_SERIES_THRESHOLD + 1, (i) =>
      makeEntry({
        id: `e-${i}`,
        recorded_at: `2024-05-${String((i % 28) + 1).padStart(2, '0')}T15:00:00.000Z`,
        glucose_mgdl: 100 + (i % 3),
      }),
    )
    entries[0] = makeEntry({
      id: 'same-a',
      recorded_at: '2024-09-10T12:00:00.000Z',
      glucose_mgdl: 100,
    })
    entries[1] = makeEntry({
      id: 'same-b',
      recorded_at: '2024-09-10T18:00:00.000Z',
      glucose_mgdl: 120,
    })

    const points = buildGlucoseSeries(entries, makeProfile())
    expect(points.every((p) => p.aggregated)).toBe(true)
    const day1 = points.find((p) => p.readingCount > 1)
    expect(day1).toBeDefined()
    expect(day1!.when).toContain('leituras')
    expect(day1!.glucose).toBe(110)

    const singles = points.filter((p) => p.readingCount === 1)
    expect(singles[0]?.when).not.toContain('leituras')
  })
})

describe('buildInsulinSeries', () => {
  it('returns empty when no doses', () => {
    expect(
      buildInsulinSeries([
        makeEntry({ recommended_insulin: null, applied_insulin: null }),
      ]),
    ).toEqual([])
  })

  it('builds sparse insulin points', () => {
    const points = buildInsulinSeries([
      makeEntry({ recommended_insulin: 4, applied_insulin: null }),
    ])
    expect(points).toHaveLength(1)
    expect(points[0].aggregated).toBe(false)
    expect(points[0].recommended).toBe(4)
    expect(points[0].applied).toBeNull()
  })

  it('aggregates dense insulin with special and total labels', () => {
    const entries = manyEntries(DENSE_SERIES_THRESHOLD + 1, (i) =>
      makeEntry({
        id: `ins-${i}`,
        recorded_at: `2024-05-${String((i % 28) + 1).padStart(2, '0')}T15:00:00.000Z`,
        recommended_insulin: 2,
        applied_insulin: 2,
      }),
    )
    // one day with single recommended only → special label path
    entries[0] = makeEntry({
      id: 'solo',
      recorded_at: '2024-07-01T15:00:00.000Z',
      recommended_insulin: 3,
      applied_insulin: null,
    })
    // one day with many doses → totais do dia
    entries[1] = makeEntry({
      id: 'm1',
      recorded_at: '2024-07-02T12:00:00.000Z',
      recommended_insulin: 2,
      applied_insulin: 2,
    })
    entries[2] = makeEntry({
      id: 'm2',
      recorded_at: '2024-07-02T18:00:00.000Z',
      recommended_insulin: 3,
      applied_insulin: 1,
    })

    const points = buildInsulinSeries(entries)
    expect(points.every((p) => p.aggregated)).toBe(true)
    const solo = points.find((p) => p.recommended === 3 && p.applied === null)
    expect(solo?.when).not.toContain('totais')
    const busy = points.find((p) => p.readingCount >= 2)
    expect(busy?.when).toContain('totais do dia')
  })
})

describe('buildCarbsSeries', () => {
  it('returns empty without carbs', () => {
    expect(buildCarbsSeries([makeEntry({ gpt_raw_response: null })])).toEqual([])
  })

  it('builds sparse carbs points', () => {
    const points = buildCarbsSeries([makeEntry()])
    expect(points).toHaveLength(1)
    expect(points[0].carbs).toBe(45)
    expect(points[0].aggregated).toBe(false)
  })

  it('aggregates dense carbs with mean labels', () => {
    const entries = manyEntries(DENSE_SERIES_THRESHOLD + 1, (i) =>
      makeEntry({
        id: `c-${i}`,
        recorded_at: `2024-04-${String((i % 28) + 1).padStart(2, '0')}T15:00:00.000Z`,
        gpt_raw_response: { carboidratos_g: 40 },
      }),
    )
    entries[0] = makeEntry({
      id: 'c-same-a',
      recorded_at: '2024-08-01T12:00:00.000Z',
      gpt_raw_response: { carboidratos_g: 40 },
    })
    entries[1] = makeEntry({
      id: 'c-same-b',
      recorded_at: '2024-08-01T18:00:00.000Z',
      gpt_raw_response: { carboidratos_g: 60 },
    })

    const points = buildCarbsSeries(entries)
    expect(points.every((p) => p.aggregated)).toBe(true)
    const multi = points.find((p) => p.readingCount > 1)
    expect(multi?.carbs).toBe(50)
    expect(multi?.when).toContain('refeições')
    const single = points.find((p) => p.readingCount === 1)
    expect(single?.when).not.toContain('refeições')
  })
})

describe('dense series edge labels', () => {
  it('covers insulin dense special label when only applied is single', () => {
    const entries = manyEntries(DENSE_SERIES_THRESHOLD + 1, (i) =>
      makeEntry({
        id: `ins-a-${i}`,
        recorded_at: `2024-03-${String((i % 28) + 1).padStart(2, '0')}T15:00:00.000Z`,
        recommended_insulin: null,
        applied_insulin: 2,
      }),
    )
    entries[0] = makeEntry({
      id: 'only-app',
      recorded_at: '2024-10-01T15:00:00.000Z',
      recommended_insulin: null,
      applied_insulin: 5,
    })
    const points = buildInsulinSeries(entries)
    const solo = points.find((p) => p.applied === 5 && p.recommended === null)
    expect(solo).toBeDefined()
    expect(solo!.when).not.toContain('totais')
  })

  it('covers glucose aggregated single-day when count is 1 in dense map', () => {
    const entries = manyEntries(DENSE_SERIES_THRESHOLD + 1, (i) =>
      makeEntry({
        id: `g-${i}`,
        recorded_at: `2024-02-${String((i % 28) + 1).padStart(2, '0')}T15:00:00.000Z`,
        glucose_mgdl: 100,
      }),
    )
    const points = buildGlucoseSeries(entries, null)
    expect(
      points.some((p) => p.readingCount === 1 && !p.when.includes('leituras')),
    ).toBe(true)
    expect(points[0].target).toBeNull()
  })
})

describe('glucoseYDomain', () => {
  it('pads clinical band and clamps floor at 40', () => {
    expect(glucoseYDomain([])).toEqual([50, 200])
    expect(
      glucoseYDomain([
        {
          index: 0,
          label: 'x',
          when: 'x',
          glucose: 30,
          zone: 'hypo',
          target: null,
          readingCount: 1,
          aggregated: false,
        },
        {
          index: 1,
          label: 'y',
          when: 'y',
          glucose: 250,
          zone: 'hyper',
          target: null,
          readingCount: 1,
          aggregated: false,
        },
      ]),
    ).toEqual([40, 270])
  })
})
