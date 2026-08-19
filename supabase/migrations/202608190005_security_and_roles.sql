-- Lysto MVP - trusted roles, least-privilege RLS and hardened application RPCs.
-- Storage objects/buckets and external-event verification are intentionally handled by later migrations.

create schema if not exists private;

do $$
begin
  create type public.admin_permission as enum ('operations', 'finance', 'quality', 'owner');
exception
  when duplicate_object then null;
end;
$$;

create table if not exists private.admin_profile_permissions (
  admin_profile_id uuid not null references public.admin_profiles(id) on delete cascade,
  permission public.admin_permission not null,
  granted_by_admin_profile_id uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (admin_profile_id, permission)
);

alter table private.admin_profile_permissions enable row level security;
alter table private.admin_profile_permissions force row level security;

do $$
begin
  create type private.payment_refund_status as enum (
    'requested',
    'processing',
    'succeeded',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end;
$$;

create table if not exists private.payment_refund_requests (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  amount numeric(12,2) not null
    constraint payment_refund_requests_amount_positive
    check (amount::text not in ('NaN', 'Infinity', '-Infinity') and amount > 0),
  reason text not null
    constraint payment_refund_requests_reason_nonempty
    check (length(btrim(reason)) > 0 and length(reason) <= 2000),
  idempotency_key text not null
    constraint payment_refund_requests_idempotency_key_nonempty
    check (length(btrim(idempotency_key)) > 0 and length(idempotency_key) <= 200),
  status private.payment_refund_status not null default 'requested',
  requested_by uuid not null references public.profiles(id) on delete restrict,
  attempt_count integer not null default 0
    constraint payment_refund_requests_attempt_count_nonnegative check (attempt_count >= 0),
  claim_token uuid,
  locked_until timestamptz,
  provider_reference text
    constraint payment_refund_requests_provider_reference_unique unique,
  failure_reason text,
  last_error text,
  requested_at timestamptz not null default now(),
  processing_started_at timestamptz,
  processed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint payment_refund_requests_idempotency_key_unique unique (idempotency_key),
  constraint payment_refund_requests_state_shape check (
    (
      status = 'requested'
      and attempt_count = 0
      and claim_token is null
      and locked_until is null
      and processing_started_at is null
      and processed_at is null
      and provider_reference is null
      and failure_reason is null
      and (
        last_error is null
        or (
          length(btrim(last_error)) > 0
          and length(last_error) <= 2000
        )
      )
      and last_error is null
    )
    or (
      status = 'processing'
      and attempt_count > 0
      and claim_token is not null
      and locked_until is not null
      and processing_started_at is not null
      and locked_until > processing_started_at
      and processed_at is null
      and provider_reference is null
      and failure_reason is null
    )
    or (
      status = 'succeeded'
      and attempt_count > 0
      and claim_token is not null
      and locked_until is null
      and processing_started_at is not null
      and processed_at is not null
      and processed_at >= processing_started_at
      and provider_reference is not null
      and length(btrim(provider_reference)) > 0
      and length(provider_reference) <= 255
      and failure_reason is null
      and last_error is null
    )
    or (
      status in ('failed', 'cancelled')
      and attempt_count > 0
      and claim_token is not null
      and locked_until is null
      and processing_started_at is not null
      and processed_at is not null
      and processed_at >= processing_started_at
      and provider_reference is null
      and failure_reason is not null
      and length(btrim(failure_reason)) > 0
      and length(failure_reason) <= 2000
      and last_error is null
    )
  )
);

comment on table private.payment_refund_requests is
  'Durable refund initiation queue. Task 18 performs signed provider execution and records the canonical outcome; this table never implies that Mercado Pago already refunded a payment.';

create index if not exists payment_refund_requests_payment_status_idx
  on private.payment_refund_requests(payment_id, status, requested_at desc);
create index if not exists payment_refund_requests_requested_claim_idx
  on private.payment_refund_requests(requested_at, id)
  where status = 'requested';
create index if not exists payment_refund_requests_processing_claim_idx
  on private.payment_refund_requests(locked_until, requested_at, id)
  where status = 'processing';

alter table private.payment_refund_requests enable row level security;
alter table private.payment_refund_requests force row level security;

alter table public.receipts
  add column if not exists revoked_at timestamptz;

update public.receipts
set expires_at = created_at + interval '90 days'
where expires_at is null;

alter table public.receipts
  alter column expires_at set default (now() + interval '90 days'),
  alter column expires_at set not null;

alter table public.service_requests
  add column if not exists equipment_id uuid;

create unique index if not exists request_media_storage_object_key
  on public.request_media(storage_bucket, storage_path);
create unique index if not exists professional_documents_storage_object_key
  on public.professional_documents(storage_bucket, storage_path);
create unique index if not exists job_media_storage_object_key
  on public.job_media(storage_bucket, storage_path);

create index if not exists idx_job_media_job on public.job_media(job_id);
create index if not exists idx_payments_customer on public.payments(customer_id);
create index if not exists idx_payments_professional on public.payments(professional_id);
create index if not exists idx_reviews_customer on public.reviews(customer_id);
create index if not exists idx_reviews_professional on public.reviews(professional_id);
create index if not exists idx_service_requests_address_customer
  on public.service_requests(address_id, customer_id)
  where address_id is not null;
create index if not exists idx_service_requests_selected_price_request
  on public.service_requests(selected_price_option_id, id)
  where selected_price_option_id is not null;
create index if not exists idx_customer_equipment_address_customer
  on public.customer_equipment(address_id, customer_id);
create index if not exists idx_service_requests_equipment_owner
  on public.service_requests(equipment_id, customer_id, address_id, category_id)
  where equipment_id is not null;

do $$
begin
  alter table public.customer_addresses
    add constraint customer_addresses_id_customer_key unique (id, customer_id);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.price_options
    add constraint price_options_id_request_key unique (id, request_id);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.service_requests
    add constraint service_requests_id_customer_key unique (id, customer_id);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.customer_equipment
    add constraint customer_equipment_id_owner_location_category_key
    unique (id, customer_id, address_id, category_id);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.customer_equipment
    add constraint customer_equipment_address_owner_fk
    foreign key (address_id, customer_id)
    references public.customer_addresses(id, customer_id);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.service_requests
    add constraint service_requests_equipment_owner_fk
    foreign key (equipment_id, customer_id, address_id, category_id)
    references public.customer_equipment(id, customer_id, address_id, category_id);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.service_requests
    add constraint service_requests_equipment_requires_address
    check (equipment_id is null or address_id is not null);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.service_requests
    add constraint service_requests_address_owner_fk
    foreign key (address_id, customer_id)
    references public.customer_addresses(id, customer_id);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.service_requests
    add constraint service_requests_selected_price_owner_fk
    foreign key (selected_price_option_id, id)
    references public.price_options(id, request_id)
    deferrable initially deferred;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.jobs
    add constraint jobs_request_customer_fk
    foreign key (request_id, customer_id)
    references public.service_requests(id, customer_id);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.pricing_rules
    add constraint pricing_rules_base_price_nonnegative
    check (
      base_price::text not in ('NaN', 'Infinity', '-Infinity')
      and base_price >= 0
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.pricing_rules
    add constraint pricing_rules_effective_price_nonnegative
    check (
      issue_adjustment::text not in ('NaN', 'Infinity', '-Infinity')
      and (base_price + issue_adjustment)::text not in ('NaN', 'Infinity', '-Infinity')
      and base_price + issue_adjustment >= 0
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.pricing_rules
    add constraint pricing_rules_priority_multiplier_bounds
    check (
      priority_multiplier::text not in ('NaN', 'Infinity', '-Infinity')
      and priority_multiplier between 1 and 5
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.pricing_rules
    add constraint pricing_rules_platform_fee_rate_bounds
    check (
      platform_fee_rate::text not in ('NaN', 'Infinity', '-Infinity')
      and platform_fee_rate between 0 and 1
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.price_options
    add constraint price_options_financials_consistent
    check (
      amount::text not in ('NaN', 'Infinity', '-Infinity')
      and platform_fee::text not in ('NaN', 'Infinity', '-Infinity')
      and professional_amount::text not in ('NaN', 'Infinity', '-Infinity')
      and (platform_fee + professional_amount)::text not in ('NaN', 'Infinity', '-Infinity')
      and amount >= 0
      and platform_fee >= 0
      and professional_amount >= 0
      and abs((platform_fee + professional_amount) - amount) <= 0.01
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.payments
    add constraint payments_financials_consistent
    check (
      amount::text not in ('NaN', 'Infinity', '-Infinity')
      and marketplace_fee::text not in ('NaN', 'Infinity', '-Infinity')
      and professional_amount::text not in ('NaN', 'Infinity', '-Infinity')
      and (marketplace_fee + professional_amount)::text not in ('NaN', 'Infinity', '-Infinity')
      and amount >= 0
      and marketplace_fee >= 0
      and professional_amount >= 0
      and abs((marketplace_fee + professional_amount) - amount) <= 0.01
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.payout_records
    add constraint payout_records_amount_nonnegative
    check (
      amount::text not in ('NaN', 'Infinity', '-Infinity')
      and amount >= 0
    );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.jobs
    add constraint jobs_final_amount_nonnegative
    check (
      final_amount is null
      or (
        final_amount::text not in ('NaN', 'Infinity', '-Infinity')
        and final_amount >= 0
      )
    );
exception
  when duplicate_object then null;
end;
$$;

create or replace function private.enforce_payment_refund_request_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'requested'
       or new.attempt_count <> 0
       or new.claim_token is not null
       or new.locked_until is not null
       or new.processing_started_at is not null
       or new.processed_at is not null
       or new.provider_reference is not null
       or new.failure_reason is not null
       or new.last_error is not null then
      raise exception 'New refund requests must start requested and unclaimed';
    end if;
    return new;
  end if;

  if new.payment_id is distinct from old.payment_id
     or new.amount is distinct from old.amount
     or new.reason is distinct from old.reason
     or new.idempotency_key is distinct from old.idempotency_key
     or new.requested_by is distinct from old.requested_by
     or new.requested_at is distinct from old.requested_at then
    raise exception 'Refund request identity and amount are immutable';
  end if;

  if old.status = 'requested'
     and new.status = 'processing'
     and new.attempt_count = old.attempt_count + 1
     and new.claim_token is not null
     and new.locked_until > clock_timestamp()
     and new.processing_started_at is not null
     and new.last_error is null then
    return new;
  end if;

  if old.status = 'processing'
     and new.status = 'processing'
     and old.locked_until <= clock_timestamp()
     and new.attempt_count = old.attempt_count + 1
     and new.claim_token is distinct from old.claim_token
     and new.locked_until > clock_timestamp()
     and new.processing_started_at is not null
     and new.last_error is null then
    return new;
  end if;

  if old.status = 'processing'
     and new.status = 'processing'
     and new.attempt_count = old.attempt_count
     and new.claim_token is distinct from old.claim_token
     and new.processing_started_at = old.processing_started_at
     and new.processed_at is null
     and new.last_error is not null
     and length(btrim(new.last_error)) > 0 then
    return new;
  end if;

  if old.status = 'processing'
     and new.status in ('succeeded', 'failed', 'cancelled')
     and new.attempt_count = old.attempt_count
     and new.claim_token = old.claim_token
     and new.processing_started_at = old.processing_started_at
     and new.processed_at is not null
     and new.last_error is null then
    return new;
  end if;

  raise exception 'Invalid refund request state transition';
end;
$$;

drop trigger if exists payment_refund_requests_state_guard
on private.payment_refund_requests;
create trigger payment_refund_requests_state_guard
before insert or update on private.payment_refund_requests
for each row execute function private.enforce_payment_refund_request_state();

create or replace function private.stamp_payment_refund_request_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists payment_refund_requests_updated_at
on private.payment_refund_requests;
create trigger payment_refund_requests_updated_at
before update on private.payment_refund_requests
for each row execute function private.stamp_payment_refund_request_updated_at();

create or replace function private.current_app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
    and p.role::text = (select auth.jwt() -> 'app_metadata' ->> 'app_role')
  limit 1;
$$;

create or replace function private.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles p
  where p.auth_user_id = (select auth.uid())
    and p.role::text = (select auth.jwt() -> 'app_metadata' ->> 'app_role')
  limit 1;
$$;

create or replace function private.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cp.id
  from public.customer_profiles cp
  join public.profiles p on p.id = cp.profile_id
  where p.auth_user_id = (select auth.uid())
    and p.role = 'customer'
    and (select auth.jwt() -> 'app_metadata' ->> 'app_role') = 'customer'
  limit 1;
$$;

create or replace function private.current_professional_id(p_require_approved boolean default false)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select pp.id
  from public.professional_profiles pp
  join public.profiles p on p.id = pp.profile_id
  where p.auth_user_id = (select auth.uid())
    and p.role = 'professional'
    and (select auth.jwt() -> 'app_metadata' ->> 'app_role') = 'professional'
    and (not p_require_approved or pp.status = 'approved')
  limit 1;
$$;

create or replace function private.current_admin_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ap.id
  from public.admin_profiles ap
  join public.profiles p on p.id = ap.profile_id
  where p.auth_user_id = (select auth.uid())
    and p.role = 'admin'
    and (select auth.jwt() -> 'app_metadata' ->> 'app_role') = 'admin'
  limit 1;
$$;

create or replace function private.has_admin_permission(p_permission public.admin_permission)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from private.admin_profile_permissions app
      where app.admin_profile_id = private.current_admin_profile_id()
        and app.permission in (p_permission, 'owner'::public.admin_permission)
    ),
    false
  );
$$;

create or replace function private.has_any_admin_permission()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from private.admin_profile_permissions app
      where app.admin_profile_id = private.current_admin_profile_id()
    ),
    false
  );
$$;

create or replace function private.stamp_professional_document_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
begin
  if (select auth.uid()) is null then
    return new;
  end if;

  if not private.has_admin_permission('operations') then
    raise exception 'Operations permission required';
  end if;

  if new.status is distinct from old.status then
    v_actor_profile_id := private.current_profile_id();
    if v_actor_profile_id is null then
      raise exception 'Authenticated admin profile required';
    end if;
    new.reviewed_by := v_actor_profile_id;
    new.reviewed_at := now();
  elsif new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at then
    raise exception 'Reviewer identity is server-derived';
  end if;

  return new;
end;
$$;

drop trigger if exists professional_documents_stamp_review
on public.professional_documents;
create trigger professional_documents_stamp_review
before update on public.professional_documents
for each row execute function private.stamp_professional_document_review();

create or replace function private.stamp_platform_setting_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
begin
  if (select auth.uid()) is not null then
    v_actor_profile_id := private.current_profile_id();
    if v_actor_profile_id is null or not private.has_any_admin_permission() then
      raise exception 'Authenticated admin permission required';
    end if;
    new.updated_by := v_actor_profile_id;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists platform_settings_stamp_actor
on public.platform_settings;
create trigger platform_settings_stamp_actor
before insert or update on public.platform_settings
for each row execute function private.stamp_platform_setting_actor();

create or replace function private.append_admin_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_actor uuid := private.current_profile_id();
begin
  if not private.has_any_admin_permission() then
    raise exception 'Admin permission required';
  end if;

  insert into public.admin_audit_logs(actor_profile_id, action, entity_type, entity_id, metadata)
  values (v_actor, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function private.request_payment_refund(
  p_payment_id uuid,
  p_amount numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
  v_payment public.payments%rowtype;
  v_request private.payment_refund_requests%rowtype;
  v_normalized_reason text := btrim(p_reason);
  v_normalized_key text := btrim(p_idempotency_key);
  v_reserved_amount numeric(12,2);
begin
  if not private.has_admin_permission('finance') then
    raise exception 'Finance permission required';
  end if;

  v_actor_profile_id := private.current_profile_id();
  if v_actor_profile_id is null then
    raise exception 'Authenticated admin profile required';
  end if;

  if coalesce(length(v_normalized_reason), 0) = 0
     or length(v_normalized_reason) > 2000 then
    raise exception 'Refund reason required';
  end if;

  if coalesce(length(v_normalized_key), 0) = 0
     or length(v_normalized_key) > 200 then
    raise exception 'Refund idempotency key required';
  end if;

  if p_amount is not null and p_amount <> round(p_amount, 2) then
    raise exception 'Refund amount must have at most two decimal places';
  end if;

  select p.*
  into v_payment
  from public.payments p
  where p.id = p_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'Payment not found';
  end if;

  if v_payment.provider <> 'mercadopago'
     or nullif(btrim(v_payment.provider_payment_id), '') is null
     or v_payment.status not in ('approved', 'captured', 'partially_refunded') then
    raise exception 'Payment is not eligible for Mercado Pago refund';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > v_payment.amount then
    raise exception 'Refund amount must be positive and not exceed payment amount';
  end if;

  select prr.*
  into v_request
  from private.payment_refund_requests prr
  where prr.idempotency_key = v_normalized_key;

  if v_request.id is not null then
    if v_request.payment_id <> p_payment_id
       or v_request.amount <> p_amount
       or v_request.reason <> v_normalized_reason then
      raise exception 'Refund idempotency key conflict';
    end if;

    return jsonb_build_object(
      'id', v_request.id,
      'status', v_request.status::text,
      'idempotent', true
    );
  end if;

  select coalesce(sum(prr.amount), 0)
  into v_reserved_amount
  from private.payment_refund_requests prr
  where prr.payment_id = p_payment_id
    and prr.status in ('requested', 'processing', 'succeeded');

  if v_reserved_amount + p_amount > v_payment.amount then
    raise exception 'Refund amount exceeds unrefunded payment balance';
  end if;

  insert into private.payment_refund_requests (
    payment_id,
    amount,
    reason,
    idempotency_key,
    requested_by
  )
  values (
    p_payment_id,
    p_amount,
    v_normalized_reason,
    v_normalized_key,
    v_actor_profile_id
  )
  on conflict on constraint payment_refund_requests_idempotency_key_unique do nothing
  returning * into v_request;

  if v_request.id is null then
    select prr.*
    into v_request
    from private.payment_refund_requests prr
    where prr.idempotency_key = v_normalized_key;

    if v_request.id is null
       or v_request.payment_id <> p_payment_id
       or v_request.amount <> p_amount
       or v_request.reason <> v_normalized_reason then
      raise exception 'Refund idempotency key conflict';
    end if;

    return jsonb_build_object(
      'id', v_request.id,
      'status', v_request.status::text,
      'idempotent', true
    );
  end if;

  perform private.append_admin_audit(
    'payment.refund.requested',
    'payment_refund_request',
    v_request.id,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'amount', p_amount,
      'currency', v_payment.currency,
      'status', v_request.status::text
    )
  );

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status::text,
    'idempotent', false
  );
end;
$$;

create or replace function private.claim_payment_refund_requests(
  p_batch_size integer default 10,
  p_lease_seconds integer default 300
)
returns table (
  request_id uuid,
  payment_id uuid,
  amount numeric,
  currency text,
  reason text,
  provider_payment_id text,
  provider_idempotency_key text,
  claim_token uuid,
  attempt_count integer,
  locked_until timestamptz,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 50 then
    raise exception 'Refund claim batch size must be between 1 and 50';
  end if;

  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'Refund claim lease must be between 30 and 900 seconds';
  end if;

  return query
  with candidates as materialized (
    select prr.id
    from private.payment_refund_requests prr
    join public.payments p on p.id = prr.payment_id
    where (
      prr.status = 'requested'
      or (
        prr.status = 'processing'
        and prr.locked_until <= v_now
      )
    )
      and p.provider = 'mercadopago'
      and nullif(btrim(p.provider_payment_id), '') is not null
      and p.status in ('approved', 'captured', 'partially_refunded')
    order by prr.requested_at, prr.id
    for update of prr, p skip locked
    limit p_batch_size
  ), claimed as (
    update private.payment_refund_requests prr
    set status = 'processing',
        attempt_count = prr.attempt_count + 1,
        claim_token = gen_random_uuid(),
        locked_until = v_now + make_interval(secs => p_lease_seconds),
        processing_started_at = v_now,
        processed_at = null,
        provider_reference = null,
        failure_reason = null,
        last_error = null
    from candidates c
    where prr.id = c.id
    returning prr.*
  )
  select
    c.id,
    c.payment_id,
    c.amount,
    p.currency,
    c.reason,
    p.provider_payment_id,
    c.id::text,
    c.claim_token,
    c.attempt_count,
    c.locked_until,
    c.status::text
  from claimed c
  join public.payments p on p.id = c.payment_id
  order by c.requested_at, c.id;
end;
$$;

create or replace function private.finalize_payment_refund_request(
  p_request_id uuid,
  p_claim_token uuid,
  p_provider_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.payment_refund_requests%rowtype;
  v_payment public.payments%rowtype;
  v_provider_reference text := btrim(p_provider_reference);
  v_now timestamptz := clock_timestamp();
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if coalesce(length(v_provider_reference), 0) = 0
     or length(v_provider_reference) > 255 then
    raise exception 'Provider refund reference required';
  end if;

  select prr.*
  into v_request
  from private.payment_refund_requests prr
  where prr.id = p_request_id
  for update;

  if v_request.id is null then
    raise exception 'Refund claim is stale or expired';
  end if;

  if v_request.status = 'succeeded' then
    if v_request.provider_reference = v_provider_reference then
      return jsonb_build_object(
        'id', v_request.id,
        'status', v_request.status::text,
        'provider_reference', v_request.provider_reference,
        'idempotent', true
      );
    end if;

    raise exception 'Refund provider reference conflict';
  end if;

  if v_request.status <> 'processing'
     or v_request.claim_token is distinct from p_claim_token
     or v_request.locked_until <= v_now then
    raise exception 'Refund claim is stale or expired';
  end if;

  select p.*
  into v_payment
  from public.payments p
  where p.id = v_request.payment_id
  for update;

  if v_payment.id is null
     or v_payment.provider <> 'mercadopago'
     or nullif(btrim(v_payment.provider_payment_id), '') is null
     or v_payment.status not in ('approved', 'captured', 'partially_refunded') then
    raise exception 'Payment is no longer eligible for Mercado Pago refund';
  end if;

  update private.payment_refund_requests prr
  set status = 'succeeded',
      provider_reference = v_provider_reference,
      failure_reason = null,
      last_error = null,
      processed_at = v_now,
      locked_until = null
  where prr.id = p_request_id
    and prr.status = 'processing'
    and prr.claim_token = p_claim_token
    and prr.locked_until > v_now
  returning prr.* into v_request;

  if v_request.id is null then
    raise exception 'Refund claim is stale or expired';
  end if;

  insert into public.admin_audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    null,
    'payment.refund.succeeded',
    'payment_refund_request',
    v_request.id,
    jsonb_build_object(
      'payment_id', v_request.payment_id,
      'provider_reference', v_request.provider_reference,
      'attempt_count', v_request.attempt_count
    )
  );

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status::text,
    'provider_reference', v_request.provider_reference,
    'idempotent', false
  );
end;
$$;

create or replace function private.fail_payment_refund_request(
  p_request_id uuid,
  p_claim_token uuid,
  p_failure_reason text,
  p_is_definitive boolean,
  p_retry_seconds integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request private.payment_refund_requests%rowtype;
  v_failure_reason text := btrim(p_failure_reason);
  v_now timestamptz := clock_timestamp();
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  if coalesce(length(v_failure_reason), 0) = 0
     or length(v_failure_reason) > 2000 then
    raise exception 'Refund failure reason required';
  end if;

  if p_is_definitive is null then
    raise exception 'Definitive failure flag required';
  end if;

  if p_retry_seconds is null or p_retry_seconds < 0 or p_retry_seconds > 3600 then
    raise exception 'Refund retry delay must be between 0 and 3600 seconds';
  end if;

  if p_is_definitive then
    update private.payment_refund_requests prr
    set status = 'failed',
        provider_reference = null,
        failure_reason = v_failure_reason,
        last_error = null,
        processed_at = v_now,
        locked_until = null
    where prr.id = p_request_id
      and prr.status = 'processing'
      and prr.claim_token = p_claim_token
      and prr.locked_until > v_now
    returning prr.* into v_request;
  else
    update private.payment_refund_requests prr
    set status = 'processing',
        claim_token = gen_random_uuid(),
        locked_until = greatest(
          v_now + make_interval(secs => p_retry_seconds),
          prr.processing_started_at + interval '1 microsecond'
        ),
        provider_reference = null,
        failure_reason = null,
        last_error = v_failure_reason,
        processed_at = null
    where prr.id = p_request_id
      and prr.status = 'processing'
      and prr.claim_token = p_claim_token
      and prr.locked_until > v_now
    returning prr.* into v_request;
  end if;

  if v_request.id is null then
    raise exception 'Refund claim is stale or expired';
  end if;

  insert into public.admin_audit_logs (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    null,
    case
      when p_is_definitive then 'payment.refund.failed'
      else 'payment.refund.retry_scheduled'
    end,
    'payment_refund_request',
    v_request.id,
    jsonb_build_object(
      'payment_id', v_request.payment_id,
      'attempt_count', v_request.attempt_count,
      'definitive', p_is_definitive,
      'retry_seconds', case when p_is_definitive then null else p_retry_seconds end
    )
  );

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_request.status::text,
    'definitive', p_is_definitive,
    'retryable', not p_is_definitive,
    'locked_until', v_request.locked_until,
    'provider_idempotency_key', v_request.id::text
  );
end;
$$;

create or replace function private.set_admin_permissions(
  p_admin_profile_id uuid,
  p_permissions public.admin_permission[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_admin_id uuid := private.current_admin_profile_id();
  v_permissions public.admin_permission[] := coalesce(p_permissions, array[]::public.admin_permission[]);
begin
  if coalesce((select auth.role()), '') <> 'service_role'
     and not private.has_admin_permission('owner') then
    raise exception 'Owner permission required';
  end if;

  -- Stable application-wide key: serialize owner mutations so two transactions cannot both
  -- observe another owner and concurrently remove the final two owner grants.
  perform pg_advisory_xact_lock(537975841827451329::bigint);

  if not exists (select 1 from public.admin_profiles ap where ap.id = p_admin_profile_id) then
    raise exception 'Admin profile not found';
  end if;

  if exists (
    select 1
    from private.admin_profile_permissions app
    where app.admin_profile_id = p_admin_profile_id
      and app.permission = 'owner'
  )
  and not ('owner'::public.admin_permission = any(v_permissions))
  and not exists (
    select 1
    from private.admin_profile_permissions app
    where app.permission = 'owner'
      and app.admin_profile_id <> p_admin_profile_id
  ) then
    raise exception 'Cannot remove the last owner permission';
  end if;

  delete from private.admin_profile_permissions app
  where app.admin_profile_id = p_admin_profile_id
    and not (app.permission = any(v_permissions));

  insert into private.admin_profile_permissions(admin_profile_id, permission, granted_by_admin_profile_id)
  select distinct p_admin_profile_id, requested.permission, v_actor_admin_id
  from unnest(v_permissions) as requested(permission)
  on conflict (admin_profile_id, permission) do nothing;

  if coalesce((select auth.role()), '') <> 'service_role' then
    perform private.append_admin_audit(
      'admin.permissions.updated',
      'admin_profile',
      p_admin_profile_id,
      jsonb_build_object('permissions', v_permissions)
    );
  end if;
end;
$$;

create or replace function private.lookup_public_receipt(p_token uuid)
returns table (
  service_name text,
  professional_name text,
  work_done text,
  warranty_days integer,
  next_maintenance_date date,
  issued_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sc.name as service_name,
    coalesce(
      nullif(trim(concat_ws(' ', p.first_name, nullif(left(p.last_name, 1), '') || '.')), ''),
      'Profesional Lysto'
    ) as professional_name,
    fr.work_done,
    fr.warranty_days,
    fr.next_maintenance_date,
    r.created_at as issued_at
  from public.receipts r
  join public.jobs j on j.id = r.job_id
  join public.service_requests sr on sr.id = j.request_id
  join public.service_categories sc on sc.id = sr.category_id
  join public.job_final_reports fr on fr.id = r.final_report_id
  left join public.professional_profiles pp on pp.id = j.professional_id
  left join public.profiles p on p.id = pp.profile_id
  where r.public_token = p_token
    and r.revoked_at is null
    and r.expires_at > now()
  limit 1;
$$;

create or replace function private.create_job_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.job_status_events(job_id, status, actor_profile_id, notes)
    values (new.id, new.status, private.current_profile_id(), 'job_created');
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.job_status_events(job_id, status, actor_profile_id, notes)
    values (new.id, new.status, private.current_profile_id(), 'status_changed');
  end if;

  return new;
end;
$$;

create or replace function private.create_service_request_from_app(
  p_customer_id uuid,
  p_address_id uuid,
  p_category_slug text,
  p_issue_slug text,
  p_time_since text,
  p_preferred_date date,
  p_preferred_time_window text,
  p_selected_option public.urgency_level,
  p_diagnosis jsonb,
  p_flexible_price numeric,
  p_priority_price numeric,
  p_selected_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_id uuid;
  v_issue_id uuid;
  v_request_id uuid;
  v_flexible_id uuid;
  v_priority_id uuid;
  v_selected_id uuid;
  v_base_price numeric;
  v_priority_multiplier numeric;
  v_platform_rate numeric;
  v_flexible_price numeric;
  v_priority_price numeric;
  v_zone_slug text;
begin
  -- Legacy callers still send these values, but trusted pricing is recomputed below.
  perform p_flexible_price, p_priority_price, p_selected_amount;

  if private.current_app_role() = 'customer' then
    if p_customer_id is distinct from private.current_customer_id() then
      raise exception 'Customer can only create own requests';
    end if;
  elsif not private.has_admin_permission('operations') then
    raise exception 'Customer or operations permission required';
  end if;

  select case
    when (
      lower(trim(ca.province)) = 'buenos aires'
      and lower(trim(ca.city)) in (
        'caba',
        'capital federal',
        'ciudad autónoma de buenos aires',
        'ciudad autonoma de buenos aires'
      )
    )
    or (
      lower(trim(ca.province)) in (
        'caba',
        'capital federal',
        'ciudad autónoma de buenos aires',
        'ciudad autonoma de buenos aires'
      )
      and lower(trim(ca.city)) in (
        'caba',
        'capital federal',
        'ciudad autónoma de buenos aires',
        'ciudad autonoma de buenos aires',
        'agronomía',
        'agronomia',
        'almagro',
        'balvanera',
        'barracas',
        'belgrano',
        'boedo',
        'caballito',
        'chacarita',
        'coghlan',
        'colegiales',
        'constitución',
        'constitucion',
        'flores',
        'floresta',
        'la boca',
        'la paternal',
        'liniers',
        'mataderos',
        'monserrat',
        'monte castro',
        'nueva pompeya',
        'núñez',
        'nunez',
        'palermo',
        'parque avellaneda',
        'parque chacabuco',
        'parque chas',
        'parque patricios',
        'paternal',
        'puerto madero',
        'recoleta',
        'retiro',
        'saavedra',
        'san cristóbal',
        'san cristobal',
        'san nicolás',
        'san nicolas',
        'san telmo',
        'vélez sársfield',
        'velez sarsfield',
        'versalles',
        'villa crespo',
        'villa del parque',
        'villa devoto',
        'villa general mitre',
        'villa lugano',
        'villa luro',
        'villa ortúzar',
        'villa ortuzar',
        'villa pueyrredón',
        'villa pueyrredon',
        'villa real',
        'villa riachuelo',
        'villa santa rita',
        'villa soldati',
        'villa urquiza'
      )
    ) then 'caba'
    when lower(trim(ca.province)) = 'buenos aires'
      and lower(trim(ca.city)) = 'berazategui' then 'berazategui'
    when lower(trim(ca.province)) = 'buenos aires'
      and lower(trim(ca.city)) in ('hudson', 'guillermo enrique hudson') then 'hudson'
    when lower(trim(ca.province)) = 'buenos aires'
      and lower(trim(ca.city)) in (
      'avellaneda',
      'lanús',
      'lanus',
      'lomas de zamora',
      'quilmes',
      'florencio varela'
    ) then 'gba_sur'
    else null
  end
  into v_zone_slug
  from public.customer_addresses ca
  where ca.id = p_address_id
    and ca.customer_id = p_customer_id;

  if not found then
    raise exception 'Address does not belong to customer';
  end if;
  if v_zone_slug is null then
    raise exception 'Service area not supported';
  end if;

  select sc.id
  into v_category_id
  from public.service_categories sc
  where sc.slug = p_category_slug
    and sc.active;

  if v_category_id is null then
    raise exception 'Unknown service category %', p_category_slug;
  end if;

  select sit.id
  into v_issue_id
  from public.service_issue_types sit
  where sit.category_id = v_category_id
    and sit.slug = p_issue_slug
    and sit.active;

  if v_issue_id is null then
    raise exception 'Unknown issue type %', p_issue_slug;
  end if;

  select
    pr.base_price + pr.issue_adjustment,
    pr.priority_multiplier,
    pr.platform_fee_rate
  into v_base_price, v_priority_multiplier, v_platform_rate
  from public.pricing_rules pr
  where pr.category_id = v_category_id
    and pr.issue_type_id = v_issue_id
    and pr.zone_slug = v_zone_slug
    and pr.active
  limit 1;

  if v_base_price is null or v_base_price < 0 then
    raise exception 'Pricing configuration not found for zone %', v_zone_slug;
  end if;

  v_flexible_price := round(v_base_price, 2);
  v_priority_price := round(v_base_price * v_priority_multiplier, 2);

  insert into public.service_requests(
    customer_id,
    category_id,
    issue_type_id,
    status,
    time_since,
    address_id,
    preferred_date,
    preferred_time_window,
    urgency_level,
    submitted_at
  )
  values (
    p_customer_id,
    v_category_id,
    v_issue_id,
    'pending_payment',
    p_time_since,
    p_address_id,
    p_preferred_date,
    p_preferred_time_window,
    p_selected_option,
    now()
  )
  returning id into v_request_id;

  insert into public.diagnosis_reports(
    request_id,
    level,
    top_cause_code,
    top_cause_label,
    possible_causes,
    customer_summary,
    technician_summary,
    disclaimer
  )
  values (
    v_request_id,
    coalesce(p_diagnosis ->> 'level', 'medium'),
    coalesce(p_diagnosis -> 'topCause' ->> 'code', 'unknown'),
    coalesce(p_diagnosis -> 'topCause' ->> 'label', 'Diagnóstico preliminar'),
    coalesce(p_diagnosis -> 'causes', '[]'::jsonb),
    coalesce(p_diagnosis ->> 'customerSummary', 'Diagnóstico preliminar generado por Lysto.'),
    coalesce(p_diagnosis ->> 'technicianSummary', 'Revisar equipo en domicilio.'),
    coalesce(p_diagnosis ->> 'disclaimer', 'El diagnóstico final será confirmado por el técnico en el domicilio.')
  );

  insert into public.price_options(
    request_id, option_type, title, description, amount, platform_fee, professional_amount
  )
  values (
    v_request_id,
    'flexible',
    'Flexible',
    'Más económico. Franja horaria amplia, técnico verificado y garantía Lysto.',
    v_flexible_price,
    round(v_flexible_price * v_platform_rate, 2),
    round(v_flexible_price * (1 - v_platform_rate), 2)
  )
  returning id into v_flexible_id;

  insert into public.price_options(
    request_id, option_type, title, description, amount, platform_fee, professional_amount
  )
  values (
    v_request_id,
    'priority',
    'Prioridad',
    'Mayor prioridad de asignación, mejor SLA y seguimiento preferente.',
    v_priority_price,
    round(v_priority_price * v_platform_rate, 2),
    round(v_priority_price * (1 - v_platform_rate), 2)
  )
  returning id into v_priority_id;

  v_selected_id := case when p_selected_option = 'priority' then v_priority_id else v_flexible_id end;

  update public.price_options
  set selected = (id = v_selected_id)
  where request_id = v_request_id;

  update public.service_requests
  set selected_price_option_id = v_selected_id
  where id = v_request_id;

  return jsonb_build_object(
    'request_id', v_request_id,
    'selected_price_option_id', v_selected_id,
    'status', 'pending_payment'
  );
end;
$$;

create or replace function private.assign_professional_to_job(
  p_job_id uuid,
  p_request_id uuid,
  p_professional_id uuid,
  p_admin_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_actor_admin_id uuid := private.current_admin_profile_id();
begin
  if not private.has_admin_permission('operations') then
    raise exception 'Operations permission required';
  end if;

  if p_admin_profile_id is distinct from v_actor_admin_id then
    raise exception 'Admin actor mismatch';
  end if;

  select *
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.request_id = p_request_id
  for update;

  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.status <> 'pending_assignment' then
    raise exception 'Job is not pending assignment';
  end if;
  if not exists (
    select 1
    from public.professional_profiles pp
    where pp.id = p_professional_id
      and pp.status = 'approved'
  ) then
    raise exception 'Professional is not approved';
  end if;

  update public.jobs
  set professional_id = p_professional_id,
      status = 'pending_professional_acceptance'
  where id = p_job_id;

  update public.service_requests
  set status = 'pending_professional_acceptance'
  where id = p_request_id;

  perform private.append_admin_audit(
    'job.assigned',
    'job',
    p_job_id,
    jsonb_build_object('professional_id', p_professional_id)
  );

  return jsonb_build_object(
    'job_id', p_job_id,
    'professional_id', p_professional_id,
    'status', 'pending_professional_acceptance'
  );
end;
$$;

create or replace function private.professional_respond_to_job(
  p_job_id uuid,
  p_professional_id uuid,
  p_response text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_current_professional_id uuid := private.current_professional_id(true);
begin
  if v_current_professional_id is null
     or p_professional_id is distinct from v_current_professional_id then
    raise exception 'Only the approved assigned professional can respond';
  end if;

  select * into v_job
  from public.jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.professional_id is distinct from v_current_professional_id then
    raise exception 'Only the approved assigned professional can respond';
  end if;
  if v_job.status <> 'pending_professional_acceptance' then
    raise exception 'Job is not waiting professional acceptance';
  end if;

  if p_response = 'accepted' then
    update public.jobs
    set status = 'confirmed', accepted_at = now()
    where id = p_job_id;

    update public.service_requests
    set status = 'assigned'
    where id = v_job.request_id;

    return jsonb_build_object('job_id', p_job_id, 'status', 'confirmed');
  elsif p_response = 'rejected' then
    if length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'Rejection reason required';
    end if;

    update public.jobs
    set status = 'pending_assignment', professional_id = null
    where id = p_job_id;

    update public.service_requests
    set status = 'pending_assignment'
    where id = v_job.request_id;

    return jsonb_build_object('job_id', p_job_id, 'status', 'pending_assignment');
  end if;

  raise exception 'Invalid response';
end;
$$;

create or replace function private.close_job_with_final_report(
  p_job_id uuid,
  p_equipment_id uuid,
  p_real_diagnosis text,
  p_work_done text,
  p_parts_used text,
  p_final_state text,
  p_maintenance_option public.maintenance_option,
  p_next_maintenance_date date,
  p_warranty_days int,
  p_internal_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_report_id uuid;
  v_receipt_token uuid;
  v_current_professional_id uuid := private.current_professional_id(true);
  v_request_equipment_id uuid;
begin
  select * into v_job
  from public.jobs j
  where j.id = p_job_id
  for update;

  if v_current_professional_id is null
     or v_job.id is null
     or v_job.professional_id is distinct from v_current_professional_id then
    raise exception 'Only an approved assigned professional can close a job';
  end if;

  if v_job.status <> 'in_progress' then
    raise exception 'Job must be in progress to close';
  end if;
  if length(trim(p_real_diagnosis)) < 8 or length(trim(p_work_done)) < 8 then
    raise exception 'Final report is incomplete';
  end if;
  select sr.equipment_id
  into v_request_equipment_id
  from public.service_requests sr
  where sr.id = v_job.request_id;

  if v_request_equipment_id is null
     or p_equipment_id is distinct from v_request_equipment_id then
    raise exception 'Job equipment does not match its service request';
  end if;
  if not exists (
    select 1
    from public.customer_equipment ce
    where ce.id = p_equipment_id
      and ce.customer_id = v_job.customer_id
  ) then
    raise exception 'Equipment does not belong to job customer';
  end if;

  insert into public.job_final_reports(
    job_id,
    equipment_id,
    real_diagnosis,
    work_done,
    parts_used,
    final_state,
    maintenance_option,
    next_maintenance_date,
    warranty_days,
    internal_notes
  )
  values (
    p_job_id,
    p_equipment_id,
    p_real_diagnosis,
    p_work_done,
    p_parts_used,
    p_final_state,
    p_maintenance_option,
    p_next_maintenance_date,
    greatest(p_warranty_days, 0),
    p_internal_notes
  )
  returning id, public_token into v_report_id, v_receipt_token;

  insert into public.equipment_service_records(
    equipment_id,
    job_id,
    professional_id,
    reported_problem,
    real_diagnosis,
    work_done,
    parts_used,
    next_maintenance_option,
    next_maintenance_date,
    notes
  )
  values (
    p_equipment_id,
    p_job_id,
    v_job.professional_id,
    null,
    p_real_diagnosis,
    p_work_done,
    p_parts_used,
    p_maintenance_option,
    p_next_maintenance_date,
    p_internal_notes
  );

  insert into public.receipts(job_id, final_report_id, public_token)
  values (p_job_id, v_report_id, v_receipt_token)
  on conflict (job_id) do nothing;

  update public.jobs
  set status = 'completed_pending_customer_confirmation',
      completed_at = now(),
      warranty_until = case
        when p_warranty_days > 0 then current_date + p_warranty_days
        else null
      end
  where id = p_job_id;

  return jsonb_build_object(
    'job_id', p_job_id,
    'final_report_id', v_report_id,
    'status', 'completed_pending_customer_confirmation'
  );
end;
$$;

create or replace function private.submit_customer_review_transaction(
  p_job_id uuid,
  p_customer_id uuid,
  p_service_rating int,
  p_professional_rating int,
  p_problem_resolved boolean,
  p_would_hire_again boolean,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_review_id uuid;
begin
  select * into v_job
  from public.jobs j
  where j.id = p_job_id
  for update;

  if private.current_app_role() <> 'customer'
     or p_customer_id is distinct from private.current_customer_id()
     or v_job.id is null
     or v_job.customer_id is distinct from p_customer_id then
    raise exception 'Only the owning customer can review this job';
  end if;

  if v_job.status not in ('completed', 'completed_pending_customer_confirmation') then
    raise exception 'Job is not complete';
  end if;
  if p_service_rating not between 1 and 5
     or p_professional_rating not between 1 and 5 then
    raise exception 'Invalid rating';
  end if;

  insert into public.reviews(
    job_id,
    customer_id,
    professional_id,
    service_rating,
    professional_rating,
    problem_resolved,
    would_hire_again,
    comment
  )
  values (
    p_job_id,
    p_customer_id,
    v_job.professional_id,
    p_service_rating,
    p_professional_rating,
    p_problem_resolved,
    p_would_hire_again,
    p_comment
  )
  returning id into v_review_id;

  update public.jobs set status = 'completed' where id = p_job_id;

  update public.professional_profiles pp
  set rating_avg = agg.avg_rating,
      jobs_completed = agg.jobs_completed
  from (
    select
      r.professional_id,
      round(avg(r.professional_rating)::numeric, 2) as avg_rating,
      count(*)::int as jobs_completed
    from public.reviews r
    where r.professional_id = v_job.professional_id
    group by r.professional_id
  ) agg
  where pp.id = agg.professional_id;

  if p_service_rating <= 2
     or p_professional_rating <= 2
     or p_problem_resolved = false then
    insert into public.complaints(job_id, customer_id, professional_id, severity, description)
    values (
      p_job_id,
      p_customer_id,
      v_job.professional_id,
      'high',
      coalesce(p_comment, 'Review baja o problema no resuelto')
    );
  end if;

  return jsonb_build_object('review_id', v_review_id, 'job_id', p_job_id, 'status', 'completed');
end;
$$;

drop trigger if exists jobs_status_event_insert on public.jobs;
drop trigger if exists jobs_status_event_update on public.jobs;
drop function if exists public.create_job_status_event();

create trigger jobs_status_event_insert
after insert on public.jobs
for each row execute function private.create_job_status_event();

create trigger jobs_status_event_update
after update of status on public.jobs
for each row execute function private.create_job_status_event();

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security invoker
set search_path = ''
as $$ select private.current_app_role(); $$;

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$ select private.current_profile_id(); $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.has_any_admin_permission(); $$;

create or replace function public.current_customer_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$ select private.current_customer_id(); $$;

create or replace function public.current_professional_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$ select private.current_professional_id(false); $$;

create or replace function public.log_admin_action(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.append_admin_audit(p_action, p_entity_type, p_entity_id, p_metadata);
$$;

create or replace function public.create_admin_audit_event(
  action text,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}'::jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.append_admin_audit(action, entity_type, entity_id, metadata);
$$;

-- Legacy public RPC signatures are retained for existing application clients. Each wrapper is
-- SECURITY INVOKER and delegates to a private, actor-validating implementation with explicit ACL.
create or replace function public.create_service_request_from_app(
  p_customer_id uuid,
  p_address_id uuid,
  p_category_slug text,
  p_issue_slug text,
  p_time_since text,
  p_preferred_date date,
  p_preferred_time_window text,
  p_selected_option public.urgency_level,
  p_diagnosis jsonb,
  p_flexible_price numeric,
  p_priority_price numeric,
  p_selected_amount numeric
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_service_request_from_app(
    p_customer_id,
    p_address_id,
    p_category_slug,
    p_issue_slug,
    p_time_since,
    p_preferred_date,
    p_preferred_time_window,
    p_selected_option,
    p_diagnosis,
    p_flexible_price,
    p_priority_price,
    p_selected_amount
  );
$$;

create or replace function public.apply_mercadopago_payment_webhook(
  p_provider_event_id text,
  p_provider_payment_id text,
  p_provider_status text,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Preserve the legacy signature while keeping every unverified input inert.
  perform p_provider_event_id, p_provider_payment_id, p_provider_status, p_raw_payload;
  raise exception 'Payment webhook disabled until canonical verification is implemented';
end;
$$;

create or replace function public.assign_professional_to_job(
  p_job_id uuid,
  p_request_id uuid,
  p_professional_id uuid,
  p_admin_profile_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.assign_professional_to_job(
    p_job_id,
    p_request_id,
    p_professional_id,
    p_admin_profile_id
  );
$$;

create or replace function public.professional_respond_to_job(
  p_job_id uuid,
  p_professional_id uuid,
  p_response text,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.professional_respond_to_job(
    p_job_id,
    p_professional_id,
    p_response,
    p_reason
  );
$$;

create or replace function public.close_job_with_final_report(
  p_job_id uuid,
  p_equipment_id uuid,
  p_real_diagnosis text,
  p_work_done text,
  p_parts_used text,
  p_final_state text,
  p_maintenance_option public.maintenance_option,
  p_next_maintenance_date date,
  p_warranty_days int,
  p_internal_notes text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.close_job_with_final_report(
    p_job_id,
    p_equipment_id,
    p_real_diagnosis,
    p_work_done,
    p_parts_used,
    p_final_state,
    p_maintenance_option,
    p_next_maintenance_date,
    p_warranty_days,
    p_internal_notes
  );
$$;

create or replace function public.submit_customer_review_transaction(
  p_job_id uuid,
  p_customer_id uuid,
  p_service_rating int,
  p_professional_rating int,
  p_problem_resolved boolean,
  p_would_hire_again boolean,
  p_comment text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.submit_customer_review_transaction(
    p_job_id,
    p_customer_id,
    p_service_rating,
    p_professional_rating,
    p_problem_resolved,
    p_would_hire_again,
    p_comment
  );
$$;

create or replace function public.set_admin_permissions(
  p_admin_profile_id uuid,
  p_permissions public.admin_permission[]
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.set_admin_permissions(p_admin_profile_id, p_permissions);
$$;

create or replace function public.request_payment_refund(
  p_payment_id uuid,
  p_amount numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.request_payment_refund(
    p_payment_id,
    p_amount,
    p_reason,
    p_idempotency_key
  );
$$;

comment on function public.request_payment_refund(uuid, numeric, text, text) is
  'Finance/Owner initiation only. Persists an idempotent audited request without changing payments.status; provider execution belongs to Task 18.';

create or replace function public.claim_payment_refund_requests(
  p_batch_size integer default 10,
  p_lease_seconds integer default 300
)
returns table (
  request_id uuid,
  payment_id uuid,
  amount numeric,
  currency text,
  reason text,
  provider_payment_id text,
  provider_idempotency_key text,
  claim_token uuid,
  attempt_count integer,
  locked_until timestamptz,
  status text
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.claim_payment_refund_requests(p_batch_size, p_lease_seconds);
$$;

create or replace function public.finalize_payment_refund_request(
  p_request_id uuid,
  p_claim_token uuid,
  p_provider_reference text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.finalize_payment_refund_request(
    p_request_id,
    p_claim_token,
    p_provider_reference
  );
$$;

create or replace function public.fail_payment_refund_request(
  p_request_id uuid,
  p_claim_token uuid,
  p_failure_reason text,
  p_is_definitive boolean,
  p_retry_seconds integer default 60
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.fail_payment_refund_request(
    p_request_id,
    p_claim_token,
    p_failure_reason,
    p_is_definitive,
    p_retry_seconds
  );
$$;

comment on function public.claim_payment_refund_requests(integer, integer) is
  'Task 18 service-role worker claim with bounded SKIP LOCKED batch and expiring fence. The worker must pass provider_idempotency_key (the stable refund request UUID) to Mercado Pago on every attempt.';
comment on function public.finalize_payment_refund_request(uuid, uuid, text) is
  'Task 18 service-role success callback; requires an active claim and canonical provider refund reference.';
comment on function public.fail_payment_refund_request(uuid, uuid, text, boolean, integer) is
  'Task 18 service-role failure callback; definitive failures become terminal, while ambiguous outcomes rotate the fence and retain the reservation for an idempotent provider retry.';

create or replace function public.lookup_public_receipt(p_token uuid)
returns table (
  service_name text,
  professional_name text,
  work_done text,
  warranty_days integer,
  next_maintenance_date date,
  issued_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.lookup_public_receipt(p_token);
$$;

create or replace view public.public_receipt_view
with (security_invoker = true)
as
select
  r.public_token,
  j.id as job_id,
  j.status as job_status,
  j.scheduled_date,
  j.scheduled_time_window,
  fr.real_diagnosis,
  fr.work_done,
  fr.final_state,
  fr.maintenance_option,
  fr.next_maintenance_date,
  fr.warranty_days,
  ce.nickname as equipment_nickname,
  ce.brand as equipment_brand,
  ce.model as equipment_model,
  ce.equipment_type,
  p.first_name as professional_first_name,
  p.last_name as professional_last_name,
  r.created_at
from public.receipts r
join public.jobs j on j.id = r.job_id
join public.job_final_reports fr on fr.id = r.final_report_id
left join public.customer_equipment ce on ce.id = fr.equipment_id
left join public.professional_profiles pp on pp.id = j.professional_id
left join public.profiles p on p.id = pp.profile_id
where r.revoked_at is null
  and r.expires_at > now();

do $$
declare
  policy_record record;
  table_record record;
begin
  for table_record in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', table_record.relname);
  end loop;

  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

-- Public catalogue rows are intentionally limited to active configuration.
create policy service_categories_active_read
on public.service_categories for select to anon, authenticated
using (active);
create policy service_categories_operations_read
on public.service_categories for select to authenticated
using ((select private.has_admin_permission('operations')));
create policy service_categories_operations_insert
on public.service_categories for insert to authenticated
with check ((select private.has_admin_permission('operations')));
create policy service_categories_operations_update
on public.service_categories for update to authenticated
using ((select private.has_admin_permission('operations')))
with check ((select private.has_admin_permission('operations')));
create policy service_categories_operations_delete
on public.service_categories for delete to authenticated
using ((select private.has_admin_permission('operations')));

create policy service_issue_types_active_read
on public.service_issue_types for select to anon, authenticated
using (active);
create policy service_issue_types_operations_read
on public.service_issue_types for select to authenticated
using ((select private.has_admin_permission('operations')));
create policy service_issue_types_operations_insert
on public.service_issue_types for insert to authenticated
with check ((select private.has_admin_permission('operations')));
create policy service_issue_types_operations_update
on public.service_issue_types for update to authenticated
using ((select private.has_admin_permission('operations')))
with check ((select private.has_admin_permission('operations')));
create policy service_issue_types_operations_delete
on public.service_issue_types for delete to authenticated
using ((select private.has_admin_permission('operations')));

create policy service_questions_active_read
on public.service_questions for select to anon, authenticated
using (active);
create policy service_questions_operations_read
on public.service_questions for select to authenticated
using ((select private.has_admin_permission('operations')));
create policy service_questions_operations_insert
on public.service_questions for insert to authenticated
with check ((select private.has_admin_permission('operations')));
create policy service_questions_operations_update
on public.service_questions for update to authenticated
using ((select private.has_admin_permission('operations')))
with check ((select private.has_admin_permission('operations')));
create policy service_questions_operations_delete
on public.service_questions for delete to authenticated
using ((select private.has_admin_permission('operations')));

create policy service_question_options_active_read
on public.service_question_options for select to anon, authenticated
using (
  exists (
    select 1 from public.service_questions sq
    where sq.id = question_id and sq.active
  )
);
create policy service_question_options_operations_read
on public.service_question_options for select to authenticated
using ((select private.has_admin_permission('operations')));
create policy service_question_options_operations_insert
on public.service_question_options for insert to authenticated
with check ((select private.has_admin_permission('operations')));
create policy service_question_options_operations_update
on public.service_question_options for update to authenticated
using ((select private.has_admin_permission('operations')))
with check ((select private.has_admin_permission('operations')));
create policy service_question_options_operations_delete
on public.service_question_options for delete to authenticated
using ((select private.has_admin_permission('operations')));

create policy diagnosis_rules_active_read
on public.diagnosis_rules for select to anon, authenticated
using (active);
create policy diagnosis_rules_operations_read
on public.diagnosis_rules for select to authenticated
using ((select private.has_admin_permission('operations')));
create policy diagnosis_rules_operations_insert
on public.diagnosis_rules for insert to authenticated
with check ((select private.has_admin_permission('operations')));
create policy diagnosis_rules_operations_update
on public.diagnosis_rules for update to authenticated
using ((select private.has_admin_permission('operations')))
with check ((select private.has_admin_permission('operations')));
create policy diagnosis_rules_operations_delete
on public.diagnosis_rules for delete to authenticated
using ((select private.has_admin_permission('operations')));

create policy service_zones_active_read
on public.service_zones for select to anon, authenticated
using (active);
create policy service_zones_operations_read
on public.service_zones for select to authenticated
using ((select private.has_admin_permission('operations')));
create policy service_zones_operations_insert
on public.service_zones for insert to authenticated
with check ((select private.has_admin_permission('operations')));
create policy service_zones_operations_update
on public.service_zones for update to authenticated
using ((select private.has_admin_permission('operations')))
with check ((select private.has_admin_permission('operations')));
create policy service_zones_operations_delete
on public.service_zones for delete to authenticated
using ((select private.has_admin_permission('operations')));

create policy training_modules_active_read
on public.professional_training_modules for select to anon, authenticated
using (active);
create policy training_modules_operations_read
on public.professional_training_modules for select to authenticated
using ((select private.has_admin_permission('operations')));
create policy training_modules_operations_insert
on public.professional_training_modules for insert to authenticated
with check ((select private.has_admin_permission('operations')));
create policy training_modules_operations_update
on public.professional_training_modules for update to authenticated
using ((select private.has_admin_permission('operations')))
with check ((select private.has_admin_permission('operations')));
create policy training_modules_operations_delete
on public.professional_training_modules for delete to authenticated
using ((select private.has_admin_permission('operations')));

-- Identity and role-bearing records.
create policy profiles_self_read
on public.profiles for select to authenticated
using (
  auth_user_id = (select auth.uid())
  or (select private.has_admin_permission('operations'))
);
create policy profiles_self_update
on public.profiles for update to authenticated
using (
  auth_user_id = (select auth.uid())
  and (select private.current_profile_id()) = profiles.id
)
with check (
  auth_user_id = (select auth.uid())
  and (select private.current_profile_id()) = profiles.id
);
create policy profiles_operations_update
on public.profiles for update to authenticated
using ((select private.has_admin_permission('operations')))
with check ((select private.has_admin_permission('operations')));

create policy customer_profiles_self_read
on public.customer_profiles for select to authenticated
using (
  id = (select private.current_customer_id())
  or (select private.has_admin_permission('operations'))
);

create policy admin_profiles_self_read
on public.admin_profiles for select to authenticated
using (
  id = (select private.current_admin_profile_id())
  or (select private.has_admin_permission('owner'))
);

create policy professional_profiles_self_read
on public.professional_profiles for select to authenticated
using (
  id = (select private.current_professional_id(false))
  or (select private.has_admin_permission('operations'))
);
create policy professional_profiles_operations_update
on public.professional_profiles for update to authenticated
using ((select private.has_admin_permission('operations')))
with check ((select private.has_admin_permission('operations')));

create policy professional_invitations_operations_read
on public.professional_invitations for select to authenticated
using ((select private.has_admin_permission('operations')));
create policy professional_invitations_operations_insert
on public.professional_invitations for insert to authenticated
with check ((select private.has_admin_permission('operations')));
create policy professional_invitations_operations_update
on public.professional_invitations for update to authenticated
using ((select private.has_admin_permission('operations')))
with check ((select private.has_admin_permission('operations')));
create policy professional_invitations_operations_delete
on public.professional_invitations for delete to authenticated
using ((select private.has_admin_permission('operations')));

create policy customer_addresses_owner_read
on public.customer_addresses for select to authenticated
using (customer_id = (select private.current_customer_id()));
create policy customer_addresses_operations_read
on public.customer_addresses for select to authenticated
using ((select private.has_admin_permission('operations')));
create policy customer_addresses_professional_assigned_read
on public.customer_addresses for select to authenticated
using (
  exists (
    select 1
    from public.service_requests sr
    join public.jobs j on j.request_id = sr.id
    where sr.address_id = customer_addresses.id
      and j.professional_id = (select private.current_professional_id(true))
  )
);
create policy customer_addresses_owner_insert
on public.customer_addresses for insert to authenticated
with check (customer_id = (select private.current_customer_id()));
create policy customer_addresses_owner_update
on public.customer_addresses for update to authenticated
using (customer_id = (select private.current_customer_id()))
with check (customer_id = (select private.current_customer_id()));
create policy customer_addresses_owner_delete
on public.customer_addresses for delete to authenticated
using (customer_id = (select private.current_customer_id()));

-- Request data. Approved assigned professionals see only the address required for their job.
create policy service_requests_customer_read
on public.service_requests for select to authenticated
using (customer_id = (select private.current_customer_id()));
create policy service_requests_professional_read
on public.service_requests for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.request_id = service_requests.id
      and j.professional_id = (select private.current_professional_id(true))
  )
);
create policy service_requests_admin_read
on public.service_requests for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('quality'))
  or (select private.has_admin_permission('finance'))
);
create policy service_requests_customer_link_equipment
on public.service_requests for update to authenticated
using (
  customer_id = (select private.current_customer_id())
  and status in (
    'draft',
    'diagnosis_completed',
    'address_completed',
    'schedule_completed',
    'price_selected',
    'pending_payment',
    'payment_approved',
    'matching',
    'pending_assignment'
  )
)
with check (
  customer_id = (select private.current_customer_id())
  and status in (
    'draft',
    'diagnosis_completed',
    'address_completed',
    'schedule_completed',
    'price_selected',
    'pending_payment',
    'payment_approved',
    'matching',
    'pending_assignment'
  )
);

create policy request_answers_customer_read
on public.request_answers for select to authenticated
using (
  exists (
    select 1 from public.service_requests sr
    where sr.id = request_answers.request_id
      and sr.customer_id = (select private.current_customer_id())
  )
);
create policy request_answers_professional_read
on public.request_answers for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.request_id = request_answers.request_id
      and j.professional_id = (select private.current_professional_id(true))
  )
);
create policy request_answers_admin_read
on public.request_answers for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('quality'))
);

create policy request_media_customer_read
on public.request_media for select to authenticated
using (
  exists (
    select 1 from public.service_requests sr
    where sr.id = request_media.request_id
      and sr.customer_id = (select private.current_customer_id())
  )
);
create policy request_media_professional_read
on public.request_media for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.request_id = request_media.request_id
      and j.professional_id = (select private.current_professional_id(true))
  )
);
create policy request_media_admin_read
on public.request_media for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('quality'))
);
create policy request_media_customer_insert
on public.request_media for insert to authenticated
with check (
  uploaded_by = (select private.current_profile_id())
  and exists (
    select 1 from public.service_requests sr
    where sr.id = request_media.request_id
      and sr.customer_id = (select private.current_customer_id())
  )
);
create policy diagnosis_reports_customer_read
on public.diagnosis_reports for select to authenticated
using (
  exists (
    select 1 from public.service_requests sr
    where sr.id = diagnosis_reports.request_id
      and sr.customer_id = (select private.current_customer_id())
  )
);
create policy diagnosis_reports_professional_read
on public.diagnosis_reports for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.request_id = diagnosis_reports.request_id
      and j.professional_id = (select private.current_professional_id(true))
  )
);
create policy diagnosis_reports_admin_read
on public.diagnosis_reports for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('quality'))
);

create policy price_options_customer_read
on public.price_options for select to authenticated
using (
  exists (
    select 1 from public.service_requests sr
    where sr.id = price_options.request_id
      and sr.customer_id = (select private.current_customer_id())
  )
);
create policy price_options_professional_read
on public.price_options for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.request_id = price_options.request_id
      and j.professional_id = (select private.current_professional_id(true))
  )
);
create policy price_options_admin_read
on public.price_options for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('finance'))
);

-- Professional-owned onboarding metadata.
create policy professional_documents_owner_read
on public.professional_documents for select to authenticated
using (professional_id = (select private.current_professional_id(false)));
create policy professional_documents_operations_read
on public.professional_documents for select to authenticated
using ((select private.has_admin_permission('operations')));
create policy professional_documents_owner_insert
on public.professional_documents for insert to authenticated
with check (
  professional_id = (select private.current_professional_id(false))
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);
create policy professional_documents_operations_update
on public.professional_documents for update to authenticated
using ((select private.has_admin_permission('operations')))
with check ((select private.has_admin_permission('operations')));

create policy professional_tools_owner_read
on public.professional_tools for select to authenticated
using (professional_id = (select private.current_professional_id(false)));
create policy professional_tools_operations_read
on public.professional_tools for select to authenticated
using ((select private.has_admin_permission('operations')));

create policy professional_service_categories_owner_read
on public.professional_service_categories for select to authenticated
using (professional_id = (select private.current_professional_id(false)));
create policy professional_service_categories_operations_read
on public.professional_service_categories for select to authenticated
using ((select private.has_admin_permission('operations')));

create policy professional_service_zones_owner_read
on public.professional_service_zones for select to authenticated
using (professional_id = (select private.current_professional_id(false)));
create policy professional_service_zones_operations_read
on public.professional_service_zones for select to authenticated
using ((select private.has_admin_permission('operations')));

create policy professional_availability_owner_read
on public.professional_availability for select to authenticated
using (professional_id = (select private.current_professional_id(false)));
create policy professional_availability_operations_read
on public.professional_availability for select to authenticated
using ((select private.has_admin_permission('operations')));

create policy professional_training_completions_owner_read
on public.professional_training_completions for select to authenticated
using (professional_id = (select private.current_professional_id(false)));
create policy professional_training_completions_operations_read
on public.professional_training_completions for select to authenticated
using ((select private.has_admin_permission('operations')));

create policy professional_payment_accounts_owner_read
on public.professional_payment_accounts for select to authenticated
using (professional_id = (select private.current_professional_id(false)));
create policy professional_payment_accounts_finance_read
on public.professional_payment_accounts for select to authenticated
using ((select private.has_admin_permission('finance')));

-- Jobs and work evidence are participant-scoped; all state transitions happen through hardened RPCs.
create policy jobs_customer_read
on public.jobs for select to authenticated
using (customer_id = (select private.current_customer_id()));
create policy jobs_professional_read
on public.jobs for select to authenticated
using (professional_id = (select private.current_professional_id(true)));
create policy jobs_admin_read
on public.jobs for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('quality'))
  or (select private.has_admin_permission('finance'))
);

create policy job_status_events_participant_read
on public.job_status_events for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_status_events.job_id
      and (
        j.customer_id = (select private.current_customer_id())
        or j.professional_id = (select private.current_professional_id(true))
      )
  )
);
create policy job_status_events_admin_read
on public.job_status_events for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('quality'))
);

