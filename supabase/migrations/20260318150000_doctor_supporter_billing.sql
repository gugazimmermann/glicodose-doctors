-- Optional Stripe supporter subscription status for doctors.
-- Source of truth is Stripe; doctors only cache status for UI.

alter table public.doctors
  add column if not exists supporter_product_id text,
  add column if not exists supporter_status text not null default 'none',
  add column if not exists supporter_store text,
  add column if not exists supporter_expires_at timestamptz,
  add column if not exists supporter_updated_at timestamptz,
  add column if not exists stripe_customer_id text;

alter table public.doctors
  drop constraint if exists doctors_supporter_status_check;

alter table public.doctors
  add constraint doctors_supporter_status_check
  check (
    supporter_status in (
      'none',
      'active',
      'grace',
      'expired',
      'canceled'
    )
  );

alter table public.doctors
  drop constraint if exists doctors_supporter_store_check;

alter table public.doctors
  add constraint doctors_supporter_store_check
  check (
    supporter_store is null
    or supporter_store in ('stripe')
  );

comment on column public.doctors.supporter_product_id is
  'Product key mirrored from Stripe, e.g. support_20';
comment on column public.doctors.supporter_status is
  'Mirrored from Stripe webhook: none|active|grace|expired|canceled';
comment on column public.doctors.supporter_store is
  'Always stripe for doctor portal subscriptions';
comment on column public.doctors.stripe_customer_id is
  'Stripe Customer id for Checkout reuse and Billing Portal';

-- Users may read their own supporter fields (covered by existing select policy).
-- Writes to supporter_* / stripe_customer_id come from Edge Functions (service role).
