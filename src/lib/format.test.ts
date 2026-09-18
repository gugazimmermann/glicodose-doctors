import { describe, expect, it } from 'vitest'
import {
  diabetesTypeLabel,
  formatBrazilDate,
  formatBrazilDateTime,
  formatBrazilDayMonth,
  formatDose,
  formatDoseWithUnit,
  formatU,
} from './format'

describe('formatDose', () => {
  it('returns em dash for null, undefined, and NaN', () => {
    expect(formatDose(null)).toBe('—')
    expect(formatDose(undefined)).toBe('—')
    expect(formatDose(Number.NaN)).toBe('—')
  })

  it('formats integers and decimals', () => {
    expect(formatDose(4)).toBe('4')
    expect(formatDose(3.5)).toBe('3.5')
  })
})

describe('formatDoseWithUnit / formatU', () => {
  it('omits unit for nullish values', () => {
    expect(formatDoseWithUnit(null, ' U')).toBe('—')
    expect(formatU(undefined)).toBe('—')
  })

  it('appends unit for numbers', () => {
    expect(formatDoseWithUnit(2, 'g')).toBe('2g')
    expect(formatU(1.5)).toBe('1.5 U')
  })
})

describe('diabetesTypeLabel', () => {
  it('maps known types and falls back', () => {
    expect(diabetesTypeLabel('type_1')).toBe('Tipo 1')
    expect(diabetesTypeLabel('type_2')).toBe('Tipo 2')
    expect(diabetesTypeLabel('other')).toBe('Outro')
    expect(diabetesTypeLabel(null)).toBe('Não informado')
    expect(diabetesTypeLabel('unknown')).toBe('Não informado')
  })
})

describe('Brazil date formatters', () => {
  const iso = '2024-06-15T18:30:00.000Z'

  it('formats date-time, date, and day-month in America/Sao_Paulo', () => {
    expect(formatBrazilDateTime(iso)).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(formatBrazilDate(iso)).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(formatBrazilDayMonth(iso)).toMatch(/\d{2}\/\d{2}/)
  })
})