create policy job_media_participant_read
on public.job_media for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_media.job_id
      and (
        j.customer_id = (select private.current_customer_id())
        or j.professional_id = (select private.current_professional_id(true))
      )
  )
);
create policy job_media_admin_read
on public.job_media for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('quality'))
);
create policy job_media_professional_insert
on public.job_media for insert to authenticated
with check (
  uploaded_by = (select private.current_profile_id())
  and exists (
    select 1 from public.jobs j
    where j.id = job_media.job_id
      and j.professional_id = (select private.current_professional_id(true))
  )
);
create policy customer_equipment_owner_read
on public.customer_equipment for select to authenticated
using (customer_id = (select private.current_customer_id()));
create policy customer_equipment_admin_read
on public.customer_equipment for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('quality'))
);
create policy customer_equipment_professional_assigned_read
on public.customer_equipment for select to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.service_requests sr on sr.id = j.request_id
    where sr.equipment_id = customer_equipment.id
      and j.professional_id = (select private.current_professional_id(true))
  )
);
create policy customer_equipment_owner_insert
on public.customer_equipment for insert to authenticated
with check (customer_id = (select private.current_customer_id()));
create policy customer_equipment_owner_update
on public.customer_equipment for update to authenticated
using (customer_id = (select private.current_customer_id()))
with check (customer_id = (select private.current_customer_id()));
create policy customer_equipment_owner_delete
on public.customer_equipment for delete to authenticated
using (customer_id = (select private.current_customer_id()));

