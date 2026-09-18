// Mirrors Stripe subscription events onto public.doctors supporter_* columns.
// Deploy: supabase functions deploy stripe-doctor-webhook
// verify_jwt = false — authenticate via Stripe-Signature.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { priceIdToPlanKey, type SupportPlanKey } from '../_shared/supportPlans.ts'

type SupporterStatus = 'none' | 'active' | 'grace' | 'expired' | 'canceled'

function statusFromSubscription(
  subscription: Stripe.Subscription,
): SupporterStatus {
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'grace'
    case 'canceled':
      return subscription.cancel_at_period_end ? 'canceled' : 'canceled'
    case 'incomplete_expired':
      return 'expired'
    default:
      return subscription.cancel_at_period_end ? 'canceled' : 'active'
  }
}

function planFromSubscription(
  subscription: Stripe.Subscription,
): SupportPlanKey | null {
  const fromMeta = subscription.metadata?.support_plan
  if (
    fromMeta === 'support_10' ||
    fromMeta === 'support_20' ||
    fromMeta === 'support_50' ||
    fromMeta === 'support_100'
  ) {
    return fromMeta
  }
  const priceId = subscription.items.data[0]?.price?.id
  if (!priceId) return null
  return priceIdToPlanKey(priceId)
}

function doctorIdFromSubscription(
  subscription: Stripe.Subscription,
): string | null {
  return subscription.metadata?.doctor_id ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!stripeKey || !webhookSecret) {
      console.error('Stripe secrets not configured')
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const signature = req.headers.get('Stripe-Signature')
    if (!signature) {
      return jsonResponse({ error: 'Missing signature' }, 400)
    }

    const body = await req.text()
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        webhookSecret,
      )
    } catch (err) {
      console.error('Webhook signature verification failed', err)
      return jsonResponse({ error: 'Invalid signature' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    async function updateDoctor(
      doctorId: string,
      patch: Record<string, unknown>,
    ) {
      const { error } = await admin
        .from('doctors')
        .update({
          ...patch,
          supporter_store: 'stripe',
          supporter_updated_at: new Date().toISOString(),
        })
        .eq('id', doctorId)
      if (error) throw error
    }

    async function resolveDoctorIdFromCustomer(
      customerId: string | Stripe.Customer | Stripe.DeletedCustomer | null,
    ): Promise<string | null> {
      if (!customerId || typeof customerId !== 'string') {
        if (customerId && typeof customerId === 'object' && 'id' in customerId) {
          return resolveDoctorIdFromCustomer(customerId.id)
        }
        return null
      }
      const { data } = await admin
        .from('doctors')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle()
      return data?.id ?? null
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const doctorId =
          session.metadata?.doctor_id ??
          session.client_reference_id ??
          null
        if (!doctorId) {
          console.log('checkout.session.completed without doctor_id')
          break
        }

        const plan =
          (session.metadata?.support_plan as SupportPlanKey | undefined) ??
          null
        const customerId =
          typeof session.customer === 'string' ? session.customer : null

        const patch: Record<string, unknown> = {
          supporter_status: 'active',
        }
        if (plan) patch.supporter_product_id = plan
        if (customerId) patch.stripe_customer_id = customerId

        if (typeof session.subscription === 'string') {
          const sub = await stripe.subscriptions.retrieve(session.subscription)
          patch.supporter_status = statusFromSubscription(sub)
          patch.supporter_expires_at = new Date(
            sub.current_period_end * 1000,
          ).toISOString()
          const subPlan = planFromSubscription(sub)
          if (subPlan) patch.supporter_product_id = subPlan
        }

        await updateDoctor(doctorId, patch)
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        let doctorId = doctorIdFromSubscription(subscription)
        if (!doctorId) {
          doctorId = await resolveDoctorIdFromCustomer(subscription.customer)
        }
        if (!doctorId) {
          console.log(`${event.type} without resolvable doctor_id`)
          break
        }

        const status: SupporterStatus =
          event.type === 'customer.subscription.deleted'
            ? 'expired'
            : statusFromSubscription(subscription)

        const patch: Record<string, unknown> = {
          supporter_status: status,
          supporter_expires_at: new Date(
            subscription.current_period_end * 1000,
          ).toISOString(),
        }
        const plan = planFromSubscription(subscription)
        if (plan) patch.supporter_product_id = plan

        await updateDoctor(doctorId, patch)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const doctorId = await resolveDoctorIdFromCustomer(invoice.customer)
        if (!doctorId) break
        await updateDoctor(doctorId, { supporter_status: 'grace' })
        break
      }

      default:
        break
    }

    return jsonResponse({ ok: true, type: event.type })
  } catch (e) {
    console.error(e)
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      500,
    )
  }
})
