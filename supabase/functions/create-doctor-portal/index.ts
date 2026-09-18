// Creates a Stripe Billing Portal session for managing doctor support subscriptions.
// Deploy: supabase functions deploy create-doctor-portal

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

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

    const body = (await req.json()) as { returnUrl?: string }
    if (!body.returnUrl) {
      return jsonResponse({ error: 'returnUrl is required' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: doctor, error: doctorError } = await admin
      .from('doctors')
      .select('id, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()

    if (doctorError || !doctor) {
      return jsonResponse({ error: 'Doctor not found' }, 404)
    }

    if (!doctor.stripe_customer_id) {
      return jsonResponse(
        { error: 'Nenhuma assinatura Stripe vinculada a esta conta.' },
        400,
      )
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const session = await stripe.billingPortal.sessions.create({
      customer: doctor.stripe_customer_id,
      return_url: body.returnUrl,
    })

    return jsonResponse({ url: session.url })
  } catch (e) {
    console.error(e)
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      500,
    )
  }
})