create policy final_reports_participant_read
on public.job_final_reports for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_final_reports.job_id
      and (
        j.customer_id = (select private.current_customer_id())
        or j.professional_id = (select private.current_professional_id(true))
      )
  )
);
create policy final_reports_admin_read
on public.job_final_reports for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('quality'))
);

create policy equipment_service_records_customer_read
on public.equipment_service_records for select to authenticated
using (
  exists (
    select 1 from public.customer_equipment ce
    where ce.id = equipment_service_records.equipment_id
      and ce.customer_id = (select private.current_customer_id())
  )
);
create policy equipment_service_records_professional_read
on public.equipment_service_records for select to authenticated
using (professional_id = (select private.current_professional_id(true)));
create policy equipment_service_records_admin_read
on public.equipment_service_records for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('quality'))
);

-- Finance can reconcile, manage pricing and create durable refund requests in 005. Direct
-- payment mutation stays forbidden until Task 18 confirms the provider outcome server-side.
create policy payments_customer_read
on public.payments for select to authenticated
using (customer_id = (select private.current_customer_id()));
create policy payments_professional_read
on public.payments for select to authenticated
using (professional_id = (select private.current_professional_id(true)));
create policy payments_finance_read
on public.payments for select to authenticated
using ((select private.has_admin_permission('finance')));

