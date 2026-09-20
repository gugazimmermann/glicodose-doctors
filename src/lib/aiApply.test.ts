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
  it('maps FSI and I:C values', () => {
    const profile = makeProfile()
    expect(
      mapSugestaoToProfilePatch(
        { parametro: 'FSI', observacao: 'teste', valor_sugerido: 40 },
        profile,
      ),
    ).toEqual({ isf_mgdl_per_u: 40 })
    expect(
      mapSugestaoToProfilePatch(
        { parametro: 'I:C', observacao: 'teste', valor_sugerido: 12 },
        profile,
      ),
    ).toEqual({ ic_ratio: 12 })
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
