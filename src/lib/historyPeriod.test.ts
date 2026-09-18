import { describe, expect, it } from 'vitest'
import {
  HISTORY_PERIOD_LABELS,
  HISTORY_PERIODS,
  historyPeriodSince,
} from './historyPeriod'

describe('historyPeriod', () => {
  it('exposes periods and labels', () => {
    expect(HISTORY_PERIODS).toEqual(['days7', 'days30', 'all'])
    expect(HISTORY_PERIOD_LABELS.days7).toBe('7 dias')
    expect(HISTORY_PERIOD_LABELS.days30).toBe('30 dias')
    expect(HISTORY_PERIOD_LABELS.all).toBe('Tudo')
  })

  it('computes cutoffs from a fixed now', () => {
    const now = new Date('2024-06-15T12:00:00.000Z')
    expect(historyPeriodSince('days7', now)?.toISOString()).toBe(
      '2024-06-08T12:00:00.000Z',
    )
    expect(historyPeriodSince('days30', now)?.toISOString()).toBe(
      '2024-05-16T12:00:00.000Z',
    )
    expect(historyPeriodSince('all', now)).toBeNull()
  })

  it('defaults now when omitted', () => {
    const before = Date.now()
    const since = historyPeriodSince('days7')
    const after = Date.now()
    expect(since).not.toBeNull()
    const expectedMin = before - 7 * 24 * 60 * 60 * 1000
    const expectedMax = after - 7 * 24 * 60 * 60 * 1000
    expect(since!.getTime()).toBeGreaterThanOrEqual(expectedMin - 5)
    expect(since!.getTime()).toBeLessThanOrEqual(expectedMax + 5)
  })
})