create policy payment_events_finance_read
on public.payment_events for select to authenticated
using ((select private.has_admin_permission('finance')));

create policy payout_records_professional_read
on public.payout_records for select to authenticated
using (professional_id = (select private.current_professional_id(true)));
create policy payout_records_finance_read
on public.payout_records for select to authenticated
using ((select private.has_admin_permission('finance')));

create policy pricing_rules_finance_read
on public.pricing_rules for select to authenticated
using ((select private.has_admin_permission('finance')));
create policy pricing_rules_finance_insert
on public.pricing_rules for insert to authenticated
with check ((select private.has_admin_permission('finance')));
create policy pricing_rules_finance_update
on public.pricing_rules for update to authenticated
using ((select private.has_admin_permission('finance')))
with check ((select private.has_admin_permission('finance')));
create policy pricing_rules_finance_delete
on public.pricing_rules for delete to authenticated
using ((select private.has_admin_permission('finance')));

create policy platform_settings_finance_read
on public.platform_settings for select to authenticated
using (
  (select private.has_admin_permission('finance'))
  and (
    key in ('marketplace', 'platform_fee_rate')
    or key like 'pricing.%'
    or key like 'payments.%'
  )
);
create policy platform_settings_finance_insert
on public.platform_settings for insert to authenticated
with check (
  (select private.has_admin_permission('finance'))
  and (
    key in ('marketplace', 'platform_fee_rate')
    or key like 'pricing.%'
    or key like 'payments.%'
  )
);
create policy platform_settings_finance_update
on public.platform_settings for update to authenticated
using (
  (select private.has_admin_permission('finance'))
  and (
    key in ('marketplace', 'platform_fee_rate')
    or key like 'pricing.%'
    or key like 'payments.%'
  )
)
with check (
  (select private.has_admin_permission('finance'))
  and (
    key in ('marketplace', 'platform_fee_rate')
    or key like 'pricing.%'
    or key like 'payments.%'
  )
);
create policy platform_settings_finance_delete
on public.platform_settings for delete to authenticated
using (
  (select private.has_admin_permission('finance'))
  and (
    key in ('marketplace', 'platform_fee_rate')
    or key like 'pricing.%'
    or key like 'payments.%'
  )
);

