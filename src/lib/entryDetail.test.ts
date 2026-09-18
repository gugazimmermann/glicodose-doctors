import { describe, expect, it } from 'vitest'
import { makeEntry } from '../test/fixtures'
import {
  formatMetaLabel,
  parseEntryRecommendation,
} from './entryDetail'

describe('parseEntryRecommendation', () => {
  it('returns nulls for non-object gpt payload and falls back insulin', () => {
    const entry = makeEntry({
      gpt_raw_response: ['not', 'object'],
      recommended_insulin: 5,
    })
    expect(parseEntryRecommendation(entry)).toEqual({
      carboidratosG: null,
      correcaoU: null,
      bolusComidaU: null,
      iobU: null,
      insulinaRecomendadaU: 5,
      observacao: null,
      metaMgdl: null,
      metaPeriodo: null,
      source: null,
    })
  })

  it('parses numbers, comma strings, and trims strings', () => {
    const entry = makeEntry({
      gpt_raw_response: {
        carboidratos_g: '45,5',
        correcao_u: 1,
        bolus_comida_u: 'bad',
        iob_u: '  ',
        insulina_recomendada_u: 3.5,
        observacao: '  note  ',
        meta_mgdl: 110,
        meta_periodo: '',
        source: 'gpt',
      },
      recommended_insulin: 9,
    })
    const rec = parseEntryRecommendation(entry)
    expect(rec.carboidratosG).toBe(45.5)
    expect(rec.correcaoU).toBe(1)
    expect(rec.bolusComidaU).toBeNull()
    expect(rec.iobU).toBeNull()
    expect(rec.insulinaRecomendadaU).toBe(3.5)
    expect(rec.observacao).toBe('note')
    expect(rec.metaPeriodo).toBeNull()
    expect(rec.source).toBe('gpt')
  })

  it('handles null gpt_raw_response', () => {
    const rec = parseEntryRecommendation(
      makeEntry({ gpt_raw_response: null, recommended_insulin: null }),
    )
    expect(rec.insulinaRecomendadaU).toBeNull()
    expect(rec.carboidratosG).toBeNull()
  })
})

describe('formatMetaLabel', () => {
  it('returns null without meta', () => {
    expect(
      formatMetaLabel({
        carboidratosG: null,
        correcaoU: null,
        bolusComidaU: null,
        iobU: null,
        insulinaRecomendadaU: null,
        observacao: null,
        metaMgdl: null,
        metaPeriodo: null,
        source: null,
      }),
    ).toBeNull()
  })

  it('formats with and without period', () => {
    expect(
      formatMetaLabel({
        carboidratosG: null,
        correcaoU: null,
        bolusComidaU: null,
        iobU: null,
        insulinaRecomendadaU: null,
        observacao: null,
        metaMgdl: 110,
        metaPeriodo: null,
        source: null,
      }),
    ).toBe('Meta aplicada: 110 mg/dL')

    expect(
      formatMetaLabel({
        carboidratosG: null,
        correcaoU: null,
        bolusComidaU: null,
        iobU: null,
        insulinaRecomendadaU: null,
        observacao: null,
        metaMgdl: 120,
        metaPeriodo: 'noite',
        source: null,
      }),
    ).toBe('Meta aplicada: 120 mg/dL (noite)')
  })
})
