-- Commercial approval is an attributable, immutable decision, not a generic setting.
create table private.quote_policy_versions (
  id uuid primary key default gen_random_uuid(), revision integer not null unique check(revision>0),
  policy jsonb not null check(jsonb_typeof(policy)='object'),
  created_by uuid not null references public.profiles(id), reason text not null check(length(trim(reason)) between 15 and 2000),
  created_at timestamptz not null default now()
);
create unique index quote_policy_version_label on private.quote_policy_versions((policy->>'version'));
create table private.quote_policy_current (
  singleton boolean primary key default true check(singleton), policy_id uuid references private.quote_policy_versions(id)
);
insert into private.quote_policy_current(singleton) values(true);
revoke all on private.quote_policy_versions,private.quote_policy_current from public,anon,authenticated,service_role;

create or replace function private.get_quote_policy() returns jsonb language sql stable security definer set search_path='' as $$
  select v.policy from private.quote_policy_current c join private.quote_policy_versions v on v.id=c.policy_id where c.singleton;
$$;
create function private.get_quote_policy_record() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if private.current_profile_id() is null then raise exception using errcode='42501',message='Session required'; end if;
  return (select jsonb_build_object('id',v.id,'revision',coalesce(v.revision,0),'policy',v.policy)
    from private.quote_policy_current c left join private.quote_policy_versions v on v.id=c.policy_id where c.singleton);
end; $$;
create function public.get_quote_policy_record() returns jsonb language sql security invoker set search_path='' as $$ select private.get_quote_policy_record(); $$;