create policy platform_settings_operations_read
on public.platform_settings for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  and (key like 'operations.%' or key like 'scheduling.%' or key like 'notifications.%')
);
create policy platform_settings_operations_insert
on public.platform_settings for insert to authenticated
with check (
  (select private.has_admin_permission('operations'))
  and (key like 'operations.%' or key like 'scheduling.%' or key like 'notifications.%')
);
create policy platform_settings_operations_update
on public.platform_settings for update to authenticated
using (
  (select private.has_admin_permission('operations'))
  and (key like 'operations.%' or key like 'scheduling.%' or key like 'notifications.%')
)
with check (
  (select private.has_admin_permission('operations'))
  and (key like 'operations.%' or key like 'scheduling.%' or key like 'notifications.%')
);
create policy platform_settings_operations_delete
on public.platform_settings for delete to authenticated
using (
  (select private.has_admin_permission('operations'))
  and (key like 'operations.%' or key like 'scheduling.%' or key like 'notifications.%')
);

create policy platform_settings_quality_read
on public.platform_settings for select to authenticated
using (
  (select private.has_admin_permission('quality'))
  and key like 'quality.%'
);
create policy platform_settings_quality_insert
on public.platform_settings for insert to authenticated
with check (
  (select private.has_admin_permission('quality'))
  and key like 'quality.%'
);
create policy platform_settings_quality_update
on public.platform_settings for update to authenticated
using (
  (select private.has_admin_permission('quality'))
  and key like 'quality.%'
)
with check (
  (select private.has_admin_permission('quality'))
  and key like 'quality.%'
);
create policy platform_settings_quality_delete
on public.platform_settings for delete to authenticated
using (
  (select private.has_admin_permission('quality'))
  and key like 'quality.%'
);

