-- Administrative requests reuse customer approval and the unique extra checkout.
-- Existing technical extras retain their exact amounts and zero Lysto commission.
alter table public.job_extras
  add column charge_origin text not null default 'professional'
    check(charge_origin in ('professional','admin')),
  add column commission_rate numeric(8,6) not null default 0
    check(commission_rate between 0 and 0.5 and commission_rate::text not in ('NaN','Infinity','-Infinity')),
  add column commission_mode text check(commission_mode in ('standard','none')),
  add constraint extra_charge_origin_check check(
    (charge_origin='professional' and commission_rate=0 and commission_mode is null)
    or (charge_origin='admin' and commission_mode is not null and (commission_mode<>'none' or commission_rate=0))
  );
alter table public.job_extras
  alter column platform_fee set expression as (round(amount*commission_rate,2)),
  alter column professional_amount set expression as (amount-round(amount*commission_rate,2));
-- Internal administrative reasons must not leak through the customer/pro extras SELECT.
create table private.admin_charge_details(
  extra_id uuid primary key references public.job_extras(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  reason text not null check(length(btrim(reason)) between 10 and 2000)
);
create index admin_charge_details_actor on private.admin_charge_details(created_by);
alter table private.admin_charge_details enable row level security;
revoke all on private.admin_charge_details from public,anon,authenticated,service_role;

create function private.protect_extra_charge_snapshot() returns trigger
language plpgsql set search_path='' as $$
begin
  if (new.job_id,new.professional_id,new.fault,new.description,new.amount,new.charge_origin,
      new.commission_rate,new.commission_mode,new.idempotency_key)
    is distinct from
     (old.job_id,old.professional_id,old.fault,old.description,old.amount,old.charge_origin,
      old.commission_rate,old.commission_mode,old.idempotency_key)
  then raise exception using errcode='40001',message='charge_snapshot_immutable'; end if;
  return new;
end; $$;
create trigger extra_charge_snapshot_guard before update on public.job_extras
for each row execute function private.protect_extra_charge_snapshot();

-- Replace the blanket zero-fee rule with the exact accepted-extra snapshot.
create function private.check_extra_checkout_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.extra_id is not null and not exists(
    select 1 from public.job_extras e where e.id=new.extra_id and e.job_id=new.job_id
      and e.professional_id=new.professional_id and e.status='accepted'
      and e.amount=new.amount and e.platform_fee=new.marketplace_fee
  ) then raise exception using errcode='23514',message='extra_checkout_snapshot_mismatch'; end if;
  return new;
end; $$;
create trigger extra_checkout_snapshot_guard before insert or update of extra_id,job_id,professional_id,amount,marketplace_fee
on public.marketplace_checkouts for each row execute function private.check_extra_checkout_snapshot();
alter table public.marketplace_checkouts drop constraint extra_has_zero_lysto_fee;

create or replace function private.prepare_marketplace_checkout_before_automatic_request(p_customer uuid,p_job uuid,p_extra uuid,p_live boolean)
returns public.marketplace_checkouts language plpgsql set search_path='' as $$
declare j public.jobs%rowtype; q public.service_quotes%rowtype; e public.job_extras%rowtype; c public.marketplace_checkouts%rowtype; account_id text; total numeric; fee numeric;
begin
 select * into j from public.jobs where id=p_job and customer_id=p_customer for update;
 if j.id is null then raise exception 'payment_forbidden'; end if;
 if j.professional_id is null or j.status not in ('confirmed','technician_on_way','arrived','onsite_diagnosis','waiting_customer_approval','in_progress','completed_pending_customer_confirmation','completed') then raise exception 'professional_acceptance_required'; end if;
 if not exists(select 1 from public.professional_profiles where id=j.professional_id and status='approved') then raise exception 'professional_acceptance_required'; end if;
 select mercado_pago_user_id into account_id from public.mp_split_connected_accounts where seller_id=j.professional_id::text and enabled for update;
 if account_id is null then raise exception 'seller_not_linked'; end if;
 select * into q from public.service_quotes where request_id=j.request_id and status='accepted';
 if q.id is null then raise exception 'accepted_quote_required'; end if;
 if p_extra is null then total:=(q.quote->>'total')::numeric; fee:=(q.quote->>'platformFee')::numeric;
 else
   select * into e from public.job_extras where id=p_extra and job_id=j.id and professional_id=j.professional_id and status='accepted';
   if e.id is null then raise exception 'accepted_extra_required'; end if;
   total:=e.amount; fee:=e.platform_fee;
 end if;
 select * into c from public.marketplace_checkouts where job_id=j.id and extra_id is not distinct from p_extra for update;
 if c.id is not null then
   if c.professional_id<>j.professional_id or c.seller_account_id<>account_id or c.amount<>total or c.marketplace_fee<>fee or c.live_mode<>p_live then raise exception 'checkout_identity_changed'; end if;
   return c;
 end if;
 insert into public.marketplace_checkouts(job_id,extra_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode)
 values(j.id,p_extra,p_customer,j.professional_id,account_id,total,fee,p_live) returning * into c;
 return c;
end; $$;

create function private.create_admin_charge(p_job_id uuid,p_concept text,p_description text,
  p_amount numeric,p_commission_mode text,p_expected_commission_rate numeric,p_reason text,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.jobs%rowtype; e public.job_extras%rowtype;
  detail private.admin_charge_details%rowtype;
  actor uuid:=private.current_profile_id(); rate numeric; policy jsonb;
begin
  if not private.has_admin_permission('finance') then raise exception using errcode='42501',message='finance_required'; end if;
  if p_idempotency_key is null or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
    or p_amount<=0 or p_amount>100000000 or round(p_amount,2)<>p_amount
    or p_commission_mode is null or p_commission_mode not in ('standard','none')
    or p_expected_commission_rate is null or p_expected_commission_rate::text in ('NaN','Infinity','-Infinity')
    or p_expected_commission_rate not between 0 and 0.5
    or p_concept is null or length(btrim(p_concept)) not between 5 and 500
    or p_description is null or length(btrim(p_description)) not between 10 and 2000
    or p_reason is null or length(btrim(p_reason)) not between 10 and 2000
  then raise exception using errcode='22023',message='invalid_charge'; end if;
  select * into j from public.jobs where id=p_job_id for update;
  if j.id is null then raise exception using errcode='P0002',message='job_not_found'; end if;
  select * into e from public.job_extras where professional_id=j.professional_id and idempotency_key=p_idempotency_key;
  if e.id is not null then
    select * into detail from private.admin_charge_details where extra_id=e.id;
    if e.charge_origin<>'admin' or detail.created_by is distinct from actor or e.job_id<>p_job_id
      or e.fault<>btrim(p_concept) or e.description<>btrim(p_description) or e.amount<>p_amount
      or e.commission_mode<>p_commission_mode or e.commission_rate<>p_expected_commission_rate or detail.reason is distinct from btrim(p_reason)
    then raise exception using errcode='40001',message='idempotency_conflict'; end if;
    return to_jsonb(e);
  end if;
  if j.status not in ('confirmed','technician_on_way','arrived','onsite_diagnosis','waiting_customer_approval','in_progress')
    or j.professional_id is null
    or not exists(select 1 from public.professional_profiles where id=j.professional_id and status='approved')
    or not exists(select 1 from public.mp_split_connected_accounts where seller_id=j.professional_id::text and enabled)
    or not exists(select 1 from public.service_quotes where request_id=j.request_id and status='accepted')
    or exists(select 1 from private.financial_exception_cases where job_id=j.id and status<>'resolved')
  then raise exception using errcode='40001',message='job_not_chargeable'; end if;
  policy:=private.get_quote_policy();
  rate:=case when p_commission_mode='none' then 0 else (policy->>'platformFeeRate')::numeric end;
  if rate is null or rate::text in ('NaN','Infinity','-Infinity') or rate not between 0 and 0.5
  then raise exception using errcode='22023',message='commission_policy_unavailable'; end if;
  if rate<>p_expected_commission_rate then raise exception using errcode='40001',message='commission_policy_changed'; end if;
  insert into public.job_extras(job_id,professional_id,fault,description,amount,idempotency_key,
    charge_origin,commission_rate,commission_mode)
  values(j.id,j.professional_id,btrim(p_concept),btrim(p_description),p_amount,p_idempotency_key,
    'admin',rate,p_commission_mode) returning * into e;
  insert into private.admin_charge_details(extra_id,created_by,reason) values(e.id,actor,btrim(p_reason));
  perform private.append_admin_audit('payment.charge.proposed','job_extra',e.id,
    jsonb_build_object('jobId',j.id,'amount',e.amount,'marketplaceFee',e.platform_fee,
      'professionalAmount',e.professional_amount,'commissionMode',p_commission_mode,'reason',btrim(p_reason)));
  insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata)
  values(j.id,j.status,actor,'Solicitud de cobro administrativo; pendiente de aceptación y pago',
    jsonb_build_object('event','admin_charge.proposed','extra_id',e.id,'amount',e.amount,'commission',e.platform_fee));
  return to_jsonb(e);
end; $$;

create function public.create_admin_charge(p_job_id uuid,p_concept text,p_description text,
  p_amount numeric,p_commission_mode text,p_expected_commission_rate numeric,p_reason text,p_idempotency_key uuid) returns jsonb
language sql security invoker set search_path='' as $$
  select private.create_admin_charge(p_job_id,p_concept,p_description,p_amount,p_commission_mode,p_expected_commission_rate,p_reason,p_idempotency_key);
$$;

create function private.get_admin_payment_context(p_search text default null,p_job_ids uuid[] default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not (private.has_admin_permission('operations') or private.has_admin_permission('finance'))
  then raise exception using errcode='42501',message='admin_permission_required'; end if;
  if length(coalesce(p_search,''))>120 or cardinality(p_job_ids)>300
  then raise exception using errcode='22023',message='invalid_lookup'; end if;
  return jsonb_build_object('commissionRate',coalesce((private.get_quote_policy()->>'platformFeeRate')::numeric,0.18),
    'jobs',coalesce((with matches as materialized (
      select j.id from public.jobs j
      join public.customer_profiles c on c.id=j.customer_id join public.profiles cp on cp.id=c.profile_id
      join public.service_requests r on r.id=j.request_id
      left join public.service_issue_types i on i.id=r.issue_type_id
      left join public.professional_profiles pro on pro.id=j.professional_id left join public.profiles pp on pp.id=pro.profile_id
      where coalesce(btrim(p_search),'')='' or position(lower(btrim(p_search)) in
        lower(concat_ws(' ',j.id::text,cp.first_name,cp.last_name,pp.first_name,pp.last_name,i.name)))>0
      order by (j.status in ('confirmed','technician_on_way','arrived','onsite_diagnosis','waiting_customer_approval','in_progress')) desc,j.created_at desc
      limit 100
    ), targets as (select id from matches union select unnest(p_job_ids))
    select jsonb_agg(x.item order by x.created_at desc) from (
      select j.created_at,jsonb_build_object('id',j.id,'version',j.assignment_version,'status',j.status,
        'matchesSearch',exists(select 1 from matches m where m.id=j.id),
        'customerName',btrim(concat_ws(' ',cp.first_name,cp.last_name)),
        'professionalName',case when pp.id is null then null else btrim(concat_ws(' ',pp.first_name,pp.last_name)) end,
        'issueLabel',coalesce(i.name,'Servicio'),
        'canCharge',coalesce(j.status in ('confirmed','technician_on_way','arrived','onsite_diagnosis','waiting_customer_approval','in_progress')
          and pro.status='approved' and exists(select 1 from public.mp_split_connected_accounts where seller_id=j.professional_id::text and enabled)
          and exists(select 1 from public.service_quotes where request_id=j.request_id and status='accepted')
          and not exists(select 1 from private.financial_exception_cases where job_id=j.id and status<>'resolved'),false)
      ) item
      from public.jobs j join public.customer_profiles c on c.id=j.customer_id
      join public.profiles cp on cp.id=c.profile_id join public.service_requests r on r.id=j.request_id
      left join public.service_issue_types i on i.id=r.issue_type_id
      left join public.professional_profiles pro on pro.id=j.professional_id
      left join public.profiles pp on pp.id=pro.profile_id
      where j.id in (select id from targets)
    ) x),'[]'::jsonb));
end; $$;
create function public.get_admin_payment_context(p_search text default null,p_job_ids uuid[] default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.get_admin_payment_context(p_search,p_job_ids); $$;

-- Only the admin-origin proposals extend the existing decision window.
create or replace function private.decide_job_extra(p_extra_id uuid,p_decision text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.job_extras%rowtype; j public.jobs%rowtype; cid uuid:=private.current_customer_id();
begin
  if cid is null then raise exception using errcode='42501',message='Customer role required'; end if;
  if p_decision is null or p_decision not in ('accepted','rejected') then raise exception using errcode='22023',message='Invalid decision'; end if;
  select j0.* into j from public.jobs j0 join public.job_extras e0 on e0.job_id=j0.id where e0.id=p_extra_id for update of j0;
  if j.id is null or j.customer_id is distinct from cid then raise exception using errcode='42501',message='Extra unavailable'; end if;
  select * into e from public.job_extras where id=p_extra_id for update;
  if e.status=p_decision then return to_jsonb(e); end if;
  if e.status<>'proposed' then raise exception using errcode='40001',message='Extra already decided'; end if;
  if j.professional_id is distinct from e.professional_id or not (
    j.status in ('arrived','onsite_diagnosis','waiting_customer_approval','in_progress')
    or (e.charge_origin='admin' and j.status in ('confirmed','technician_on_way')))
    or exists(select 1 from private.financial_exception_cases where job_id=j.id and status<>'resolved')
  then raise exception using errcode='40001',message='Extra no longer actionable'; end if;
  update public.job_extras set status=p_decision,decided_by=private.current_profile_id(),decided_at=now()
    where id=e.id returning * into e;
  insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata)
  values(j.id,j.status,private.current_profile_id(),'Cliente decidió sobre cobro adicional',
    jsonb_build_object('extra_id',e.id,'amount',e.amount,'commission',e.platform_fee,'event','extra.'||p_decision));
  return to_jsonb(e);
end; $$;

revoke all on function private.protect_extra_charge_snapshot(),private.check_extra_checkout_snapshot() from public,anon,authenticated,service_role;
revoke all on function private.create_admin_charge(uuid,text,text,numeric,text,numeric,text,uuid),
  public.create_admin_charge(uuid,text,text,numeric,text,numeric,text,uuid),
  private.get_admin_payment_context(text,uuid[]),public.get_admin_payment_context(text,uuid[]) from public,anon,service_role;
grant execute on function private.create_admin_charge(uuid,text,text,numeric,text,numeric,text,uuid),
  public.create_admin_charge(uuid,text,text,numeric,text,numeric,text,uuid),
  private.get_admin_payment_context(text,uuid[]),public.get_admin_payment_context(text,uuid[]) to authenticated;
-- Existing RLS and SELECT-only access to extras remain unchanged.
