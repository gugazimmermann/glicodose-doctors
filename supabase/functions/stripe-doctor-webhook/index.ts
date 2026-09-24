// Mirrors Stripe subscription events onto:
// - public.doctors (portal checkouts with doctor_id)
// - public.public_supporters (marketing-site /apoiar, source=marketing-site)
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

function isMarketingSiteSource(
  metadata: Stripe.Metadata | null | undefined,
): boolean {
  return metadata?.source === 'marketing-site'
}

function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null
  if (typeof customer === 'string') return customer
  if (typeof customer === 'object' && 'id' in customer) return customer.id
  return null
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

    async function upsertPublicSupporter(row: {
      stripe_customer_id: string
      stripe_subscription_id?: string | null
      email?: string | null
      full_name?: string | null
      supporter_product_id?: string | null
      supporter_status: SupporterStatus
      supporter_expires_at?: string | null
    }) {
      const patch: Record<string, unknown> = {
        stripe_customer_id: row.stripe_customer_id,
        supporter_status: row.supporter_status,
        supporter_store: 'stripe',
        supporter_updated_at: new Date().toISOString(),
      }
      if (row.stripe_subscription_id !== undefined) {
        patch.stripe_subscription_id = row.stripe_subscription_id
      }
      if (row.email) patch.email = row.email
      if (row.full_name) patch.full_name = row.full_name
      if (row.supporter_product_id) {
        patch.supporter_product_id = row.supporter_product_id
      }
      if (row.supporter_expires_at !== undefined) {
        patch.supporter_expires_at = row.supporter_expires_at
      }

      const { error } = await admin
        .from('public_supporters')
        .upsert(patch, { onConflict: 'stripe_customer_id' })
      if (error) throw error
    }

    async function resolveDoctorIdFromCustomer(
      customerId: string | Stripe.Customer | Stripe.DeletedCustomer | null,
    ): Promise<string | null> {
      const id = customerIdOf(customerId)
      if (!id) return null
      const { data } = await admin
        .from('doctors')
        .select('id')
        .eq('stripe_customer_id', id)
        .maybeSingle()
      return data?.id ?? null
    }

    async function loadCustomerDetails(
      customerId: string | null,
    ): Promise<{ email: string | null; full_name: string | null }> {
      if (!customerId) return { email: null, full_name: null }
      try {
        const customer = await stripe.customers.retrieve(customerId)
        if (customer.deleted) return { email: null, full_name: null }
        return {
          email: customer.email ?? null,
          full_name: customer.name ?? null,
        }
      } catch (err) {
        console.error('Failed to load Stripe customer', customerId, err)
        return { email: null, full_name: null }
      }
    }

    async function handleMarketingSiteSubscription(
      subscription: Stripe.Subscription,
      statusOverride?: SupporterStatus,
    ) {
      const customerId = customerIdOf(subscription.customer)
      if (!customerId) {
        console.log('marketing-site subscription without customer id')
        return
      }
      const details = await loadCustomerDetails(customerId)
      const plan = planFromSubscription(subscription)
      await upsertPublicSupporter({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        email: details.email,
        full_name: details.full_name,
        supporter_product_id: plan,
        supporter_status: statusOverride ?? statusFromSubscription(subscription),
        supporter_expires_at: new Date(
          subscription.current_period_end * 1000,
        ).toISOString(),
      })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const doctorId =
          session.metadata?.doctor_id ??
          session.client_reference_id ??
          null

        if (doctorId) {
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

        if (
          isMarketingSiteSource(session.metadata) ||
          (typeof session.subscription === 'string' &&
            isMarketingSiteSource(
              (
                await stripe.subscriptions.retrieve(session.subscription)
              ).metadata,
            ))
        ) {
          const customerId =
            typeof session.customer === 'string' ? session.customer : null
          if (!customerId) {
            console.log('marketing-site checkout without customer id')
            break
          }

          const plan =
            (session.metadata?.support_plan as SupportPlanKey | undefined) ??
            null
          let status: SupporterStatus = 'active'
          let expiresAt: string | null = null
          let subscriptionId: string | null =
            typeof session.subscription === 'string'
              ? session.subscription
              : null
          let resolvedPlan = plan

          if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId)
            status = statusFromSubscription(sub)
            expiresAt = new Date(sub.current_period_end * 1000).toISOString()
            const subPlan = planFromSubscription(sub)
            if (subPlan) resolvedPlan = subPlan
          }

          const fromSession = {
            email: session.customer_details?.email ?? session.customer_email,
            full_name: session.customer_details?.name ?? null,
          }
          const fromCustomer = await loadCustomerDetails(customerId)

          await upsertPublicSupporter({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            email: fromSession.email ?? fromCustomer.email,
            full_name: fromSession.full_name ?? fromCustomer.full_name,
            supporter_product_id: resolvedPlan,
            supporter_status: status,
            supporter_expires_at: expiresAt,
          })
          break
        }

        console.log('checkout.session.completed without doctor_id or site source')
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        if (isMarketingSiteSource(subscription.metadata)) {
          const status: SupporterStatus =
            event.type === 'customer.subscription.deleted'
              ? 'expired'
              : statusFromSubscription(subscription)
          await handleMarketingSiteSubscription(subscription, status)
          break
        }

        let doctorId = doctorIdFromSubscription(subscription)
        if (!doctorId) {
          doctorId = await resolveDoctorIdFromCustomer(subscription.customer)
        }
        if (!doctorId) {
          // Subscription may be marketing-site without metadata on older records —
          // try public_supporters by customer id before giving up.
          const customerId = customerIdOf(subscription.customer)
          if (customerId) {
            const { data: existing } = await admin
              .from('public_supporters')
              .select('id')
              .eq('stripe_customer_id', customerId)
              .maybeSingle()
            if (existing) {
              const status: SupporterStatus =
                event.type === 'customer.subscription.deleted'
                  ? 'expired'
                  : statusFromSubscription(subscription)
              await handleMarketingSiteSubscription(subscription, status)
              break
            }
          }
          console.log(`${event.type} without resolvable doctor_id or site supporter`)
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
        if (doctorId) {
          await updateDoctor(doctorId, { supporter_status: 'grace' })
          break
        }

        const customerId = customerIdOf(invoice.customer)
        if (!customerId) break

        const { data: existing } = await admin
          .from('public_supporters')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle()
        if (existing) {
          await upsertPublicSupporter({
            stripe_customer_id: customerId,
            supporter_status: 'grace',
          })
        }
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
