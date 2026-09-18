import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveChartColors } from './chartTheme'

describe('resolveChartColors', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.removeAttribute('style')
  })

  it('uses CSS variables when present', () => {
    const root = document.documentElement
    root.style.setProperty('--color-brand', '#111111')
    root.style.setProperty('--color-brand-light', '#222222')
    root.style.setProperty('--color-muted', '#333333')
    root.style.setProperty('--color-line', '#444444')
    root.style.setProperty('--color-ok', '#555555')
    root.style.setProperty('--color-ok-soft', '#666666')
    root.style.setProperty('--color-warning', '#777777')
    root.style.setProperty('--color-warning-soft', '#888888')
    root.style.setProperty('--color-danger', '#999999')
    root.style.setProperty('--color-danger-soft', '#aaaaaa')

    expect(resolveChartColors()).toEqual({
      brand: '#111111',
      accent: '#222222',
      muted: '#333333',
      line: '#444444',
      ok: '#555555',
      okSoft: '#666666',
      warning: '#777777',
      warningSoft: '#888888',
      danger: '#999999',
      dangerSoft: '#aaaaaa',
    })
  })

  it('falls back when CSS vars are empty', () => {
    const colors = resolveChartColors()
    expect(colors.brand).toBe('#3078e4')
    expect(colors.accent).toBe('#4884f0')
    expect(colors.muted).toBe('#5a6478')
    expect(colors.line).toBe('#c0cce4')
    expect(colors.ok).toBe('#067647')
    expect(colors.okSoft).toBe('#e8f8ef')
    expect(colors.warning).toBe('#b45309')
    expect(colors.warningSoft).toBe('#fef3c7')
    expect(colors.danger).toBe('#d80000')
    expect(colors.dangerSoft).toBe('#fde8e8')
  })

  it('uses fallbacks when window is undefined', () => {
    vi.stubGlobal('window', undefined)
    expect(resolveChartColors().brand).toBe('#3078e4')
    expect(resolveChartColors().dangerSoft).toBe('#fde8e8')
  })
})
