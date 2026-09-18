import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeDoctor, makeDoctorFields } from '../test/fixtures'
import { createQueryBuilder } from '../test/supabaseMock'

const fromMock = vi.fn()
vi.mock('./supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { updateDoctorProfile } from './doctorsApi'

describe('updateDoctorProfile', () => {
  beforeEach(() => {
    fromMock.mockReset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('updates profile and sets profile_completed_at when missing', async () => {
    const builder = createQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValue(builder)
    const doctor = makeDoctor({ profile_completed_at: null })
    const fields = makeDoctorFields({ rqe: '', address_complement: '' })

    await updateDoctorProfile(doctor, fields)

    expect(fromMock).toHaveBeenCalledWith('doctors')
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        rqe: null,
        address_complement: null,
        profile_completed_at: '2024-06-01T12:00:00.000Z',
        updated_at: '2024-06-01T12:00:00.000Z',
      }),
    )
    expect(builder.eq).toHaveBeenCalledWith('id', doctor.id)
  })

  it('preserves existing profile_completed_at and non-empty optional fields', async () => {
    const builder = createQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValue(builder)
    const doctor = makeDoctor({ profile_completed_at: '2023-01-01T00:00:00.000Z' })
    const fields = makeDoctorFields({ rqe: '123', address_complement: 'Sala 1' })

    await updateDoctorProfile(doctor, fields)

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        rqe: '123',
        address_complement: 'Sala 1',
        profile_completed_at: '2023-01-01T00:00:00.000Z',
      }),
    )
  })

  it('throws on supabase error', async () => {
    const err = { message: 'db' }
    fromMock.mockReturnValue(createQueryBuilder({ data: null, error: err }))
    await expect(
      updateDoctorProfile(makeDoctor(), makeDoctorFields()),
    ).rejects.toEqual(err)
  })
})
