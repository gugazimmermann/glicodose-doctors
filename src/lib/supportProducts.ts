export const SUPPORT_PLAN_KEYS = [
  'support_10',
  'support_20',
  'support_50',
  'support_100',
] as const

export type SupportPlanKey = (typeof SUPPORT_PLAN_KEYS)[number]

/** Monthly BRL face values for UI. */
export const FALLBACK_MONTHLY_BRL: Record<SupportPlanKey, number> = {
  support_10: 10,
  support_20: 20,
  support_50: 50,
  support_100: 100,
}

export const SUPPORT_PLAN_LABELS: Record<SupportPlanKey, string> = {
  support_10: 'GlicoDose 10',
  support_20: 'GlicoDose 20',
  support_50: 'GlicoDose 50',
  support_100: 'GlicoDose 100',
}

export function isSupportPlanKey(value: string): value is SupportPlanKey {
  return (SUPPORT_PLAN_KEYS as readonly string[]).includes(value)
}

export function displayPriceLabel(plan: SupportPlanKey): string {
  return `R$${FALLBACK_MONTHLY_BRL[plan]}/mês`
}

export function displayPlanLabel(productId: string | null | undefined): string {
  if (!productId || !isSupportPlanKey(productId)) {
    return productId ?? 'Apoiador'
  }
  return `${SUPPORT_PLAN_LABELS[productId]} · ${displayPriceLabel(productId)}`
}
