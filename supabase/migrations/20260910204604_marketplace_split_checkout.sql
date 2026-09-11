-- Upstream storage from aeb07a24303edf701004ec1dbb8d4073dc8784af; hardened for Supabase.
set search_path = public;
CREATE TABLE mp_split_connected_accounts (
  seller_id varchar(256) PRIMARY KEY,
  mercado_pago_user_id varchar(255) NOT NULL,
  encrypted_access_token text NOT NULL,
  encrypted_refresh_token text,
  access_token_expires_at timestamptz(3) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz(3) NOT NULL,
  updated_at timestamptz(3) NOT NULL,
  CONSTRAINT mp_split_connected_accounts_mp_user_id_key
    UNIQUE (mercado_pago_user_id),
  CONSTRAINT mp_split_connected_accounts_seller_id_check
    CHECK (length(btrim(seller_id)) BETWEEN 1 AND 256),
  CONSTRAINT mp_split_connected_accounts_mp_user_id_check
    CHECK (length(btrim(mercado_pago_user_id)) BETWEEN 1 AND 255),
  CONSTRAINT mp_split_connected_accounts_access_token_check
    CHECK (length(encrypted_access_token) BETWEEN 1 AND 12000),
  CONSTRAINT mp_split_connected_accounts_refresh_token_check
    CHECK (
      encrypted_refresh_token IS NULL
      OR length(encrypted_refresh_token) BETWEEN 1 AND 12000
    )
);

CREATE INDEX mp_split_connected_accounts_enabled_idx
  ON mp_split_connected_accounts (enabled);

