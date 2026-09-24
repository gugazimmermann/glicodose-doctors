// Public contact form for the marketing site (diabetes-site /contato).
// Deploy: supabase functions deploy send-contact
//
// Secrets:
//   RESEND_API_KEY          — API key from https://resend.com
//   CONTACT_TO_EMAIL        — destination inbox (e.g. contato@glicodose.app)
//   CONTACT_FROM_EMAIL      — verified sender (e.g. "GlicoDose <contato@glicodose.app>")
//
// Resend setup:
//   1. Create account at resend.com
//   2. Domains → Add Domain → glicodose.app (add SPF/DKIM DNS records; wait Verified)
//   3. API Keys → Create → copy re_… into RESEND_API_KEY
//   4. CONTACT_TO_EMAIL must be a real mailbox (Resend only sends; it does not host inbox)

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'

const MAX_NAME = 120
const MAX_EMAIL = 254
const MAX_MESSAGE = 5000
const MAX_SUBJECT = 200

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY')
    const toEmail = Deno.env.get('CONTACT_TO_EMAIL') ?? 'contato@glicodose.app'
    const fromEmail =
      Deno.env.get('CONTACT_FROM_EMAIL') ??
      'GlicoDose <contato@glicodose.app>'

    if (!apiKey) {
      console.error('RESEND_API_KEY not configured')
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }

    const body = (await req.json()) as {
      name?: string
      email?: string
      message?: string
      subject?: string
      website?: string // honeypot — bots fill this; humans leave empty
    }

    // Honeypot: pretend success so scrapers do not retry.
    if (trimOrEmpty(body.website)) {
      return jsonResponse({ ok: true })
    }

    const name = trimOrEmpty(body.name)
    const email = trimOrEmpty(body.email)
    const message = trimOrEmpty(body.message)
    const subjectExtra = trimOrEmpty(body.subject)

    if (!name || !email || !message) {
      return jsonResponse(
        { error: 'Nome, e-mail e mensagem são obrigatórios.' },
        400,
      )
    }
    if (name.length > MAX_NAME) {
      return jsonResponse({ error: 'Nome muito longo.' }, 400)
    }
    if (email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
      return jsonResponse({ error: 'E-mail inválido.' }, 400)
    }
    if (message.length > MAX_MESSAGE) {
      return jsonResponse({ error: 'Mensagem muito longa.' }, 400)
    }
    if (subjectExtra.length > MAX_SUBJECT) {
      return jsonResponse({ error: 'Assunto muito longo.' }, 400)
    }

    const subject = subjectExtra
      ? `Contato pelo site — ${subjectExtra}`
      : `Contato pelo site — ${name}`

    const safeName = escapeHtml(name)
    const safeEmail = escapeHtml(email)
    const safeMessage = escapeHtml(message).replaceAll('\n', '<br>')

    const html = `
      <p><strong>Nome:</strong> ${safeName}</p>
      <p><strong>E-mail:</strong> ${safeEmail}</p>
      <p><strong>Mensagem:</strong></p>
      <p>${safeMessage}</p>
    `
    const text = `Nome: ${name}\nE-mail: ${email}\n\nMensagem:\n${message}`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject,
        html,
        text,
      }),
    })

    if (!resendRes.ok) {
      const errBody = await resendRes.text()
      console.error('Resend error', resendRes.status, errBody)
      return jsonResponse(
        { error: 'Não foi possível enviar a mensagem. Tente novamente.' },
        502,
      )
    }

    return jsonResponse({ ok: true })
  } catch (e) {
    console.error(e)
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Unknown error' },
      500,
    )
  }
})
