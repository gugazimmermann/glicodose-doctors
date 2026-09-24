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

### Contato do site (`send-contact` + Resend)

Usado por `diabetes-site` em `/contato`. O Resend **envia** e-mail; a caixa `contato@glicodose.app` precisa existir no provedor de inbox (Google Workspace, etc.).

1. Conta em [resend.com](https://resend.com)
2. **Domains → Add Domain** → `glicodose.app` (criar SPF/DKIM no DNS; aguardar **Verified**)
3. **API Keys → Create** → copiar `re_…`
4. Secrets:

```bash
supabase secrets set \
  RESEND_API_KEY='re_...' \
  CONTACT_TO_EMAIL='contato@glicodose.app' \
  CONTACT_FROM_EMAIL='GlicoDose <contato@glicodose.app>'
```

Enquanto o domínio não estiver verificado, o Resend só permite teste com `from: onboarding@resend.dev` para o e-mail da conta Resend.

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
supabase functions deploy create-public-support-portal
supabase functions deploy send-contact
```

- Checkout/portal/histórico: JWT do médico (`VITE_SUPABASE_URL` / anon key).
- `create-public-support-checkout`: **sem login** — usado pelo site de marketing (`diabetes-site` `/apoiar`). Mesmos `STRIPE_PRICE_SUPPORT_*`. Não grava em `doctors`.
- `create-public-support-portal`: **sem login** — abre o Billing Portal pelo e-mail do checkout (`diabetes-site` `/apoiar`).
- `send-contact`: **sem login** — formulário de contato do site (`diabetes-site` `/contato`) via Resend → `CONTACT_TO_EMAIL`.
