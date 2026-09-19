// Public Stripe Checkout for marketing-site visitors (no doctor login).
// Deploy: supabase functions deploy create-public-support-checkout
// Uses the same STRIPE_PRICE_SUPPORT_* secrets as create-doctor-checkout.

import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  isSupportPlanKey,
  planKeyToPriceId,
  type SupportPlanKey,
} from '../_shared/supportPlans.ts'

function isAllowedReturnUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol === 'http:' && u.hostname === 'localhost') return true
    if (u.protocol === 'http:' && u.hostname === '127.0.0.1') return true
    if (u.protocol === 'https:') return true
    return false
  } catch {
    return false
  }
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
    if (!isAllowedReturnUrl(body.successUrl) || !isAllowedReturnUrl(body.cancelUrl)) {
      return jsonResponse({ error: 'Invalid return URL' }, 400)
    }

    const priceId = planKeyToPriceId(plan)
    if (!priceId) {
      console.error(`Missing Stripe price for plan ${plan}`)
      return jsonResponse({ error: 'Plan not configured' }, 500)
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
      metadata: {
        source: 'marketing-site',
        support_plan: plan,
      },
      subscription_data: {
        metadata: {
          source: 'marketing-site',
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