CREATE TABLE mp_split_oauth_states (
  state_hash varchar(128) PRIMARY KEY,
  seller_id varchar(256) NOT NULL,
  expires_at timestamptz(3) NOT NULL,
  created_at timestamptz(3) NOT NULL,
  consumed_at timestamptz(3),
  CONSTRAINT mp_split_oauth_states_state_hash_check
    CHECK (length(btrim(state_hash)) BETWEEN 1 AND 128),
  CONSTRAINT mp_split_oauth_states_seller_id_check
    CHECK (length(btrim(seller_id)) BETWEEN 1 AND 256),
  CONSTRAINT mp_split_oauth_states_expiration_check
    CHECK (expires_at > created_at),
  CONSTRAINT mp_split_oauth_states_consumed_at_check
    CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX mp_split_oauth_states_expires_at_idx
  ON mp_split_oauth_states (expires_at);

CREATE TABLE mp_split_webhook_events (
  event_key varchar(268) PRIMARY KEY,
  notification_id varchar(255) NOT NULL,
  notification_type varchar(100) NOT NULL,
  action varchar(150) NOT NULL,
  data_id varchar(255) NOT NULL,
  mercado_pago_user_id varchar(255) NOT NULL,
  status varchar(16) NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  last_error varchar(2048),
  received_at timestamptz(3) NOT NULL,
  updated_at timestamptz(3) NOT NULL,
  processed_at timestamptz(3),
  CONSTRAINT mp_split_webhook_events_notification_id_key
    UNIQUE (notification_id),
  CONSTRAINT mp_split_webhook_events_event_identity_check
    CHECK (event_key = 'notification:' || notification_id),
  CONSTRAINT mp_split_webhook_events_notification_type_check
    CHECK (length(btrim(notification_type)) BETWEEN 1 AND 100),
  CONSTRAINT mp_split_webhook_events_action_check
    CHECK (length(btrim(action)) BETWEEN 1 AND 150),
  CONSTRAINT mp_split_webhook_events_data_id_check
    CHECK (length(btrim(data_id)) BETWEEN 1 AND 255),
  CONSTRAINT mp_split_webhook_events_mp_user_id_check
    CHECK (length(btrim(mercado_pago_user_id)) BETWEEN 1 AND 255),
  CONSTRAINT mp_split_webhook_events_status_check
    CHECK (status IN ('processing', 'processed', 'failed')),
  CONSTRAINT mp_split_webhook_events_attempts_check
    CHECK (attempts > 0),
  CONSTRAINT mp_split_webhook_events_error_state_check
    CHECK (
      (status = 'failed' AND last_error IS NOT NULL)
      OR (status <> 'failed' AND last_error IS NULL)
    ),
  CONSTRAINT mp_split_webhook_events_processed_state_check
    CHECK (
      (status = 'processed' AND processed_at IS NOT NULL)
      OR (status <> 'processed' AND processed_at IS NULL)
    )
);

CREATE INDEX mp_split_webhook_events_retry_idx
  ON mp_split_webhook_events (status, updated_at, event_key);

CREATE TABLE mp_split_seller_unlink_events (
  event_id varchar(128) PRIMARY KEY,
  seller_id varchar(256) NOT NULL,
  mercado_pago_user_id varchar(255) NOT NULL,
  status varchar(16) NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_error varchar(2048),
  created_at timestamptz(3) NOT NULL,
  updated_at timestamptz(3) NOT NULL,
  available_at timestamptz(3) NOT NULL,
  lease_expires_at timestamptz(3),
  delivered_at timestamptz(3),
  CONSTRAINT mp_split_seller_unlink_events_event_id_check
    CHECK (length(btrim(event_id)) BETWEEN 1 AND 128),
  CONSTRAINT mp_split_seller_unlink_events_seller_id_check
    CHECK (length(btrim(seller_id)) BETWEEN 1 AND 256),
  CONSTRAINT mp_split_seller_unlink_events_mp_user_id_check
    CHECK (length(btrim(mercado_pago_user_id)) BETWEEN 1 AND 255),
  CONSTRAINT mp_split_seller_unlink_events_status_check
    CHECK (status IN ('pending', 'processing', 'failed', 'delivered')),
  CONSTRAINT mp_split_seller_unlink_events_attempts_check
    CHECK (attempts >= 0),
  CONSTRAINT mp_split_seller_unlink_events_error_state_check
    CHECK (
      (status = 'failed' AND last_error IS NOT NULL)
      OR (status <> 'failed' AND last_error IS NULL)
    ),
  CONSTRAINT mp_split_seller_unlink_events_lease_state_check
    CHECK (
      (status = 'processing' AND lease_expires_at IS NOT NULL)
      OR (status <> 'processing' AND lease_expires_at IS NULL)
    ),
  CONSTRAINT mp_split_seller_unlink_events_delivery_state_check
    CHECK (
      (status = 'delivered' AND delivered_at IS NOT NULL)
      OR (status <> 'delivered' AND delivered_at IS NULL)
    ),
  CONSTRAINT mp_split_seller_unlink_events_time_check
    CHECK (
      updated_at >= created_at
      AND available_at >= created_at
      AND (lease_expires_at IS NULL OR lease_expires_at >= updated_at)
      AND (delivered_at IS NULL OR delivered_at >= updated_at)
    )
);

CREATE INDEX mp_split_seller_unlink_events_retry_idx
  ON mp_split_seller_unlink_events
  (status, available_at, lease_expires_at, event_id);

CREATE INDEX mp_split_seller_unlink_events_seller_retry_idx
  ON mp_split_seller_unlink_events (seller_id, status, available_at);

CREATE INDEX mp_split_seller_unlink_events_mp_user_retry_idx
  ON mp_split_seller_unlink_events
  (mercado_pago_user_id, status, available_at);

ALTER TABLE mp_split_webhook_events
  ADD COLUMN lease_expires_at timestamptz(3);

UPDATE mp_split_webhook_events
SET lease_expires_at = updated_at + interval '5 minutes'
WHERE status = 'processing';

ALTER TABLE mp_split_webhook_events
  ADD CONSTRAINT mp_split_webhook_events_lease_state_check
  CHECK (
    (status = 'processing' AND lease_expires_at IS NOT NULL)
    OR (status <> 'processing' AND lease_expires_at IS NULL)
  );

DROP INDEX mp_split_webhook_events_retry_idx;

CREATE INDEX mp_split_webhook_events_retry_idx
  ON mp_split_webhook_events
    (status, lease_expires_at, updated_at, event_key);


-- Only the server's PostgreSQL connection accesses OAuth secrets and leases.
do $$ declare t text; begin
  foreach t in array array['mp_split_connected_accounts','mp_split_oauth_states','mp_split_seller_unlink_events','mp_split_webhook_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role', t);
  end loop;
end $$;

create table public.marketplace_checkouts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id), extra_id uuid references public.job_extras(id),
  customer_id uuid not null references public.customer_profiles(id), professional_id uuid not null references public.professional_profiles(id),
  seller_account_id text not null, amount numeric(12,2) not null check(amount>0),
  marketplace_fee numeric(12,2) not null check(marketplace_fee>=0 and marketplace_fee<=amount),
  professional_amount numeric(12,2) generated always as (amount-marketplace_fee) stored,
  currency text not null default 'ARS' check(currency='ARS'), live_mode boolean not null,
  status text not null default 'creating' check(status in ('creating','ready','pending','in_process','approved','rejected','cancelled','refunded','partially_refunded','charged_back','review','expired')),
  preference_id text unique, preference_spec jsonb, init_point text, sandbox_init_point text,
  expires_at timestamptz not null default now()+interval '30 minutes',
  lease_until timestamptz, lease_token uuid,
  last_reconciled_at timestamptz, last_error text, review_reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint extra_has_zero_lysto_fee check(extra_id is null or marketplace_fee=0)
);
create unique index marketplace_checkout_target on public.marketplace_checkouts(job_id,coalesce(extra_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index marketplace_checkout_customer on public.marketplace_checkouts(customer_id,created_at desc);
create index marketplace_checkout_professional on public.marketplace_checkouts(professional_id,created_at desc);
alter table public.marketplace_checkouts enable row level security;
revoke all on public.marketplace_checkouts from public,anon,authenticated,service_role;
grant select on public.marketplace_checkouts to authenticated;
create policy checkout_participants on public.marketplace_checkouts for select to authenticated using (
 customer_id=(select private.current_customer_id()) or professional_id=(select private.current_professional_id(true)) or private.has_admin_permission('finance')
);
create table public.marketplace_payment_observations (
 provider_payment_id text primary key, checkout_id uuid not null references public.marketplace_checkouts(id),
 provider_status text not null, provider_updated_at timestamptz not null, refunded_amount numeric(12,2) not null default 0,
 provider_fee numeric(12,2) not null default 0, net_received_amount numeric(12,2),
 issues jsonb not null default '[]', observed_at timestamptz not null default now()
);
create index marketplace_payment_checkout on public.marketplace_payment_observations(checkout_id);
alter table public.marketplace_payment_observations enable row level security;
revoke all on public.marketplace_payment_observations from public,anon,authenticated,service_role;
grant select on public.marketplace_payment_observations to authenticated;
create policy payment_observation_participants on public.marketplace_payment_observations for select to authenticated using (
 exists(select 1 from public.marketplace_checkouts c where c.id=checkout_id)
);
create table private.marketplace_applied_events (
 event_id text primary key, checkout_id uuid not null references public.marketplace_checkouts(id), created_at timestamptz not null default now()
);
alter table private.marketplace_applied_events enable row level security;
revoke all on private.marketplace_applied_events from public,anon,authenticated,service_role;

create function private.prepare_marketplace_checkout(p_customer uuid,p_job uuid,p_extra uuid,p_live boolean)
returns public.marketplace_checkouts language plpgsql set search_path='' as $$
declare j public.jobs%rowtype; q public.service_quotes%rowtype; e public.job_extras%rowtype; c public.marketplace_checkouts%rowtype; account_id text; total numeric; fee numeric;
begin
 select * into j from public.jobs where id=p_job and customer_id=p_customer for update;
 if j.id is null then raise exception 'payment_forbidden'; end if;
 if j.professional_id is null or j.status not in ('confirmed','technician_on_way','arrived','onsite_diagnosis','waiting_customer_approval','in_progress','completed_pending_customer_confirmation','completed') then raise exception 'professional_acceptance_required'; end if;
 if not exists(select 1 from public.professional_profiles where id=j.professional_id and status='approved') then raise exception 'professional_acceptance_required'; end if;
 select mercado_pago_user_id into account_id from public.mp_split_connected_accounts where seller_id=j.professional_id::text and enabled;
 if account_id is null then raise exception 'seller_not_linked'; end if;
 select * into q from public.service_quotes where request_id=j.request_id and status='accepted';
 if q.id is null then raise exception 'accepted_quote_required'; end if;
 if p_extra is null then total:=(q.quote->>'total')::numeric; fee:=(q.quote->>'platformFee')::numeric;
 else
   select * into e from public.job_extras where id=p_extra and job_id=j.id and professional_id=j.professional_id and status='accepted';
   if e.id is null then raise exception 'accepted_extra_required'; end if;
   total:=e.amount; fee:=0;
 end if;
 select * into c from public.marketplace_checkouts where job_id=j.id and extra_id is not distinct from p_extra for update;
 if c.id is not null then
   if c.professional_id<>j.professional_id or c.seller_account_id<>account_id or c.amount<>total or c.marketplace_fee<>fee or c.live_mode<>p_live then raise exception 'checkout_identity_changed'; end if;
   return c;
 end if;
 insert into public.marketplace_checkouts(job_id,extra_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode)
 values(j.id,p_extra,p_customer,j.professional_id,account_id,total,fee,p_live) returning * into c;
 return c;
end $$;
revoke all on function private.prepare_marketplace_checkout(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;

create function private.protect_checkout_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.job_id,new.extra_id,new.customer_id,new.professional_id,new.seller_account_id,new.amount,new.marketplace_fee,new.live_mode,new.created_at)
 is distinct from row(old.job_id,old.extra_id,old.customer_id,old.professional_id,old.seller_account_id,old.amount,old.marketplace_fee,old.live_mode,old.created_at) then raise exception 'Checkout financial snapshot is immutable'; end if;
 return new;
end $$;
create trigger marketplace_checkout_immutable before update on public.marketplace_checkouts for each row execute function private.protect_checkout_snapshot();

-- A payable link pins its seller; reassignment/cancellation requires reconciliation first.
create function private.protect_paid_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.professional_id is distinct from old.professional_id or (new.status::text like 'cancelled%' and new.status is distinct from old.status))
 and exists(select 1 from public.marketplace_checkouts where job_id=old.id and status not in ('expired','cancelled','rejected','refunded')) then
   raise exception 'Reconcile or refund the checkout before changing its assignment';
 end if;
 if new.status in ('technician_on_way','arrived','onsite_diagnosis','in_progress') and new.status is distinct from old.status
 and exists(select 1 from public.service_quotes where request_id=old.request_id and accepted_at is not null)
 and not exists(select 1 from public.marketplace_checkouts where job_id=old.id and extra_id is null and status='approved') then
   raise exception 'Initial payment must be approved before the visit';
 end if;
 return new;
end $$;
create trigger marketplace_assignment_guard before update on public.jobs for each row execute function private.protect_paid_assignment();
reset search_path;
