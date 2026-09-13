-- Public website inquiries are written only by the server; visitors cannot read them.
create table if not exists public.contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  email text not null check (char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 40),
  subject text not null check (subject in ('servicio','consulta','cuenta','otro')),
  message text not null check (char_length(message) between 20 and 2000),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists contact_inquiries_email_created on public.contact_inquiries(email, created_at desc);
alter table public.contact_inquiries enable row level security;
revoke all on public.contact_inquiries from anon, authenticated;
grant select on public.contact_inquiries to authenticated;
grant select, insert on public.contact_inquiries to service_role;
create policy contact_inquiries_admin_read on public.contact_inquiries for select to authenticated
using (private.current_app_role() = 'admin');

create or replace function public.submit_marketing_inquiry(payload jsonb)
returns text language plpgsql security invoker set search_path = '' as $$
declare email_value text := lower(trim(payload->>'email'));
begin
  if payload->>'consent' is distinct from 'true' then raise exception 'consent_required'; end if;
  -- Serialize submissions from the same address so the limit also holds under concurrency.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(email_value, 821));
  if (select count(*) from public.contact_inquiries where email = email_value and created_at > now() - interval '10 minutes') >= 3 then
    return 'rate_limit';
  end if;
  insert into public.contact_inquiries(name,email,phone,subject,message)
  values(trim(payload->>'name'),email_value,coalesce(payload->>'phone',''),payload->>'subject',trim(payload->>'message'));
  return 'ok';
end;
$$;
revoke all on function public.submit_marketing_inquiry(jsonb) from public, anon, authenticated;
grant execute on function public.submit_marketing_inquiry(jsonb) to service_role;
