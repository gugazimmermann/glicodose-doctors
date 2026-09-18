export const SUPPORT_PLAN_KEYS = [
  'support_10',
  'support_20',
  'support_50',
  'support_100',
] as const

export type SupportPlanKey = (typeof SUPPORT_PLAN_KEYS)[number]

export function isSupportPlanKey(value: string): value is SupportPlanKey {
  return (SUPPORT_PLAN_KEYS as readonly string[]).includes(value)
}

/** Maps env STRIPE_PRICE_SUPPORT_* → product key. */
export function priceIdToPlanKey(priceId: string): SupportPlanKey | null {
  const pairs: Array<[string | undefined, SupportPlanKey]> = [
    [Deno.env.get('STRIPE_PRICE_SUPPORT_10'), 'support_10'],
    [Deno.env.get('STRIPE_PRICE_SUPPORT_20'), 'support_20'],
    [Deno.env.get('STRIPE_PRICE_SUPPORT_50'), 'support_50'],
    [Deno.env.get('STRIPE_PRICE_SUPPORT_100'), 'support_100'],
  ]
  for (const [envPriceId, key] of pairs) {
    if (envPriceId && envPriceId === priceId) return key
  }
  return null
}

export function planKeyToPriceId(plan: SupportPlanKey): string | null {
  const map: Record<SupportPlanKey, string | undefined> = {
    support_10: Deno.env.get('STRIPE_PRICE_SUPPORT_10'),
    support_20: Deno.env.get('STRIPE_PRICE_SUPPORT_20'),
    support_50: Deno.env.get('STRIPE_PRICE_SUPPORT_50'),
    support_100: Deno.env.get('STRIPE_PRICE_SUPPORT_100'),
  }
  return map[plan] ?? null
}