create policy platform_settings_owner_read
on public.platform_settings for select to authenticated
using ((select private.has_admin_permission('owner')));
create policy platform_settings_owner_insert
on public.platform_settings for insert to authenticated
with check ((select private.has_admin_permission('owner')));
create policy platform_settings_owner_update
on public.platform_settings for update to authenticated
using ((select private.has_admin_permission('owner')))
with check ((select private.has_admin_permission('owner')));
create policy platform_settings_owner_delete
on public.platform_settings for delete to authenticated
using ((select private.has_admin_permission('owner')));

-- Quality workflows.
create policy reviews_customer_read
on public.reviews for select to authenticated
using (customer_id = (select private.current_customer_id()));
create policy reviews_professional_read
on public.reviews for select to authenticated
using (professional_id = (select private.current_professional_id(true)));
create policy reviews_quality_read
on public.reviews for select to authenticated
using ((select private.has_admin_permission('quality')));

create policy complaints_customer_read
on public.complaints for select to authenticated
using (customer_id = (select private.current_customer_id()));
create policy complaints_professional_read
on public.complaints for select to authenticated
using (professional_id = (select private.current_professional_id(true)));
create policy complaints_quality_read
on public.complaints for select to authenticated
using ((select private.has_admin_permission('quality')));
create policy complaints_quality_update
on public.complaints for update to authenticated
using ((select private.has_admin_permission('quality')))
with check ((select private.has_admin_permission('quality')));

