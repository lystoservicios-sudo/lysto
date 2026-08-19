-- Reliable provider-event inbox and notification outbox.
-- These queues are deliberately private; public wrappers are service-role only.

create schema if not exists private;

revoke all on schema private from public, anon;
revoke create on schema private from authenticated, service_role;
grant usage on schema private to authenticated, service_role;

create table private.provider_event_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  resource_type text not null,
  provider_resource_id text not null,
  event_type text not null,
  payload jsonb not null,
  provider_occurred_at timestamptz,
  received_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  max_attempts smallint not null default 8,
  locked_at timestamptz,
  locked_until timestamptz,
  locked_by text,
  claim_token uuid,
  last_error text,
  processed_at timestamptz,
  dead_lettered_at timestamptz,
  constraint provider_event_inbox_identity_key unique (provider, provider_event_id),
  constraint provider_event_inbox_text_check check (
    length(btrim(provider)) between 1 and 100
    and length(btrim(provider_event_id)) between 1 and 500
    and length(btrim(resource_type)) between 1 and 100
    and length(btrim(provider_resource_id)) between 1 and 500
    and length(btrim(event_type)) between 1 and 200
    and (locked_by is null or length(btrim(locked_by)) between 1 and 200)
    and (last_error is null or length(last_error) between 1 and 2000)
  ),
  constraint provider_event_inbox_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint provider_event_inbox_attempts_check check (
    attempt_count >= 0
    and max_attempts between 1 and 100
    and attempt_count <= max_attempts
  ),
  constraint provider_event_inbox_lease_check check (
    num_nonnulls(locked_at, locked_until, locked_by, claim_token) in (0, 4)
    and (locked_at is null or locked_until > locked_at)
  ),
  constraint provider_event_inbox_terminal_check check (
    not (processed_at is not null and dead_lettered_at is not null)
    and (
      processed_at is null
      or (
        attempt_count > 0
        and num_nonnulls(locked_at, locked_until, locked_by, claim_token) = 0
        and last_error is null
      )
    )
    and (
      dead_lettered_at is null
      or (
        attempt_count > 0
        and num_nonnulls(locked_at, locked_until, locked_by, claim_token) = 0
        and last_error is not null
      )
    )
  )
);

create index provider_event_inbox_claim_idx
  on private.provider_event_inbox (available_at, received_at, id)
  where processed_at is null and dead_lettered_at is null;

create index provider_event_inbox_lease_expiry_idx
  on private.provider_event_inbox (locked_until, id)
  where processed_at is null
    and dead_lettered_at is null
    and locked_until is not null;

create index provider_event_inbox_resource_idx
  on private.provider_event_inbox (
    provider,
    resource_type,
    provider_resource_id,
    received_at desc
  );

create table private.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  channel text not null,
  recipient_profile_id uuid references public.profiles(id) on delete restrict,
  recipient_key text not null,
  dedupe_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  max_attempts smallint not null default 8,
  locked_at timestamptz,
  locked_until timestamptz,
  locked_by text,
  claim_token uuid,
  last_error text,
  provider_message_id text,
  processed_at timestamptz,
  dead_lettered_at timestamptz,
  constraint outbox_events_identity_key unique (channel, recipient_key, dedupe_key),
  constraint outbox_events_channel_check check (
    channel in ('in_app', 'email', 'whatsapp_manual', 'push')
  ),
  constraint outbox_events_text_check check (
    length(btrim(event_type)) between 1 and 200
    and length(btrim(aggregate_type)) between 1 and 100
    and length(btrim(recipient_key)) between 1 and 500
    and length(btrim(dedupe_key)) between 1 and 500
    and (locked_by is null or length(btrim(locked_by)) between 1 and 200)
    and (last_error is null or length(last_error) between 1 and 2000)
    and (provider_message_id is null or length(btrim(provider_message_id)) between 1 and 500)
  ),
  constraint outbox_events_payload_object_check check (jsonb_typeof(payload) = 'object'),
  constraint outbox_events_attempts_check check (
    attempt_count >= 0
    and max_attempts between 1 and 100
    and attempt_count <= max_attempts
  ),
  constraint outbox_events_lease_check check (
    num_nonnulls(locked_at, locked_until, locked_by, claim_token) in (0, 4)
    and (locked_at is null or locked_until > locked_at)
  ),
  constraint outbox_events_terminal_check check (
    not (processed_at is not null and dead_lettered_at is not null)
    and (
      processed_at is null
      or (
        attempt_count > 0
        and num_nonnulls(locked_at, locked_until, locked_by, claim_token) = 0
        and last_error is null
      )
    )
    and (
      dead_lettered_at is null
      or (
        attempt_count > 0
        and num_nonnulls(locked_at, locked_until, locked_by, claim_token) = 0
        and last_error is not null
      )
    )
  )
);

