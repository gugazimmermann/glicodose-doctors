import { describe, expect, it } from 'vitest'
import { computeDeterministicAlerts } from './clinicalAlerts'
import { makeEntry, makeProfile } from '../test/fixtures'

describe('computeDeterministicAlerts', () => {
  it('flags consecutive hypos', () => {
    const profile = makeProfile()
    const entries = [
      makeEntry({ id: '1', glucose_mgdl: 55, recorded_at: '2026-01-03T12:00:00Z' }),
      makeEntry({ id: '2', glucose_mgdl: 60, recorded_at: '2026-01-02T12:00:00Z' }),
      makeEntry({ id: '3', glucose_mgdl: 65, recorded_at: '2026-01-01T12:00:00Z' }),
    ]
    const alerts = computeDeterministicAlerts(entries, profile)
    expect(alerts.some((a) => a.id === 'hypo-streak')).toBe(true)
  })

  it('flags large dose gaps', () => {
    const profile = makeProfile()
    const entries = [
      makeEntry({
        id: '1',
        recommended_insulin: 8,
        applied_insulin: 4,
        recorded_at: '2026-01-03T12:00:00Z',
      }),
      makeEntry({
        id: '2',
        recommended_insulin: 7,
        applied_insulin: 3,
        recorded_at: '2026-01-02T12:00:00Z',
      }),
      makeEntry({
        id: '3',
        recommended_insulin: 6,
        applied_insulin: 2,
        recorded_at: '2026-01-01T12:00:00Z',
      }),
    ]
    const alerts = computeDeterministicAlerts(entries, profile)
    expect(alerts.some((a) => a.id === 'dose-gap')).toBe(true)
  })
})
