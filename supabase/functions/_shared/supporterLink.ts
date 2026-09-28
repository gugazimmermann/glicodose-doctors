export type SupporterStatus =
  | 'none'
  | 'active'
  | 'grace'
  | 'expired'
  | 'canceled'

export type SubscriptionCandidate = {
  customerId: string
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: number
  plan: string | null
}

export function statusFromStripeSubscription(
  status: string,
  cancelAtPeriodEnd = false,
): SupporterStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'grace'
    case 'canceled':
      return 'canceled'
    case 'incomplete_expired':
      return 'expired'
    default:
      return cancelAtPeriodEnd ? 'canceled' : 'active'
  }
}

/** Subscription that should keep the Stripe customer already stored on the doctor. */
export function subscriptionKeepsCustomer(status: string): boolean {
  return (
    status === 'active' ||
    status === 'trialing' ||
    status === 'past_due' ||
    status === 'unpaid'
  )
}

function relevance(sub: SubscriptionCandidate, nowSec: number): number {
  if (sub.status === 'active' || sub.status === 'trialing') return 3
  if (sub.status === 'past_due' || sub.status === 'unpaid') return 2
  if (sub.status === 'canceled' && sub.currentPeriodEnd > nowSec) return 1
  return 0
}

/**
 * Picks the subscription to mirror onto a doctor.
 * A saved customer that still has a live subscription wins over another
 * customer that shares the same e-mail.
 */
export function chooseSupporterSubscription(input: {
  savedCustomerId: string | null
  subscriptions: SubscriptionCandidate[]
  nowSec: number
}): SubscriptionCandidate | null {
  const ranked = input.subscriptions
    .map((sub) => ({ sub, rank: relevance(sub, input.nowSec) }))
    .filter((row) => row.rank > 0)
    .sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank
      return b.sub.currentPeriodEnd - a.sub.currentPeriodEnd
    })
  if (ranked.length === 0) return null

  if (input.savedCustomerId) {
    const savedKeeps = ranked.some(
      (row) =>
        row.sub.customerId === input.savedCustomerId &&
        subscriptionKeepsCustomer(row.sub.status),
    )
    if (savedKeeps) {
      return (
        ranked.find((row) => row.sub.customerId === input.savedCustomerId)
          ?.sub ?? null
      )
    }
  }

  return ranked[0].sub
}
