-- Existing checkouts remain on Preferences; only future rows use Orders.
alter table public.marketplace_checkouts
  add column checkout_protocol text not null default 'preferences',
  add column order_id text,
  add column checkout_url text,
  add column order_idempotency_key uuid not null default gen_random_uuid();

update public.marketplace_checkouts set checkout_protocol = 'preferences';

alter table public.marketplace_checkouts
  add constraint marketplace_checkout_protocol_check
    check (checkout_protocol in ('preferences', 'orders')),
  add constraint marketplace_checkout_provider_identity_check
    check (
      (checkout_protocol = 'preferences' and order_id is null and checkout_url is null)
      or
      (checkout_protocol = 'orders' and preference_id is null and init_point is null and sandbox_init_point is null)
    );

create unique index marketplace_checkouts_order_id_key
  on public.marketplace_checkouts(order_id) where order_id is not null;

alter table private.payment_refund_requests
  add column order_refund_baseline text[];

create or replace function private.protect_checkout_snapshot() returns trigger
language plpgsql set search_path='' as $$
begin
  if row(new.job_id,new.extra_id,new.customer_id,new.professional_id,new.seller_account_id,
         new.amount,new.marketplace_fee,new.live_mode,new.created_at)
     is distinct from
     row(old.job_id,old.extra_id,old.customer_id,old.professional_id,old.seller_account_id,
         old.amount,old.marketplace_fee,old.live_mode,old.created_at) then
    raise exception 'Checkout financial snapshot is immutable';
  end if;
  if old.closed_for_new_payments_at is not null and
     row(new.checkout_protocol,new.preference_id,new.order_id,new.order_idempotency_key,
         new.checkout_url,new.init_point,new.sandbox_init_point,new.expires_at,
         new.closed_for_new_payments_at)
     is distinct from
     row(old.checkout_protocol,old.preference_id,old.order_id,old.order_idempotency_key,
         old.checkout_url,old.init_point,old.sandbox_init_point,old.expires_at,
         old.closed_for_new_payments_at) then
    raise exception 'checkout_financially_closed';
  end if;
  return new;
end $$;

