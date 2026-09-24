import { describe, expect, it } from 'vitest'
import { formatMinuteOfDay, parseMinuteOfDay } from './timeOfDay'
import { mapSugestaoToProfilePatch } from './analyzeHistoryApi'
import { makeProfile } from '../test/fixtures'

describe('timeOfDay', () => {
  it('formats and parses minutes', () => {
    expect(formatMinuteOfDay(1200)).toBe('20:00')
    expect(parseMinuteOfDay('05:59')).toBe(359)
  })
})

describe('mapSugestaoToProfilePatch', () => {
  it('maps FSI and I:C values onto midnight band', () => {
    const profile = makeProfile({
      isf_schedule: [
        { start_minute: 0, value: 50 },
        { start_minute: 360, value: 40 },
      ],
      ic_schedule: [{ start_minute: 0, value: 10 }],
    })
    expect(
      mapSugestaoToProfilePatch(
        { parametro: 'FSI', observacao: 'teste', valor_sugerido: 45 },
        profile,
      ),
    ).toEqual({
      isf_mgdl_per_u: 45,
      isf_schedule: [
        { start_minute: 0, value: 45 },
        { start_minute: 360, value: 40 },
      ],
    })
    expect(
      mapSugestaoToProfilePatch(
        { parametro: 'I:C', observacao: 'teste', valor_sugerido: 12 },
        profile,
      ),
    ).toEqual({
      ic_ratio: 12,
      ic_schedule: [{ start_minute: 0, value: 12 }],
    })
  })

  it('returns null without numeric value', () => {
    expect(
      mapSugestaoToProfilePatch(
        { parametro: 'FSI', observacao: 'só texto' },
        makeProfile(),
      ),
    ).toBeNull()
  })
})
