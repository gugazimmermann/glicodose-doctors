import { describe, expect, it } from 'vitest'
import { isDoctorProfileComplete, isDoctorSupporter } from './database'
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

describe('isDoctorSupporter', () => {
  it('treats active, grace and canceled as supporter', () => {
    expect(isDoctorSupporter(null)).toBe(false)
    expect(isDoctorSupporter(makeDoctor({ supporter_status: 'none' }))).toBe(false)
    expect(isDoctorSupporter(makeDoctor({ supporter_status: 'expired' }))).toBe(
      false,
    )
    expect(isDoctorSupporter(makeDoctor({ supporter_status: 'active' }))).toBe(true)
    expect(isDoctorSupporter(makeDoctor({ supporter_status: 'grace' }))).toBe(true)
    expect(isDoctorSupporter(makeDoctor({ supporter_status: 'canceled' }))).toBe(
      true,
    )
  })
})
