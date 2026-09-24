// Public Stripe Billing Portal for marketing-site supporters (no login).
// Deploy: supabase functions deploy create-public-support-portal
// Looks up the Stripe customer by the email used at checkout.

import Stripe from 'https://esm.sh/stripe@17.5.0?target=deno'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

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

function isValidEmail(email: string): boolean {
  if (email.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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
      email?: string
      returnUrl?: string
    }

    const email = body.email?.trim().toLowerCase()
    if (!email || !isValidEmail(email)) {
      return jsonResponse({ error: 'E-mail inválido' }, 400)
    }

    if (!body.returnUrl) {
      return jsonResponse({ error: 'returnUrl is required' }, 400)
    }
    if (!isAllowedReturnUrl(body.returnUrl)) {
      return jsonResponse({ error: 'Invalid return URL' }, 400)
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const customers = await stripe.customers.list({
      email,
      limit: 1,
    })

    const customer = customers.data[0]
    if (!customer) {
      return jsonResponse(
        { error: 'Nenhuma assinatura encontrada para este e-mail' },
        404,
      )
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: body.returnUrl,
    })

    if (!session.url) {
      return jsonResponse({ error: 'Portal session missing URL' }, 500)
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
