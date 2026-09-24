import { describe, expect, it } from 'vitest'
import {
  mirrorMidnightValue,
  normalizeRatioSchedule,
  resolveRatioSchedule,
  validateRatioSchedule,
} from './ratioSchedule'

describe('ratioSchedule', () => {
  it('requires midnight band and positive values', () => {
    expect(
      validateRatioSchedule([{ start_minute: 360, value: 40 }], 'FSI'),
    ).toMatch(/00:00/)
    expect(
      validateRatioSchedule([{ start_minute: 0, value: 0 }], 'FSI'),
    ).toMatch(/positivo/)
    expect(
      validateRatioSchedule([{ start_minute: 0, value: 40 }], 'FSI'),
    ).toBeNull()
  })

  it('resolves active band by minute of day', () => {
    const schedule = normalizeRatioSchedule([
      { start_minute: 0, value: 50 },
      { start_minute: 360, value: 40 },
      { start_minute: 720, value: 35 },
    ])
    expect(resolveRatioSchedule(schedule, 100)?.value).toBe(50)
    expect(resolveRatioSchedule(schedule, 400)?.value).toBe(40)
    expect(resolveRatioSchedule(schedule, 800)?.range_label).toBe('12:00–24:00')
    expect(mirrorMidnightValue(schedule)).toBe(50)
  })

  it('falls back to scalar when schedule empty', () => {
    expect(resolveRatioSchedule([], 500, 42)?.value).toBe(42)
  })
})