create index outbox_events_claim_idx
  on private.outbox_events (available_at, created_at, id)
  where processed_at is null and dead_lettered_at is null;

create index outbox_events_lease_expiry_idx
  on private.outbox_events (locked_until, id)
  where processed_at is null
    and dead_lettered_at is null
    and locked_until is not null;

create index outbox_events_aggregate_idx
  on private.outbox_events (aggregate_type, aggregate_id, created_at desc);

create index outbox_events_recipient_idx
  on private.outbox_events (recipient_profile_id, created_at desc)
  where recipient_profile_id is not null;

create unique index outbox_events_provider_message_idx
  on private.outbox_events (channel, provider_message_id)
  where provider_message_id is not null;

alter table private.provider_event_inbox enable row level security;
alter table private.provider_event_inbox force row level security;
alter table private.outbox_events enable row level security;
alter table private.outbox_events force row level security;

revoke all on table private.provider_event_inbox from public, anon, authenticated, service_role;
revoke all on table private.outbox_events from public, anon, authenticated, service_role;
grant select, insert, update on table private.provider_event_inbox to service_role;
grant select, insert, update on table private.outbox_events to service_role;

alter table public.payments
  add column checkout_idempotency_key text,
  add column provider_updated_at timestamptz,
  add constraint payments_checkout_idempotency_key_check check (
    checkout_idempotency_key is null
    or length(btrim(checkout_idempotency_key)) between 1 and 500
  );

create unique index payments_provider_checkout_idempotency_idx
  on public.payments (provider, checkout_idempotency_key)
  where checkout_idempotency_key is not null;

create unique index payments_provider_preference_idx
  on public.payments (provider, provider_preference_id)
  where provider_preference_id is not null;

create index payment_events_payment_created_idx
  on public.payment_events (payment_id, created_at)
  where payment_id is not null;

