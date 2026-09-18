import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../test/fixtures'
import { createQueryBuilder } from '../test/supabaseMock'

const fromMock = vi.fn()
vi.mock('./supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { fetchPatientEntries } from './entriesApi'

describe('fetchPatientEntries', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('fetches a page with defaults and exact count', async () => {
    const entries = [makeEntry()]
    const builder = createQueryBuilder({ data: entries, error: null, count: 12 })
    fromMock.mockReturnValue(builder)

    const result = await fetchPatientEntries('patient-1', {
      mode: 'page',
      page: 1,
      sort: 'newest',
    })

    expect(fromMock).toHaveBeenCalledWith('entries')
    expect(builder.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'patient-1')
    expect(builder.order).toHaveBeenCalledWith('recorded_at', { ascending: false })
    expect(builder.range).toHaveBeenCalledWith(50, 99)
    expect(result).toEqual({ entries, total: 12 })
  })

  it('uses custom pageSize and oldest sort', async () => {
    const builder = createQueryBuilder({ data: null, error: null, count: null })
    fromMock.mockReturnValue(builder)

    const result = await fetchPatientEntries('p', {
      mode: 'page',
      page: 0,
      pageSize: 10,
      sort: 'oldest',
    })

    expect(builder.order).toHaveBeenCalledWith('recorded_at', { ascending: true })
    expect(builder.range).toHaveBeenCalledWith(0, 9)
    expect(result.entries).toEqual([])
    expect(result.total).toBe(0)
  })

  it('throws on page mode error', async () => {
    const err = { message: 'fail' }
    fromMock.mockReturnValue(createQueryBuilder({ data: null, error: err }))
    await expect(
      fetchPatientEntries('p', { mode: 'page', page: 0, sort: 'newest' }),
    ).rejects.toEqual(err)
  })

  it('fetches series with period filter', async () => {
    const entries = [makeEntry()]
    const builder = createQueryBuilder({ data: entries, error: null })
    fromMock.mockReturnValue(builder)

    const result = await fetchPatientEntries('patient-1', {
      mode: 'series',
      period: 'days7',
    })

    expect(builder.gte).toHaveBeenCalled()
    expect(builder.limit).not.toHaveBeenCalled()
    expect(result).toEqual({ entries, total: null })
  })

  it('limits when period is all', async () => {
    const builder = createQueryBuilder({ data: null, error: null })
    fromMock.mockReturnValue(builder)

    const result = await fetchPatientEntries('patient-1', {
      mode: 'series',
      period: 'all',
    })

    expect(builder.limit).toHaveBeenCalledWith(200)
    expect(result.entries).toEqual([])
    expect(result.total).toBeNull()
  })

  it('uses custom allLimit and throws on series error', async () => {
    const err = { message: 'boom' }
    const builder = createQueryBuilder({ data: null, error: err })
    fromMock.mockReturnValue(builder)

    await expect(
      fetchPatientEntries('p', { mode: 'series', period: 'all', allLimit: 5 }),
    ).rejects.toEqual(err)
    expect(builder.limit).toHaveBeenCalledWith(5)
  })
})
