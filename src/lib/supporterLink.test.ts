import { describe, expect, it } from 'vitest'
import {
  chooseSupporterSubscription,
  statusFromStripeSubscription,
  type SubscriptionCandidate,
} from '../../supabase/functions/_shared/supporterLink'

const nowSec = 1_700_000_000

function sub(
  partial: Partial<SubscriptionCandidate> &
    Pick<SubscriptionCandidate, 'customerId' | 'status'>,
): SubscriptionCandidate {
  return {
    cancelAtPeriodEnd: false,
    currentPeriodEnd: nowSec + 86_400,
    plan: 'support_20',
    ...partial,
  }
}

describe('statusFromStripeSubscription', () => {
  it('maps live, grace, canceled and expired statuses', () => {
    expect(statusFromStripeSubscription('active')).toBe('active')
    expect(statusFromStripeSubscription('trialing')).toBe('active')
    expect(statusFromStripeSubscription('past_due')).toBe('grace')
    expect(statusFromStripeSubscription('unpaid')).toBe('grace')
    expect(statusFromStripeSubscription('canceled')).toBe('canceled')
    expect(statusFromStripeSubscription('incomplete_expired')).toBe('expired')
    expect(statusFromStripeSubscription('incomplete', true)).toBe('canceled')
    expect(statusFromStripeSubscription('incomplete', false)).toBe('active')
  })
})

describe('chooseSupporterSubscription', () => {
  it('uses the e-mail subscription when the saved customer has none', () => {
    const chosen = chooseSupporterSubscription({
      savedCustomerId: 'cus_empty',
      nowSec,
      subscriptions: [
        sub({
          customerId: 'cus_email',
          status: 'active',
          currentPeriodEnd: nowSec + 10,
        }),
      ],
    })
    expect(chosen?.customerId).toBe('cus_email')
  })

  it('keeps the saved customer when that customer still has a live subscription', () => {
    const chosen = chooseSupporterSubscription({
      savedCustomerId: 'cus_saved',
      nowSec,
      subscriptions: [
        sub({
          customerId: 'cus_email',
          status: 'active',
          currentPeriodEnd: nowSec + 50_000,
          plan: 'support_50',
        }),
        sub({
          customerId: 'cus_saved',
          status: 'past_due',
          currentPeriodEnd: nowSec + 100,
          plan: 'support_10',
        }),
      ],
    })
    expect(chosen).toMatchObject({
      customerId: 'cus_saved',
      plan: 'support_10',
    })
  })

  it('prefers an active subscription over past due and ignores ended cancels', () => {
    const chosen = chooseSupporterSubscription({
      savedCustomerId: null,
      nowSec,
      subscriptions: [
        sub({
          customerId: 'cus_old',
          status: 'canceled',
          currentPeriodEnd: nowSec - 10,
        }),
        sub({
          customerId: 'cus_due',
          status: 'past_due',
          currentPeriodEnd: nowSec + 5_000,
        }),
        sub({
          customerId: 'cus_live',
          status: 'active',
          currentPeriodEnd: nowSec + 100,
        }),
        sub({
          customerId: 'cus_later',
          status: 'active',
          currentPeriodEnd: nowSec + 500,
        }),
      ],
    })
    expect(chosen?.customerId).toBe('cus_later')
  })

  it('keeps a canceled subscription that is still inside the paid period', () => {
    const chosen = chooseSupporterSubscription({
      savedCustomerId: null,
      nowSec,
      subscriptions: [
        sub({
          customerId: 'cus_cancel',
          status: 'canceled',
          currentPeriodEnd: nowSec + 1000,
        }),
      ],
    })
    expect(chosen?.customerId).toBe('cus_cancel')
  })

  it('returns null when nothing is current', () => {
    expect(
      chooseSupporterSubscription({
        savedCustomerId: null,
        nowSec,
        subscriptions: [
          sub({
            customerId: 'cus_done',
            status: 'canceled',
            currentPeriodEnd: nowSec,
          }),
        ],
      }),
    ).toBeNull()
  })
})