create policy warranty_claims_customer_read
on public.warranty_claims for select to authenticated
using (customer_id = (select private.current_customer_id()));
create policy warranty_claims_professional_read
on public.warranty_claims for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = warranty_claims.job_id
      and j.professional_id = (select private.current_professional_id(true))
  )
);
create policy warranty_claims_quality_read
on public.warranty_claims for select to authenticated
using ((select private.has_admin_permission('quality')));
create policy warranty_claims_quality_update
on public.warranty_claims for update to authenticated
using ((select private.has_admin_permission('quality')))
with check ((select private.has_admin_permission('quality')));

create policy quality_events_professional_read
on public.quality_events for select to authenticated
using (professional_id = (select private.current_professional_id(false)));
create policy quality_events_quality_read
on public.quality_events for select to authenticated
using ((select private.has_admin_permission('quality')));
create policy quality_events_quality_insert
on public.quality_events for insert to authenticated
with check (
  (select private.has_admin_permission('quality'))
  and created_by = (select private.current_profile_id())
);

-- Notifications are readable only by their recipient; operations can inspect delivery state.
create policy notification_events_recipient_read
on public.notification_events for select to authenticated
using (recipient_profile_id = (select private.current_profile_id()));
create policy notification_events_operations_read
on public.notification_events for select to authenticated
using ((select private.has_admin_permission('operations')));