create or replace function public.register_provider_event(
  p_provider text,
  p_provider_event_id text,
  p_resource_type text,
  p_provider_resource_id text,
  p_event_type text,
  p_payload jsonb,
  p_provider_occurred_at timestamptz default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  insert into private.provider_event_inbox (
    provider,
    provider_event_id,
    resource_type,
    provider_resource_id,
    event_type,
    payload,
    provider_occurred_at
  )
  values (
    p_provider,
    p_provider_event_id,
    p_resource_type,
    p_provider_resource_id,
    p_event_type,
    p_payload,
    p_provider_occurred_at
  )
  on conflict (provider, provider_event_id) do update
    set provider_event_id = excluded.provider_event_id
  returning id;
$$;

create or replace function public.enqueue_outbox_event(
  p_event_type text,
  p_aggregate_type text,
  p_aggregate_id uuid,
  p_channel text,
  p_recipient_profile_id uuid,
  p_recipient_key text,
  p_dedupe_key text,
  p_payload jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  insert into private.outbox_events (
    event_type,
    aggregate_type,
    aggregate_id,
    channel,
    recipient_profile_id,
    recipient_key,
    dedupe_key,
    payload
  )
  values (
    p_event_type,
    p_aggregate_type,
    p_aggregate_id,
    p_channel,
    p_recipient_profile_id,
    p_recipient_key,
    p_dedupe_key,
    p_payload
  )
  on conflict (channel, recipient_key, dedupe_key) do update
    set dedupe_key = excluded.dedupe_key
  returning id;
$$;

create or replace function public.claim_provider_events(
  p_worker_id text,
  p_batch_size integer default 20,
  p_lease_seconds integer default 120
)
returns table (
  id uuid,
  provider text,
  provider_event_id text,
  resource_type text,
  provider_resource_id text,
  event_type text,
  payload jsonb,
  provider_occurred_at timestamptz,
  received_at timestamptz,
  attempt_count integer,
  claim_token uuid,
  locked_until timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_worker_id is null or length(btrim(p_worker_id)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'worker_id must contain 1 to 200 characters';
  end if;
  if p_batch_size is null or p_batch_size not between 1 and 100 then
    raise exception using errcode = '22023', message = 'batch_size must be between 1 and 100';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 1 and 3600 then
    raise exception using errcode = '22023', message = 'lease_seconds must be between 1 and 3600';
  end if;

  with expired as (
    select inbox.id
    from private.provider_event_inbox as inbox
    where inbox.processed_at is null
      and inbox.dead_lettered_at is null
      and inbox.attempt_count >= inbox.max_attempts
      and inbox.locked_until <= v_now
    order by inbox.locked_until, inbox.id
    for update skip locked
    limit p_batch_size
  )
  update private.provider_event_inbox as inbox
  set locked_at = null,
      locked_until = null,
      locked_by = null,
      claim_token = null,
      last_error = 'lease expired after maximum attempts',
      dead_lettered_at = v_now
  from expired
  where inbox.id = expired.id;

  return query
  with candidates as (
    select inbox.id
    from private.provider_event_inbox as inbox
    where inbox.processed_at is null
      and inbox.dead_lettered_at is null
      and inbox.attempt_count < inbox.max_attempts
      and inbox.available_at <= v_now
      and (inbox.locked_until is null or inbox.locked_until <= v_now)
    order by inbox.available_at, inbox.received_at, inbox.id
    for update skip locked
    limit p_batch_size
  )
  update private.provider_event_inbox as inbox
  set attempt_count = inbox.attempt_count + 1,
      locked_at = v_now,
      locked_until = v_now + make_interval(secs => p_lease_seconds),
      locked_by = p_worker_id,
      claim_token = gen_random_uuid(),
      last_error = null
  from candidates
  where inbox.id = candidates.id
  returning
    inbox.id,
    inbox.provider,
    inbox.provider_event_id,
    inbox.resource_type,
    inbox.provider_resource_id,
    inbox.event_type,
    inbox.payload,
    inbox.provider_occurred_at,
    inbox.received_at,
    inbox.attempt_count,
    inbox.claim_token,
    inbox.locked_until;
end;
$$;

create or replace function public.claim_outbox_events(
  p_worker_id text,
  p_batch_size integer default 20,
  p_lease_seconds integer default 120
)
returns table (
  id uuid,
  event_type text,
  aggregate_type text,
  aggregate_id uuid,
  channel text,
  recipient_profile_id uuid,
  recipient_key text,
  dedupe_key text,
  payload jsonb,
  created_at timestamptz,
  attempt_count integer,
  claim_token uuid,
  locked_until timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_worker_id is null or length(btrim(p_worker_id)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'worker_id must contain 1 to 200 characters';
  end if;
  if p_batch_size is null or p_batch_size not between 1 and 100 then
    raise exception using errcode = '22023', message = 'batch_size must be between 1 and 100';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 1 and 3600 then
    raise exception using errcode = '22023', message = 'lease_seconds must be between 1 and 3600';
  end if;

  with expired as (
    select outbox.id
    from private.outbox_events as outbox
    where outbox.processed_at is null
      and outbox.dead_lettered_at is null
      and outbox.attempt_count >= outbox.max_attempts
      and outbox.locked_until <= v_now
    order by outbox.locked_until, outbox.id
    for update skip locked
    limit p_batch_size
  )
  update private.outbox_events as outbox
  set locked_at = null,
      locked_until = null,
      locked_by = null,
      claim_token = null,
      last_error = 'lease expired after maximum attempts',
      dead_lettered_at = v_now
  from expired
  where outbox.id = expired.id;

  return query
  with candidates as (
    select outbox.id
    from private.outbox_events as outbox
    where outbox.processed_at is null
      and outbox.dead_lettered_at is null
      and outbox.attempt_count < outbox.max_attempts
      and outbox.available_at <= v_now
      and (outbox.locked_until is null or outbox.locked_until <= v_now)
    order by outbox.available_at, outbox.created_at, outbox.id
    for update skip locked
    limit p_batch_size
  )
  update private.outbox_events as outbox
  set attempt_count = outbox.attempt_count + 1,
      locked_at = v_now,
      locked_until = v_now + make_interval(secs => p_lease_seconds),
      locked_by = p_worker_id,
      claim_token = gen_random_uuid(),
      last_error = null
  from candidates
  where outbox.id = candidates.id
  returning
    outbox.id,
    outbox.event_type,
    outbox.aggregate_type,
    outbox.aggregate_id,
    outbox.channel,
    outbox.recipient_profile_id,
    outbox.recipient_key,
    outbox.dedupe_key,
    outbox.payload,
    outbox.created_at,
    outbox.attempt_count,
    outbox.claim_token,
    outbox.locked_until;
end;
$$;

-- ACK/FAIL use the claim token as a fencing token. Lease expiry alone does not
-- invalidate a worker; a successful reclaim rotates the token and fences it out.
create or replace function public.ack_provider_event(
  p_event_id uuid,
  p_claim_token uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update private.provider_event_inbox as inbox
  set processed_at = clock_timestamp(),
      locked_at = null,
      locked_until = null,
      locked_by = null,
      claim_token = null,
      last_error = null
  where inbox.id = p_event_id
    and inbox.claim_token = p_claim_token
    and inbox.processed_at is null
    and inbox.dead_lettered_at is null;

  return found;
end;
$$;

create or replace function public.fail_provider_event(
  p_event_id uuid,
  p_claim_token uuid,
  p_error text,
  p_retry_at timestamptz default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_error is null or length(btrim(p_error)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'error must contain 1 to 2000 characters';
  end if;

  update private.provider_event_inbox as inbox
  set available_at = case
        when inbox.attempt_count >= inbox.max_attempts then inbox.available_at
        else coalesce(p_retry_at, v_now + interval '1 minute')
      end,
      locked_at = null,
      locked_until = null,
      locked_by = null,
      claim_token = null,
      last_error = p_error,
      dead_lettered_at = case
        when inbox.attempt_count >= inbox.max_attempts then v_now
        else null
      end
  where inbox.id = p_event_id
    and inbox.claim_token = p_claim_token
    and inbox.processed_at is null
    and inbox.dead_lettered_at is null;

  return found;
end;
$$;

create or replace function public.ack_outbox_event(
  p_event_id uuid,
  p_claim_token uuid,
  p_provider_message_id text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_provider_message_id is not null
    and length(btrim(p_provider_message_id)) not between 1 and 500 then
    raise exception using errcode = '22023', message = 'provider_message_id must contain 1 to 500 characters';
  end if;

  update private.outbox_events as outbox
  set processed_at = clock_timestamp(),
      locked_at = null,
      locked_until = null,
      locked_by = null,
      claim_token = null,
      last_error = null,
      provider_message_id = p_provider_message_id
  where outbox.id = p_event_id
    and outbox.claim_token = p_claim_token
    and outbox.processed_at is null
    and outbox.dead_lettered_at is null;

  return found;
end;
$$;

create or replace function public.fail_outbox_event(
  p_event_id uuid,
  p_claim_token uuid,
  p_error text,
  p_retry_at timestamptz default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_error is null or length(btrim(p_error)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'error must contain 1 to 2000 characters';
  end if;

  update private.outbox_events as outbox
  set available_at = case
        when outbox.attempt_count >= outbox.max_attempts then outbox.available_at
        else coalesce(p_retry_at, v_now + interval '1 minute')
      end,
      locked_at = null,
      locked_until = null,
      locked_by = null,
      claim_token = null,
      last_error = p_error,
      dead_lettered_at = case
        when outbox.attempt_count >= outbox.max_attempts then v_now
        else null
      end
  where outbox.id = p_event_id
    and outbox.claim_token = p_claim_token
    and outbox.processed_at is null
    and outbox.dead_lettered_at is null;

  return found;
end;
$$;

revoke all on function public.register_provider_event(text, text, text, text, text, jsonb, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_provider_events(text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.ack_provider_event(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.fail_provider_event(uuid, uuid, text, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.enqueue_outbox_event(text, text, uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_outbox_events(text, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.ack_outbox_event(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.fail_outbox_event(uuid, uuid, text, timestamptz)
  from public, anon, authenticated, service_role;

grant execute on function public.register_provider_event(text, text, text, text, text, jsonb, timestamptz)
  to service_role;
grant execute on function public.claim_provider_events(text, integer, integer)
  to service_role;
grant execute on function public.ack_provider_event(uuid, uuid)
  to service_role;
grant execute on function public.fail_provider_event(uuid, uuid, text, timestamptz)
  to service_role;
grant execute on function public.enqueue_outbox_event(text, text, uuid, text, uuid, text, text, jsonb)
  to service_role;
grant execute on function public.claim_outbox_events(text, integer, integer)
  to service_role;
grant execute on function public.ack_outbox_event(uuid, uuid, text)
  to service_role;
grant execute on function public.fail_outbox_event(uuid, uuid, text, timestamptz)
  to service_role;

-- The legacy handler has no authenticated provider boundary and must stay disabled.
revoke all on function public.apply_mercadopago_payment_webhook(text, text, text, jsonb)
  from public, anon, authenticated, service_role;