create table private.marketplace_order_attempts (
  order_id text primary key,
  checkout_id uuid not null references public.marketplace_checkouts(id),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index marketplace_order_attempts_checkout_idx
  on private.marketplace_order_attempts(checkout_id);
alter table private.marketplace_order_attempts enable row level security;
revoke all on private.marketplace_order_attempts from public, anon, authenticated, service_role;

create table private.marketplace_order_observations (
  order_id text primary key,
  checkout_id uuid not null references public.marketplace_checkouts(id),
  provider_status text not null,
  provider_updated_at timestamptz not null,
  payment_id text,
  refunded_amount numeric(12,2) not null default 0,
  issues jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null default now()
);
create index marketplace_order_observations_checkout_idx
  on private.marketplace_order_observations(checkout_id);
create unique index marketplace_order_observations_payment_key
  on private.marketplace_order_observations(payment_id) where payment_id is not null;
alter table private.marketplace_order_observations enable row level security;
revoke all on private.marketplace_order_observations from public, anon, authenticated, service_role;

create or replace function private.checkout_is_financially_closed(p_checkout public.marketplace_checkouts)
returns boolean language sql stable set search_path='' as $$
  select p_checkout.closed_for_new_payments_at is not null
    and p_checkout.status in ('expired','rejected','cancelled','refunded')
    and case when p_checkout.checkout_protocol='orders' then
      exists(select 1 from private.marketplace_order_observations o
        where o.order_id=p_checkout.order_id and o.checkout_id=p_checkout.id
          and (o.provider_status='cancelled' or
            (o.provider_status='refunded' and o.refunded_amount>=p_checkout.amount)))
    else
      not exists(select 1 from public.marketplace_payment_observations o
        where o.checkout_id=p_checkout.id
          and o.provider_status in ('approved','partially_refunded','charged_back','review'))
      and not exists(select 1 from public.marketplace_payment_observations o
        where o.checkout_id=p_checkout.id and o.provider_status='refunded'
          and o.refunded_amount<p_checkout.amount)
    end;
$$;

create or replace function public.mark_marketplace_checkout_closed(
  p_checkout_id uuid,p_evidence jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_checkout public.marketplace_checkouts%rowtype;v_status text;
begin
  if not private.has_admin_permission('finance') then raise exception using errcode='42501',message='finance_required'; end if;
  if jsonb_typeof(p_evidence)<>'object' then raise exception using errcode='22023',message='provider_evidence_required'; end if;
  select * into v_checkout from public.marketplace_checkouts where id=p_checkout_id for update;
  if not found then raise exception using errcode='P0002',message='checkout_not_found'; end if;
  if v_checkout.closed_for_new_payments_at is not null then
    if v_checkout.closure_evidence=p_evidence and private.checkout_is_financially_closed(v_checkout) then
      return jsonb_build_object('id',v_checkout.id,'status',v_checkout.status,
        'closedForNewPayments',true,'idempotent',true);
    end if;
    raise exception using errcode='40001',message='checkout_review';
  end if;
  if v_checkout.checkout_protocol='orders' then
    if p_evidence->>'providerOrderId' is distinct from v_checkout.order_id
       or p_evidence->>'providerOrderStatus' not in ('cancelled','refunded')
       or not exists(select 1 from private.marketplace_order_observations o
          where o.order_id=v_checkout.order_id and o.checkout_id=v_checkout.id
            and o.provider_status=p_evidence->>'providerOrderStatus'
            and (o.provider_status='cancelled' or o.refunded_amount>=v_checkout.amount)) then
      raise exception using errcode='40001',message='payment_reconciliation_required';
    end if;
    v_status:=case when p_evidence->>'providerOrderStatus'='refunded' then 'refunded' else 'expired' end;
  else
    if nullif(trim(p_evidence->>'providerPreferenceStatus'),'') is null then
      raise exception using errcode='22023',message='provider_evidence_required'; end if;
    if exists(select 1 from public.marketplace_payment_observations where checkout_id=v_checkout.id
        and provider_status in('approved','partially_refunded','charged_back','review')) then
      raise exception using errcode='40001',message='payment_reconciliation_required'; end if;
    v_status:=case when exists(select 1 from public.marketplace_payment_observations
      where checkout_id=v_checkout.id and provider_status='refunded') then 'refunded' else 'expired' end;
  end if;
  update public.marketplace_checkouts set status=v_status,closed_for_new_payments_at=clock_timestamp(),
    closure_evidence=p_evidence,review_reason=null,updated_at=clock_timestamp() where id=v_checkout.id;
  perform private.append_admin_audit('payment.checkout_closed','marketplace_checkout',v_checkout.id,p_evidence);
  return jsonb_build_object('id',v_checkout.id,'status',v_status,'closedForNewPayments',true);
end; $$;

create or replace function public.get_payment_refund_execution_context(p_request_id uuid,p_claim_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
  if auth.role()<>'service_role' then raise exception using errcode='42501',message='service_role_required'; end if;
  select jsonb_build_object('professionalId',p.professional_id,
      'checkoutId',coalesce(legacy.checkout_id,orders.checkout_id),'paymentAmount',p.amount)
    into v from private.payment_refund_requests r join public.payments p on p.id=r.payment_id
    left join public.marketplace_payment_observations legacy on legacy.provider_payment_id=p.provider_payment_id
    left join private.marketplace_order_observations orders on orders.payment_id=p.provider_payment_id
    where r.id=p_request_id and r.status='processing' and r.claim_token=p_claim_token
      and r.locked_until>clock_timestamp()
      and coalesce(legacy.checkout_id,orders.checkout_id) is not null;
  if v is null then raise exception using errcode='40001',message='refund_claim_stale'; end if;
  return v;
end; $$;