create function private.update_quote_policy_v2(p_policy jsonb,p_expected_revision integer,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; current_revision integer; new_id uuid; field text; amount numeric;
begin
  actor=private.lock_admin_mutation('finance');
  perform 1 from private.quote_policy_current where singleton for update;
  select coalesce(v.revision,0) into current_revision from private.quote_policy_current c left join private.quote_policy_versions v on v.id=c.policy_id where c.singleton;
  if p_expected_revision is distinct from current_revision then raise exception using errcode='40001',message='Policy version changed'; end if;
  if jsonb_typeof(p_policy) is distinct from 'object' or length(trim(coalesce(p_reason,''))) not between 15 and 2000
    or length(trim(coalesce(p_policy->>'version',''))) not between 1 and 100 or length(trim(coalesce(p_policy->>'source',''))) not between 1 and 300
    or not p_policy ?& array['approvedUntil','sourceDate','safetyRate','platformFeeRate','paymentCostRate','priorityMultiplier','laborIndex','perKm','perMinute','minimumTravel','difficultAccess','height','stairs','noParking','commercial','office','inverterRate','quoteValidityMinutes','laborOverrides']
    then raise exception using errcode='22023',message='Policy and decision required'; end if;
  if exists(select 1 from jsonb_object_keys(p_policy) k where k<>all(array['version','source','sourceDate','approvedUntil','safetyRate','platformFeeRate','paymentCostRate','priorityMultiplier','laborIndex','perKm','perMinute','minimumTravel','difficultAccess','height','stairs','noParking','commercial','office','inverterRate','quoteValidityMinutes','laborOverrides'])) then raise exception using errcode='22023',message='Unknown policy field'; end if;
  if coalesce(p_policy->>'sourceDate','') !~ '^\d{4}-\d{2}-\d{2}$'
    or (p_policy->'approvedUntil'<>'null'::jsonb and coalesce(p_policy->>'approvedUntil','') !~ '^\d{4}-\d{2}-\d{2}$')
    or (p_policy->>'sourceDate')::date > (now() at time zone 'America/Argentina/Buenos_Aires')::date
    or (p_policy->>'approvedUntil')::date < (now() at time zone 'America/Argentina/Buenos_Aires')::date
    or (p_policy->>'approvedUntil')::date < (p_policy->>'sourceDate')::date then raise exception using errcode='22023',message='Invalid policy dates'; end if;
  foreach field in array array['safetyRate','platformFeeRate','paymentCostRate','priorityMultiplier','laborIndex','perKm','perMinute','minimumTravel','difficultAccess','height','stairs','noParking','commercial','office','inverterRate','quoteValidityMinutes'] loop
    if jsonb_typeof(p_policy->field) is distinct from 'number' then raise exception using errcode='22023',message='Numeric policy fields required'; end if;
    amount=(p_policy->>field)::numeric;
    if amount<0 or amount>100000000 then raise exception using errcode='22023',message='Invalid policy amount'; end if;
    if field=any(array['perKm','perMinute','minimumTravel','difficultAccess','height','stairs','noParking','commercial','office']) and amount<>round(amount,2) then raise exception using errcode='22023',message='Currency cents required'; end if;
  end loop;
  if (p_policy->>'safetyRate')::numeric<>0.30 or (p_policy->>'platformFeeRate')::numeric>0.5 or (p_policy->>'paymentCostRate')::numeric>0.5
    or (p_policy->>'priorityMultiplier')::numeric not between 1.01 and 2 or (p_policy->>'laborIndex')::numeric not between 1 and 10
    or (p_policy->>'inverterRate')::numeric>1 or (p_policy->>'quoteValidityMinutes')::numeric not between 5 and 1440
    or (p_policy->>'quoteValidityMinutes')::numeric<>trunc((p_policy->>'quoteValidityMinutes')::numeric)
    or jsonb_typeof(p_policy->'laborOverrides') is distinct from 'object' then raise exception using errcode='22023',message='Invalid policy bounds'; end if;
  for field,amount in select key,value::numeric from jsonb_each_text(p_policy->'laborOverrides') loop
    if field<>all(array['maintenance','deep_maintenance','leak','board','capacitor','reversing_valve','uninstall','installation_2250','installation_4500','installation_6000','installation_8000','installation_9000','installation_18000'])
      or amount<=0 or amount>100000000 or amount<>round(amount,2) then raise exception using errcode='22023',message='Invalid labor override'; end if;
  end loop;
  insert into private.quote_policy_versions(revision,policy,created_by,reason) values(current_revision+1,p_policy,actor,trim(p_reason)) returning id into new_id;
  update private.quote_policy_current set policy_id=new_id where singleton;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(actor,'pricing.policy.approved','quote_policy',new_id,jsonb_build_object('revision',current_revision+1,'reason',trim(p_reason),'source',p_policy->>'source','approvedUntil',p_policy->>'approvedUntil'));
  return jsonb_build_object('id',new_id,'revision',current_revision+1,'policy',p_policy);
end; $$;
create function public.update_quote_policy_v2(p_policy jsonb,p_expected_revision integer,p_reason text) returns jsonb language sql security invoker set search_path='' as $$ select private.update_quote_policy_v2(p_policy,p_expected_revision,p_reason); $$;

alter table public.service_quotes add column revision integer not null default 1 check(revision>0);
alter table public.service_quotes add column version integer not null default 1 check(version>0);
alter table public.service_quotes add column root_quote_id uuid references public.service_quotes(id);
alter table public.service_quotes add column previous_quote_id uuid unique references public.service_quotes(id);
alter table public.service_quotes add column created_by uuid references public.profiles(id);
alter table public.service_quotes add column revision_reason text;
alter table public.service_quotes add column manual_route_reason text;
alter table public.service_quotes add column policy_id uuid references private.quote_policy_versions(id);
alter table public.service_quotes add column policy_snapshot jsonb;
alter table public.service_quotes add column acceptance_result jsonb;
-- The historical snapshot remains untouched. New writes must carry their lineage.
alter table public.service_quotes drop constraint service_quotes_status_check;
alter table public.service_quotes add constraint service_quotes_status_check check(status in ('needs_review','ready','accepted','superseded'));
create unique index service_quotes_root_revision on public.service_quotes(root_quote_id,revision);
create index service_quotes_policy_idx on public.service_quotes(policy_id);
create index service_quotes_created_by_idx on public.service_quotes(created_by);
revoke insert on public.service_quotes from service_role;
create or replace function private.protect_service_quote() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='accepted' or new.customer_id is distinct from old.customer_id or new.address is distinct from old.address
    or new.input is distinct from old.input or new.quote is distinct from old.quote or new.preferred_date is distinct from old.preferred_date
    or new.time_window is distinct from old.time_window or new.expires_at is distinct from old.expires_at
    or new.root_quote_id is distinct from old.root_quote_id or new.previous_quote_id is distinct from old.previous_quote_id
    or new.revision is distinct from old.revision or new.created_by is distinct from old.created_by
    or new.revision_reason is distinct from old.revision_reason or new.manual_route_reason is distinct from old.manual_route_reason
    or new.policy_id is distinct from old.policy_id or new.policy_snapshot is distinct from old.policy_snapshot
    or new.created_at is distinct from old.created_at then raise exception using errcode='42501',message='Quote snapshot is immutable'; end if;
  new.version=old.version+1;
  return new;
end; $$;

-- Only the server calculator can call this. Authority is reconstructed from the
-- locked, live Auth session; no actor/role claim from the HTTP body is accepted.
create function private.persist_calculated_quote(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; actor_role text; session_aal text; old_claims text; q public.service_quotes%rowtype; policy uuid; value jsonb;
  new_id uuid=gen_random_uuid(); root_id uuid; revision_number integer=1; prior uuid;
begin
  perform pg_advisory_xact_lock(537975841827451329::bigint);
  select u.raw_app_meta_data->>'app_role',s.aal::text into actor_role,session_aal
    from auth.sessions s join auth.users u on u.id=s.user_id where s.id=p_actor_session_id and u.id=p_actor_user_id for share of s,u;
  if not found or not private.session_is_active(p_actor_user_id,p_actor_session_id) or actor_role not in ('customer','admin') then raise exception using errcode='42501',message='Current session required'; end if;
  old_claims=current_setting('request.jwt.claims',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_user_id,'session_id',p_actor_session_id,'aal',session_aal,'app_metadata',jsonb_build_object('app_role',actor_role))::text,true);
  actor=case when actor_role='admin' then private.lock_admin_mutation('operations') else private.current_profile_id() end;
  if actor is null or (actor_role='customer' and p_customer_id is distinct from private.current_customer_id()) then raise exception using errcode='42501',message='Quote customer authority required'; end if;
  perform 1 from public.customer_profiles cp join public.profiles p on p.id=cp.profile_id join auth.users u on u.id=p.auth_user_id
    where cp.id=p_customer_id and p.role='customer' and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) for share of cp,p,u;
  if not found then raise exception using errcode='42501',message='Active customer required'; end if;
  select c.policy_id,v.policy into policy,value from private.quote_policy_current c left join private.quote_policy_versions v on v.id=c.policy_id where c.singleton for share of c;
  if (p_payload->>'policyId')::uuid is distinct from policy or (policy is not null and p_payload->'policySnapshot' is distinct from value) then raise exception using errcode='40001',message='Policy changed while calculating'; end if;
  if p_payload->'quote'->>'currency' is distinct from 'ARS' or jsonb_typeof(p_payload->'policySnapshot') is distinct from 'object'
    or (policy is null and p_payload->'policySnapshot'->>'approvedUntil' is not null)
    or p_payload->'quote'->>'version' is distinct from p_payload->'policySnapshot'->>'version'
    or (p_payload->>'expiresAt')::timestamptz<=now()
    or ((p_payload->>'preferredDate')::date+substring(p_payload->>'timeWindow' from '^\d{2}:\d{2}')::time) at time zone 'America/Argentina/Buenos_Aires'<=now()
    then raise exception using errcode='22023',message='Invalid calculated quote'; end if;
  if p_payload->'input'->'route'->>'source'='manual' and (actor_role<>'admin' or length(trim(coalesce(p_payload->>'manualRouteReason',''))) not between 15 and 2000) then raise exception using errcode='22023',message='Attributed manual route required'; end if;
  prior=(p_payload->>'previousQuoteId')::uuid;
  if prior is not null then
    if actor_role<>'admin' then raise exception using errcode='42501',message='Operations revision required'; end if;
    select * into q from public.service_quotes where id=prior and customer_id=p_customer_id for update;
    if not found then raise exception using errcode='P0002',message='Quote unavailable'; end if;
    if q.version is distinct from (p_payload->>'expectedVersion')::integer or q.status in ('accepted','superseded') then raise exception using errcode='40001',message='Quote version changed'; end if;
    if length(trim(coalesce(p_payload->>'revisionReason',''))) not between 15 and 2000 then raise exception using errcode='22023',message='Revision reason required'; end if;
    root_id=coalesce(q.root_quote_id,q.id);revision_number=q.revision+1;
    update public.service_quotes set status='superseded' where id=q.id;
  else root_id=new_id; end if;
  insert into public.service_quotes(id,customer_id,address,input,quote,preferred_date,time_window,status,expires_at,root_quote_id,previous_quote_id,revision,created_by,revision_reason,manual_route_reason,policy_id,policy_snapshot)
    values(new_id,p_customer_id,p_payload->'address',p_payload->'input',p_payload->'quote',(p_payload->>'preferredDate')::date,p_payload->>'timeWindow','needs_review',(p_payload->>'expiresAt')::timestamptz,root_id,prior,revision_number,actor,p_payload->>'revisionReason',p_payload->>'manualRouteReason',policy,p_payload->'policySnapshot');
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(actor,'pricing.quote.calculated','service_quote',new_id,jsonb_build_object('revision',revision_number,'previousQuoteId',prior,'policyId',policy,'reason',p_payload->>'revisionReason','manualRouteReason',p_payload->>'manualRouteReason'));
  perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
  return jsonb_build_object('id',new_id,'revision',revision_number,'version',1,'status','needs_review');
end; $$;
create function public.persist_calculated_quote(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid,p_payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.persist_calculated_quote(p_actor_user_id,p_actor_session_id,p_customer_id,p_payload); $$;

-- Old entrypoints cannot supply expected versions or current policy evidence.
revoke all on function public.update_quote_policy(jsonb),private.update_quote_policy(jsonb),public.review_service_quote(uuid,text),private.review_service_quote(uuid,text),public.submit_service_quote(uuid),private.submit_service_quote(uuid) from public,anon,authenticated,service_role;
revoke all on function public.get_quote_policy_record(),private.get_quote_policy_record(),public.update_quote_policy_v2(jsonb,integer,text),private.update_quote_policy_v2(jsonb,integer,text),public.persist_calculated_quote(uuid,uuid,uuid,jsonb),private.persist_calculated_quote(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.get_quote_policy_record(),private.get_quote_policy_record(),public.update_quote_policy_v2(jsonb,integer,text),private.update_quote_policy_v2(jsonb,integer,text) to authenticated;
grant execute on function public.persist_calculated_quote(uuid,uuid,uuid,jsonb),private.persist_calculated_quote(uuid,uuid,uuid,jsonb) to service_role;
