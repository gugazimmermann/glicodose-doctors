// Mirrors an existing Stripe subscription onto the logged-in doctor by e-mail.
// Deploy: supabase functions deploy sync-doctor-supporter

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  chooseSupporterSubscription,
  statusFromStripeSubscription,
  type SubscriptionCandidate,
} from '../_shared/supporterLink.ts'
import {
  isSupportPlanKey,
  priceIdToPlanKey,
  type SupportPlanKey,
} from '../_shared/supportPlans.ts'

function planFromSubscription(
  subscription: Stripe.Subscription,
): SupportPlanKey | null {
  const fromMeta = subscription.metadata?.support_plan
  if (typeof fromMeta === 'string' && isSupportPlanKey(fromMeta)) {
    return fromMeta
  }
  const priceId = subscription.items.data[0]?.price?.id
  if (!priceId) return null
  return priceIdToPlanKey(priceId)
}

function isCurrentSupporter(status: string | null | undefined): boolean {
  return status === 'active' || status === 'grace' || status === 'canceled'
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
    if (!stripeKey) {
      console.error('STRIPE_SECRET_KEY not configured')
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const email = user.email?.trim()
    if (!email) {
      return jsonResponse({ error: 'E-mail da conta não encontrado' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: doctor, error: doctorError } = await admin
      .from('doctors')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (doctorError || !doctor) {
      return jsonResponse({ error: 'Médico não encontrado' }, 404)
    }

    if (isCurrentSupporter(doctor.supporter_status as string | null)) {
      return jsonResponse({ doctor, synced: false })
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const listed = await stripe.customers.list({ email, limit: 10 })
    const customerIds = new Set(listed.data.map((customer) => customer.id))
    const savedCustomerId =
      (doctor.stripe_customer_id as string | null) ?? null
    if (savedCustomerId) customerIds.add(savedCustomerId)

    const subscriptions: SubscriptionCandidate[] = []
    for (const customerId of customerIds) {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 10,
      })
      for (const sub of subs.data) {
        subscriptions.push({
          customerId,
          status: sub.status,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          currentPeriodEnd: sub.current_period_end,
          plan: planFromSubscription(sub),
        })
      }
    }

    const chosen = chooseSupporterSubscription({
      savedCustomerId,
      subscriptions,
      nowSec: Math.floor(Date.now() / 1000),
    })

    if (!chosen) {
      return jsonResponse({ doctor, synced: false })
    }

    const patch: Record<string, unknown> = {
      supporter_status: statusFromStripeSubscription(
        chosen.status,
        chosen.cancelAtPeriodEnd,
      ),
      supporter_store: 'stripe',
      supporter_expires_at: new Date(
        chosen.currentPeriodEnd * 1000,
      ).toISOString(),
      supporter_updated_at: new Date().toISOString(),
      stripe_customer_id: chosen.customerId,
    }
    if (chosen.plan) patch.supporter_product_id = chosen.plan

    const { error: updateError } = await admin
      .from('doctors')
      .update(patch)
      .eq('id', user.id)
    if (updateError) {
      console.error('sync-doctor-supporter update failed', updateError.message)
      return jsonResponse({ error: 'Não foi possível salvar o apoio' }, 500)
    }

    const { data: updated, error: reloadError } = await admin
      .from('doctors')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    if (reloadError || !updated) {
      return jsonResponse({ error: 'Não foi possível ler o cadastro' }, 500)
    }

    return jsonResponse({ doctor: updated, synced: true })
  } catch (e) {
    console.error(e)
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      500,
    )
  }
})
