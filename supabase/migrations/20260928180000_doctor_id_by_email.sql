-- Lets the Stripe webhook attach a subscription to the doctor who owns that e-mail.
-- Callable only by the service role used by Edge Functions.

create or replace function public.doctor_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select d.id
  from auth.users u
  join public.doctors d on d.id = u.id
  where p_email is not null
    and length(trim(p_email)) > 0
    and u.email is not null
    and lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

revoke all on function public.doctor_id_by_email(text) from public;
revoke all on function public.doctor_id_by_email(text) from anon;
revoke all on function public.doctor_id_by_email(text) from authenticated;
grant execute on function public.doctor_id_by_email(text) to service_role;
