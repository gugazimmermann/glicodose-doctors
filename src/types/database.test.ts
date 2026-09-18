import { describe, expect, it } from 'vitest'
import { isDoctorProfileComplete } from './database'
import { makeDoctor } from '../test/fixtures'

describe('isDoctorProfileComplete', () => {
  it('returns false for null doctor or empty timestamp', () => {
    expect(isDoctorProfileComplete(null)).toBe(false)
    expect(isDoctorProfileComplete(makeDoctor({ profile_completed_at: null }))).toBe(
      false,
    )
    expect(isDoctorProfileComplete(makeDoctor({ profile_completed_at: '' }))).toBe(
      false,
    )
  })

  it('returns true when profile_completed_at is set', () => {
    expect(isDoctorProfileComplete(makeDoctor())).toBe(true)
  })
})