create policy notifications_recipient_read
on public.notifications for select to authenticated
using (profile_id = (select private.current_profile_id()));
create policy notifications_recipient_update
on public.notifications for update to authenticated
using (profile_id = (select private.current_profile_id()))
with check (profile_id = (select private.current_profile_id()));
create policy notifications_operations_read
on public.notifications for select to authenticated
using ((select private.has_admin_permission('operations')));

-- Canonical receipts remain participant-only at the table layer. Public lookup is server-only.
create policy receipts_participant_read
on public.receipts for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = receipts.job_id
      and (
        j.customer_id = (select private.current_customer_id())
        or j.professional_id = (select private.current_professional_id(true))
      )
  )
);
create policy receipts_admin_read
on public.receipts for select to authenticated
using (
  (select private.has_admin_permission('operations'))
  or (select private.has_admin_permission('quality'))
);

create policy admin_audit_logs_admin_read
on public.admin_audit_logs for select to authenticated
using ((select private.has_any_admin_permission()));

-- Remove implicit API privileges before granting the narrow operation set below.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated, service_role;
revoke all on all tables in schema private from public, anon, authenticated, service_role;
revoke all on all sequences in schema private from public, anon, authenticated, service_role;
revoke all on all functions in schema private from public, anon, authenticated, service_role;
revoke all on schema private from public, anon, authenticated, service_role;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema private revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema private revoke all on sequences from public, anon, authenticated, service_role;

grant usage on schema private to authenticated, service_role;

grant execute on function private.current_app_role() to authenticated;
grant execute on function private.current_profile_id() to authenticated;
grant execute on function private.current_customer_id() to authenticated;
grant execute on function private.current_professional_id(boolean) to authenticated;
grant execute on function private.current_admin_profile_id() to authenticated;
grant execute on function private.has_admin_permission(public.admin_permission) to authenticated;
grant execute on function private.has_any_admin_permission() to authenticated;

grant execute on function public.create_service_request_from_app(
  uuid, uuid, text, text, text, date, text, public.urgency_level, jsonb, numeric, numeric, numeric
) to authenticated;
grant execute on function private.create_service_request_from_app(
  uuid, uuid, text, text, text, date, text, public.urgency_level, jsonb, numeric, numeric, numeric
) to authenticated;

grant execute on function public.assign_professional_to_job(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function private.assign_professional_to_job(uuid, uuid, uuid, uuid) to authenticated;

grant execute on function public.professional_respond_to_job(uuid, uuid, text, text) to authenticated;
grant execute on function private.professional_respond_to_job(uuid, uuid, text, text) to authenticated;

grant execute on function public.close_job_with_final_report(
  uuid, uuid, text, text, text, text, public.maintenance_option, date, integer, text
) to authenticated;
grant execute on function private.close_job_with_final_report(
  uuid, uuid, text, text, text, text, public.maintenance_option, date, integer, text
) to authenticated;

grant execute on function public.submit_customer_review_transaction(
  uuid, uuid, integer, integer, boolean, boolean, text
) to authenticated;
grant execute on function private.submit_customer_review_transaction(
  uuid, uuid, integer, integer, boolean, boolean, text
) to authenticated;

grant execute on function public.set_admin_permissions(uuid, public.admin_permission[])
to authenticated, service_role;
grant execute on function private.set_admin_permissions(uuid, public.admin_permission[])
to authenticated, service_role;

grant execute on function public.request_payment_refund(uuid, numeric, text, text)
to authenticated;
grant execute on function private.request_payment_refund(uuid, numeric, text, text)
to authenticated;

grant execute on function public.lookup_public_receipt(uuid) to service_role;
grant execute on function private.lookup_public_receipt(uuid) to service_role;

grant execute on function public.claim_payment_refund_requests(integer, integer)
to service_role;
grant execute on function private.claim_payment_refund_requests(integer, integer)
to service_role;
grant execute on function public.finalize_payment_refund_request(uuid, uuid, text)
to service_role;
grant execute on function private.finalize_payment_refund_request(uuid, uuid, text)
to service_role;
grant execute on function public.fail_payment_refund_request(uuid, uuid, text, boolean, integer)
to service_role;
grant execute on function private.fail_payment_refund_request(uuid, uuid, text, boolean, integer)
to service_role;

revoke execute on function public.apply_mercadopago_payment_webhook(text, text, text, jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.log_admin_action(text, text, uuid, jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.create_admin_audit_event(text, text, uuid, jsonb)
from public, anon, authenticated, service_role;
revoke execute on function public.current_user_role() from public, anon, authenticated, service_role;
revoke execute on function public.current_profile_id() from public, anon, authenticated, service_role;
revoke execute on function public.current_customer_id() from public, anon, authenticated, service_role;
revoke execute on function public.current_professional_id() from public, anon, authenticated, service_role;
revoke execute on function public.is_admin() from public, anon, authenticated, service_role;

grant select on table
  public.service_categories,
  public.service_issue_types,
  public.service_questions,
  public.service_question_options,
  public.diagnosis_rules,
  public.service_zones,
  public.professional_training_modules
to anon, authenticated;

grant select on table
  public.profiles,
  public.customer_profiles,
  public.admin_profiles,
  public.professional_profiles,
  public.professional_invitations,
  public.customer_addresses,
  public.service_requests,
  public.request_answers,
  public.request_media,
  public.diagnosis_reports,
  public.price_options,
  public.professional_documents,
  public.professional_tools,
  public.professional_service_categories,
  public.professional_service_zones,
  public.professional_availability,
  public.professional_training_completions,
  public.jobs,
  public.job_status_events,
  public.job_media,
  public.customer_equipment,
  public.reviews,
  public.complaints,
  public.warranty_claims,
  public.quality_events,
  public.pricing_rules,
  public.platform_settings,
  public.admin_audit_logs,
  public.notification_events,
  public.notifications
to authenticated;

grant select (
  id,
  professional_id,
  provider,
  provider_user_id,
  status,
  connected_at,
  created_at,
  updated_at
) on public.professional_payment_accounts to authenticated;

grant select (
  id,
  job_id,
  request_id,
  customer_id,
  professional_id,
  provider,
  amount,
  currency,
  status,
  payment_type,
  marketplace_fee,
  professional_amount,
  created_at,
  updated_at
) on public.payments to authenticated;

grant select (
  id,
  payment_id,
  provider,
  provider_event_id,
  event_type,
  created_at
) on public.payment_events to authenticated;

grant select (
  id,
  professional_id,
  payment_id,
  amount,
  currency,
  status,
  created_at,
  updated_at
) on public.payout_records to authenticated;

grant select (
  id,
  job_id,
  equipment_id,
  real_diagnosis,
  work_done,
  parts_used,
  final_state,
  maintenance_option,
  next_maintenance_date,
  warranty_days,
  created_at
) on public.job_final_reports to authenticated;

grant select (
  expires_at,
  revoked_at,
  created_at
) on public.receipts to authenticated;

grant select (
  id,
  equipment_id,
  job_id,
  professional_id,
  reported_problem,
  real_diagnosis,
  work_done,
  parts_used,
  next_maintenance_option,
  next_maintenance_date,
  created_at
) on public.equipment_service_records to authenticated;

grant update (first_name, last_name, phone, avatar_url)
on public.profiles to authenticated;

grant insert (
  customer_id,
  street,
  number,
  floor,
  apartment,
  city,
  province,
  postal_code,
  reference,
  property_type,
  has_elevator,
  has_parking,
  stairs_required,
  outdoor_unit_at_height,
  outdoor_unit_on_balcony,
  difficult_access,
  is_default
) on public.customer_addresses to authenticated;
grant update (
  street,
  number,
  floor,
  apartment,
  city,
  province,
  postal_code,
  reference,
  property_type,
  has_elevator,
  has_parking,
  stairs_required,
  outdoor_unit_at_height,
  outdoor_unit_on_balcony,
  difficult_access,
  is_default
) on public.customer_addresses to authenticated;
grant delete on public.customer_addresses to authenticated;

grant insert (request_id, media_type, storage_bucket, storage_path, uploaded_by)
on public.request_media to authenticated;

grant insert (professional_id, document_type, storage_bucket, storage_path)
on public.professional_documents to authenticated;
grant update (status)
on public.professional_documents to authenticated;
grant update (status) on public.professional_profiles to authenticated;

grant update (equipment_id) on public.service_requests to authenticated;

grant insert (job_id, media_type, phase, storage_bucket, storage_path, uploaded_by)
on public.job_media to authenticated;

grant insert (
  customer_id,
  address_id,
  category_id,
  nickname,
  brand,
  model,
  equipment_type,
  frigorias,
  serial_number,
  photo_url,
  notes
) on public.customer_equipment to authenticated;
grant update (
  address_id,
  category_id,
  nickname,
  brand,
  model,
  equipment_type,
  frigorias,
  serial_number,
  photo_url,
  notes
) on public.customer_equipment to authenticated;
grant delete on public.customer_equipment to authenticated;

grant update (status, resolution, updated_at) on public.complaints to authenticated;
grant update (status, resolution, updated_at) on public.warranty_claims to authenticated;
grant insert (job_id, professional_id, event_type, score_delta, notes, created_by)
on public.quality_events to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant insert, update, delete on
  public.service_categories,
  public.service_issue_types,
  public.service_questions,
  public.service_question_options,
  public.diagnosis_rules,
  public.service_zones,
  public.professional_training_modules,
  public.professional_invitations,
  public.pricing_rules
to authenticated;

grant insert (key, value, description)
on public.platform_settings to authenticated;
grant update (value, description)
on public.platform_settings to authenticated;
grant delete on public.platform_settings to authenticated;

grant select on public.public_receipt_view to service_role;
revoke all on public.public_receipts from public, anon, authenticated;
revoke all on public.receipts from public, anon;
revoke all on public.public_receipt_view from public, anon, authenticated;
