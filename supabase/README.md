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

`OPENAI_API_KEY` é o mesmo secret do app paciente (`recommend-insulin`). Se ainda não estiver no projeto:

```bash
supabase secrets set OPENAI_API_KEY='sk-...'
```

Referência local (sem `VITE_`): `OPENAI_API_KEY` em `.env` — não vai para o bundle do React.

No Stripe Dashboard: 4 produtos **GlicoDose 10/20/50/100** com preços mensais BRL; Customer Portal ativo; webhook para:

`https://<PROJECT_REF>.supabase.co/functions/v1/stripe-doctor-webhook`

Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

## Deploy das functions

```bash
supabase functions deploy create-doctor-checkout
supabase functions deploy create-doctor-portal
supabase functions deploy stripe-doctor-webhook
supabase functions deploy analyze-patient-history
supabase functions deploy create-public-support-checkout
```

- Checkout/portal/histórico: JWT do médico (`VITE_SUPABASE_URL` / anon key).
- `create-public-support-checkout`: **sem login** — usado pelo site de marketing (`diabetes-site` `/apoiar`). Mesmos `STRIPE_PRICE_SUPPORT_*`. Não grava em `doctors`.
