create or replace function private.is_owner_maintenance_test_quote(
  p_customer_id uuid,
  p_input jsonb,
  p_quote jsonb
) returns boolean
language sql stable security definer set search_path='' as $$
  select p_input->>'issue'='mantenimiento'
    and p_quote->'specialPricing'=jsonb_build_object('kind','owner_maintenance_test','amount',1000)
    and (p_quote->>'total')::numeric=1000
    and (p_quote->>'platformFeeRate')::numeric=0.18
    and (p_quote->>'platformFee')::numeric=180
    and (p_quote->>'professionalAmount')::numeric=820
    and (p_quote->>'platformContribution')::numeric=180
    and exists (
      select 1
      from public.customer_profiles cp
      join public.profiles p on p.id=cp.profile_id
      join auth.users u on u.id=p.auth_user_id
      where cp.id=p_customer_id
        and lower(btrim(u.email))='quimey_boca@hotmail.com'
        and u.email_confirmed_at is not null
        and u.deleted_at is null
        and (u.banned_until is null or u.banned_until<=now())
    );
$$;
revoke all on function private.is_owner_maintenance_test_quote(uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

create or replace function private.guard_owner_maintenance_test_quote() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and new.quote->'specialPricing' is distinct from old.quote->'specialPricing' then
    raise exception using errcode='42501',message='Owner test pricing is immutable';
  end if;
  if new.quote ? 'specialPricing'
    and not private.is_owner_maintenance_test_quote(new.customer_id,new.input,new.quote) then
    raise exception using errcode='42501',message='Owner maintenance test price is not authorized';
  end if;
  if tg_op='INSERT' and new.quote ? 'specialPricing' then
    insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
      values(new.created_by,'pricing.owner_test_price.applied','service_quote',new.id,
        jsonb_build_object('amount',1000,'platformFee',180,'professionalAmount',820));
  end if;
  return new;
end; $$;
revoke all on function private.guard_owner_maintenance_test_quote() from public,anon,authenticated,service_role;
drop trigger if exists service_quotes_owner_test_price_guard on public.service_quotes;
create trigger service_quotes_owner_test_price_guard
  before insert or update of quote,input,customer_id on public.service_quotes
  for each row execute function private.guard_owner_maintenance_test_quote();

create or replace function private.assert_quote_offerable(p_quote_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare q public.service_quotes%rowtype; policy uuid; value jsonb; route jsonb; owner_test boolean;
begin
  select * into q from public.service_quotes where id=p_quote_id;
  select c.policy_id,v.policy into policy,value
    from private.quote_policy_current c
    left join private.quote_policy_versions v on v.id=c.policy_id
    where c.singleton for share of c;
  owner_test=private.is_owner_maintenance_test_quote(q.customer_id,q.input,q.quote);
  if q.id is null or q.policy_id is distinct from policy
    or (policy is not null and q.policy_snapshot is distinct from value)
    or (not owner_test and (policy is null or value->>'approvedUntil' is null
      or (value->>'approvedUntil')::date < (now() at time zone 'America/Argentina/Buenos_Aires')::date))
    then raise exception using errcode='22023',message='Current approved tariff required'; end if;
  if q.expires_at<=now() or ((q.preferred_date+substring(q.time_window from '^\d{2}:\d{2}')::time) at time zone 'America/Argentina/Buenos_Aires')<=now()
    then raise exception using errcode='22023',message='Quote expired: recalculate'; end if;
  perform private.validate_quote_uploads(q.customer_id,q.upload_intent_ids);
  route=q.quote->'route';
  if q.quote->>'currency' is distinct from 'ARS' or q.quote->>'coverage' is distinct from 'covered'
    or coalesce(route->>'source','') not in ('manual','google') or coalesce(route->>'province','') not in ('CABA','Buenos Aires')
    or coalesce((route->>'outboundMinutes')::numeric,10000)>180
    or coalesce((route->>'tollsVerified')::boolean,false)=false
    or coalesce((q.input->>'materialsConfirmed')::boolean,false)=false
    or route->>'measuredAt' is null or (route->>'measuredAt')::timestamptz<now()-interval '30 minutes' or (route->>'measuredAt')::timestamptz>now()+interval '1 minute'
    or (route->>'source'='manual' and (q.created_by is null or length(trim(coalesce(q.manual_route_reason,'')))<15))
    or q.input->'equipment'->>'capacity' is null or coalesce(q.input->'equipment'->>'technology','unknown') not in ('conventional','inverter')
    or (not owner_test and coalesce((q.quote->>'professionalAmount')::numeric,-1)-coalesce((q.quote->>'paymentCostBudget')::numeric,1000000000)<coalesce((q.quote->>'calculatorSubtotal')::numeric,1000000000))
    or coalesce((q.quote->>'platformContribution')::numeric,-1)<0
    then raise exception using errcode='22023',message='Verified complete quote inputs required'; end if;
end; $$;
revoke all on function private.assert_quote_offerable(uuid) from public,anon,authenticated,service_role;

create or replace function public.get_job_professional_name(p_job_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare v_job public.jobs%rowtype; v_role public.user_role:=public.current_user_role(); v_profile_id uuid:=private.current_profile_id();
begin
  if v_role is null or v_profile_id is null then
    raise exception using errcode='P0002',message='job_not_found';
  end if;
  select * into v_job from public.jobs where id=p_job_id;
  if not found or (
    (v_role='customer' and v_job.customer_id=private.current_customer_id()) or
    (v_role='professional' and v_job.professional_id=private.current_professional_id(false)) or
    (v_role='admin' and private.has_admin_permission('operations'))
  ) is not true then
    raise exception using errcode='P0002',message='job_not_found';
  end if;
  if v_job.professional_id is null then return null; end if;
  return (
    select left(coalesce(nullif(btrim(concat_ws(' ',nullif(btrim(p.first_name),''),
      case when nullif(btrim(p.last_name),'') is null then null else left(btrim(p.last_name),1)||'.' end)),''),'Profesional Lysto'),160)
    from public.professional_profiles pro join public.profiles p on p.id=pro.profile_id
    where pro.id=v_job.professional_id
  );
end; $$;
revoke all on function public.get_job_professional_name(uuid) from public,anon;
grant execute on function public.get_job_professional_name(uuid) to authenticated;
