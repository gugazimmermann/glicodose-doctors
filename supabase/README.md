# Supabase (portal médicos) — Stripe apoio

Migrations e Edge Functions deste app. Deploy a partir **deste** repositório.

## Migration

No SQL Editor do projeto ou via CLI:

```bash
supabase db push
# ou cole supabase/migrations/20260318150000_doctor_supporter_billing.sql
```

## Secrets

```bash
supabase secrets set \
  STRIPE_SECRET_KEY='sk_...' \
  STRIPE_WEBHOOK_SECRET='whsec_...' \
  STRIPE_PRICE_SUPPORT_10='price_...' \
  STRIPE_PRICE_SUPPORT_20='price_...' \
  STRIPE_PRICE_SUPPORT_50='price_...' \
  STRIPE_PRICE_SUPPORT_100='price_...'
```

No Stripe Dashboard: 4 produtos **GlicoDose 10/20/50/100** com preços mensais BRL; Customer Portal ativo; webhook para:

`https://<PROJECT_REF>.supabase.co/functions/v1/stripe-doctor-webhook`

Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

## Deploy das functions

```bash
supabase functions deploy create-doctor-checkout
supabase functions deploy create-doctor-portal
supabase functions deploy stripe-doctor-webhook
```

O frontend chama as functions com o JWT do médico (`VITE_SUPABASE_URL` / anon key).
