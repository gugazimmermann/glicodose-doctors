// Creates a Stripe Checkout Session for optional doctor support subscriptions.
// Deploy: supabase functions deploy create-doctor-checkout

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  isSupportPlanKey,
  planKeyToPriceId,
  type SupportPlanKey,
} from '../_shared/supportPlans.ts'

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

    const body = (await req.json()) as {
      plan?: string
      successUrl?: string
      cancelUrl?: string
    }

    if (!body.plan || !isSupportPlanKey(body.plan)) {
      return jsonResponse({ error: 'Invalid plan' }, 400)
    }
    const plan = body.plan as SupportPlanKey

    if (!body.successUrl || !body.cancelUrl) {
      return jsonResponse({ error: 'successUrl and cancelUrl are required' }, 400)
    }

    const priceId = planKeyToPriceId(plan)
    if (!priceId) {
      console.error(`Missing Stripe price for plan ${plan}`)
      return jsonResponse({ error: 'Plan not configured' }, 500)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: doctor, error: doctorError } = await admin
      .from('doctors')
      .select('id, full_name, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (doctorError || !doctor) {
      return jsonResponse({ error: 'Doctor not found' }, 404)
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    let customerId = doctor.stripe_customer_id as string | null
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: doctor.full_name ?? undefined,
        metadata: { doctor_id: doctor.id },
      })
      customerId = customer.id
      const { error: updateError } = await admin
        .from('doctors')
        .update({
          stripe_customer_id: customerId,
          supporter_updated_at: new Date().toISOString(),
        })
        .eq('id', doctor.id)
      if (updateError) {
        console.error('Failed to save stripe_customer_id', updateError)
        return jsonResponse({ error: 'Failed to save customer' }, 500)
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: doctor.id,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      metadata: {
        doctor_id: doctor.id,
        support_plan: plan,
      },
      subscription_data: {
        metadata: {
          doctor_id: doctor.id,
          support_plan: plan,
        },
      },
      allow_promotion_codes: true,
    })

    if (!session.url) {
      return jsonResponse({ error: 'Checkout session missing URL' }, 500)
    }

    return jsonResponse({ url: session.url })
  } catch (e) {
    console.error(e)
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      500,
    )
  }
})
