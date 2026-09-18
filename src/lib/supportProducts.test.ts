import { describe, expect, it } from 'vitest'
import {
  SUPPORT_PLAN_KEYS,
  displayPlanLabel,
  displayPriceLabel,
  isSupportPlanKey,
} from './supportProducts'

describe('supportProducts', () => {
  it('lists four plans', () => {
    expect(SUPPORT_PLAN_KEYS).toEqual([
      'support_10',
      'support_20',
      'support_50',
      'support_100',
    ])
  })

  it('validates plan keys', () => {
    expect(isSupportPlanKey('support_20')).toBe(true)
    expect(isSupportPlanKey('other')).toBe(false)
  })

  it('formats price and plan labels', () => {
    expect(displayPriceLabel('support_10')).toBe('R$10/mês')
    expect(displayPlanLabel('support_50')).toBe('GlicoDose 50 · R$50/mês')
    expect(displayPlanLabel(null)).toBe('Apoiador')
    expect(displayPlanLabel('unknown')).toBe('unknown')
  })
})
