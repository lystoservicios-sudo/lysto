-- A server-calculated quote is immutable; decisions and onsite faults are separate.
create table public.service_quotes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customer_profiles(id),
  address jsonb not null check (jsonb_typeof(address) = 'object'),
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  quote jsonb not null check (jsonb_typeof(quote) = 'object'),
  preferred_date date not null,
  time_window text not null,
  status text not null check (status in ('needs_review', 'ready', 'accepted')),
  expires_at timestamptz not null,
  request_id uuid unique references public.service_requests(id),
  reviewed_by uuid references public.profiles(id),
  review_reason text,
  reviewed_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint service_quotes_financials check (
    coalesce((quote->>'total')::numeric > 0
    and (quote->>'safetyRate')::numeric = 0.30
    and (quote->>'total')::numeric = (quote->>'calculatorSubtotal')::numeric + round((quote->>'calculatorSubtotal')::numeric * 0.30, 2)
    and (quote->>'professionalAmount')::numeric >= (quote->>'calculatorSubtotal')::numeric
    and (quote->>'platformFee')::numeric >= 0
    and (quote->>'total')::numeric = (quote->>'professionalAmount')::numeric + (quote->>'platformFee')::numeric, false)
  ),
  constraint service_quotes_decision check ((status = 'accepted') = (request_id is not null and accepted_at is not null))
);
create index service_quotes_customer_created_idx on public.service_quotes(customer_id, created_at desc);
alter table public.service_quotes enable row level security;
revoke all on public.service_quotes from anon, authenticated, service_role;
grant select on public.service_quotes to authenticated;
grant select, insert on public.service_quotes to service_role;
create policy quotes_read on public.service_quotes for select to authenticated using (
  customer_id = (select private.current_customer_id()) or private.has_admin_permission('operations') or private.has_admin_permission('finance')
  or exists (select 1 from public.jobs j where j.request_id = service_quotes.request_id and j.professional_id = private.current_professional_id())
);

create function private.protect_service_quote() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.customer_id is distinct from old.customer_id or new.address is distinct from old.address
     or new.input is distinct from old.input or new.quote is distinct from old.quote
     or new.preferred_date is distinct from old.preferred_date or new.time_window is distinct from old.time_window
     or new.expires_at is distinct from old.expires_at or old.status = 'accepted' then
    raise exception 'Quote snapshot is immutable';
  end if;
  return new;
end;
$$;
create trigger service_quotes_immutable before update on public.service_quotes for each row execute function private.protect_service_quote();

create function private.review_service_quote(p_quote_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.service_quotes%rowtype;
begin
  if not private.has_admin_permission('operations') then raise exception 'Operations permission required'; end if;
  if length(trim(coalesce(p_reason,''))) < 15 then raise exception 'Document verified scope, costs and exclusions'; end if;
  select * into q from public.service_quotes where id = p_quote_id for update;
  if q.id is null or q.status = 'accepted' then raise exception 'Quote unavailable'; end if;
  if q.expires_at <= now() then raise exception 'Quote expired: recalculate'; end if;
  if q.quote->>'coverage' is distinct from 'covered' or q.quote->'route'->>'source' = 'simulation'
     or coalesce((q.quote->>'platformContribution')::numeric, -1) < 0 then raise exception 'Quote cannot be offered'; end if;
  -- Missing materials must be priced or explicitly confirmed as unnecessary before review.
  if coalesce((q.input->>'materialsConfirmed')::boolean, false) = false then raise exception 'Confirm material scope before review'; end if;
  if coalesce((q.quote->'route'->>'tollsVerified')::boolean, false) = false then raise exception 'Verify tolls before review'; end if;
  update public.service_quotes set status = 'ready', reviewed_by = private.current_profile_id(), review_reason = trim(p_reason), reviewed_at = now() where id = q.id;
  return jsonb_build_object('id', q.id, 'status', 'ready');
end;
$$;

create function private.submit_service_quote(p_quote_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.service_quotes%rowtype; cid uuid := private.current_customer_id(); category uuid; issue uuid; address_id uuid; req uuid; price_id uuid; job_id uuid;
begin
  if cid is null then raise exception 'Customer role required'; end if;
  select * into q from public.service_quotes where id = p_quote_id and customer_id = cid for update;
  if q.id is null then raise exception 'Quote unavailable'; end if;
  if q.status = 'accepted' then return jsonb_build_object('request_id', q.request_id, 'duplicate', true); end if;
  if q.status <> 'ready' then raise exception 'Quote requires review'; end if;
  if q.expires_at <= now() or q.preferred_date < current_date then raise exception 'Quote expired: recalculate'; end if;
  if q.quote->>'coverage' is distinct from 'covered' then raise exception 'Outside coverage'; end if;
  select id into category from public.service_categories where slug = 'aire_acondicionado' and active;
  select id into issue from public.service_issue_types where category_id = category and slug = q.input->>'issue' and active;
  if issue is null then raise exception 'Service unavailable'; end if;
  insert into public.customer_addresses(customer_id,street,number,city,province,property_type,has_elevator,has_parking,stairs_required,outdoor_unit_at_height,difficult_access,floor,apartment,reference,postal_code,outdoor_unit_on_balcony)
  values(cid,q.address->>'street',q.address->>'number',q.address->>'city',q.address->>'province',(q.input->>'propertyType')::public.property_type,
    (q.input->'access'->>'hasElevator')::boolean,(q.input->'access'->>'hasParking')::boolean,(q.input->'access'->>'stairsRequired')::boolean,
    (q.input->'access'->>'outdoorUnitAtHeight')::boolean,(q.input->'access'->>'difficultAccess')::boolean,
    q.address->>'floor',q.address->>'apartment',q.address->>'reference',q.address->>'postalCode',(q.input->'access'->>'outdoorUnitOnBalcony')::boolean) returning id into address_id;
  insert into public.service_requests(customer_id,category_id,issue_type_id,address_id,status,time_since,preferred_date,preferred_time_window,urgency_level,submitted_at)
  values(cid,category,issue,address_id,'pending_assignment',q.input->>'timeSince',q.preferred_date,q.time_window,(q.input->>'urgency')::public.urgency_level,now()) returning id into req;
  insert into public.price_options(request_id,option_type,title,description,amount,platform_fee,professional_amount,selected)
  values(req,(q.input->>'urgency')::public.urgency_level,'Presupuesto Lysto',q.quote->>'scope',(q.quote->>'total')::numeric,(q.quote->>'platformFee')::numeric,(q.quote->>'professionalAmount')::numeric,true) returning id into price_id;
  update public.service_requests set selected_price_option_id = price_id where id = req;
  insert into public.jobs(request_id,customer_id,status,scheduled_date,scheduled_time_window,final_amount)
  values(req,cid,'pending_assignment',q.preferred_date,q.time_window,(q.quote->>'total')::numeric) returning id into job_id;
  insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata)
  values(job_id,'pending_assignment',private.current_profile_id(),'Cliente aceptó presupuesto; pendiente de profesional. No implica pago.',jsonb_build_object('quote_id',q.id));
  update public.service_quotes set status='accepted',request_id=req,accepted_at=now() where id=q.id;
  return jsonb_build_object('request_id',req,'job_id',job_id,'status','pending_assignment','duplicate',false);
end;
$$;

create table public.job_extras (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references public.jobs(id),
  professional_id uuid not null references public.professional_profiles(id),
  fault text not null check (length(trim(fault)) between 5 and 500),
  description text not null check (length(trim(description)) between 10 and 2000),
  amount numeric(12,2) not null check (amount > 0 and amount <= 100000000),
  platform_fee numeric(12,2) generated always as (0::numeric) stored,
  safety_amount numeric(12,2) generated always as (0::numeric) stored,
  professional_amount numeric(12,2) generated always as (amount) stored,
  status text not null default 'proposed' check(status in ('proposed','accepted','rejected')),
  idempotency_key uuid not null,
  decided_by uuid references public.profiles(id), decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique(professional_id,idempotency_key),
  check ((status = 'proposed') = (decided_at is null and decided_by is null))
);
create index job_extras_job_idx on public.job_extras(job_id,created_at);
alter table public.job_extras enable row level security;
revoke all on public.job_extras from anon, authenticated, service_role;
grant select on public.job_extras to authenticated;
create policy extras_read on public.job_extras for select to authenticated using (
  exists (select 1 from public.jobs j where j.id = job_extras.job_id and (j.customer_id = private.current_customer_id() or j.professional_id = private.current_professional_id()))
  or private.has_admin_permission('operations') or private.has_admin_permission('finance')
);

create function private.propose_job_extra(p_job_id uuid,p_fault text,p_description text,p_amount numeric,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j public.jobs%rowtype; e public.job_extras%rowtype; pro uuid := private.current_professional_id(true);
begin
  select * into j from public.jobs where id=p_job_id for update;
  if pro is null or j.id is null or j.professional_id is distinct from pro then raise exception 'Assigned approved professional required'; end if;
  if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount <= 0 or p_amount > 100000000 or round(p_amount,2) <> p_amount then raise exception 'Invalid extra amount'; end if;
  select * into e from public.job_extras where professional_id=pro and idempotency_key=p_idempotency_key;
  if e.id is not null then
    if e.job_id <> p_job_id or e.fault <> trim(p_fault) or e.description <> trim(p_description) or e.amount <> p_amount then raise exception 'Idempotency conflict'; end if;
    return to_jsonb(e);
  end if;
  if j.status not in ('arrived','onsite_diagnosis','waiting_customer_approval','in_progress') then raise exception 'Extra must be recorded during visit'; end if;
  insert into public.job_extras(job_id,professional_id,fault,description,amount,idempotency_key)
  values(j.id,pro,trim(p_fault),trim(p_description),p_amount,p_idempotency_key) returning * into e;
  insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata)
  values(j.id,j.status,private.current_profile_id(),'Falla adicional propuesta; pendiente de aceptación del cliente',jsonb_build_object('extra_id',e.id,'amount',e.amount,'commission',0,'event','extra.proposed'));
  return to_jsonb(e);
end;
$$;

create function private.decide_job_extra(p_extra_id uuid,p_decision text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare e public.job_extras%rowtype; j public.jobs%rowtype; cid uuid := private.current_customer_id();
begin
  if cid is null then raise exception 'Customer role required'; end if;
  if p_decision is null or p_decision not in ('accepted','rejected') then raise exception 'Invalid decision'; end if;
  select j0.* into j from public.jobs j0 join public.job_extras e0 on e0.job_id=j0.id where e0.id=p_extra_id for update of j0;
  if j.id is null or j.customer_id is distinct from cid then raise exception 'Extra unavailable'; end if;
  select * into e from public.job_extras where id=p_extra_id for update;
  if e.status = p_decision then return to_jsonb(e); end if;
  if e.status <> 'proposed' then raise exception 'Extra already decided'; end if;
  if j.professional_id is distinct from e.professional_id or j.status not in ('arrived','onsite_diagnosis','waiting_customer_approval','in_progress') then raise exception 'Extra no longer actionable'; end if;
  update public.job_extras set status=p_decision,decided_by=private.current_profile_id(),decided_at=now() where id=e.id returning * into e;
  -- The initial payment, quote and platform commission deliberately stay unchanged.
  insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata)
  values(j.id,j.status,private.current_profile_id(),'Cliente decidió sobre trabajo adicional',jsonb_build_object('extra_id',e.id,'amount',e.amount,'commission',0,'event','extra.'||p_decision));
  return to_jsonb(e);
end;
$$;

create function private.get_quote_policy() returns jsonb language sql security definer set search_path = '' as $$
  select value from public.platform_settings where key='pricing.calculator.v1';
$$;
create function private.update_quote_policy(p_policy jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_admin_permission('finance') then raise exception 'Finance permission required'; end if;
  if coalesce((p_policy->>'safetyRate')::numeric,0) <> 0.30 or coalesce(p_policy->>'version','') = '' then raise exception 'Invalid calculator policy'; end if;
  insert into public.platform_settings(key,value,description) values('pricing.calculator.v1',p_policy,'Versioned service pricing policy')
  on conflict(key) do update set value=excluded.value;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,metadata)
  values(private.current_profile_id(),'pricing.policy.updated','platform_settings',p_policy);
  return p_policy;
end;
$$;

create function public.review_service_quote(p_quote_id uuid,p_reason text) returns jsonb language sql security invoker set search_path='' as $$ select private.review_service_quote(p_quote_id,p_reason); $$;
create function public.submit_service_quote(p_quote_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.submit_service_quote(p_quote_id); $$;
create function public.propose_job_extra(p_job_id uuid,p_fault text,p_description text,p_amount numeric,p_idempotency_key uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.propose_job_extra(p_job_id,p_fault,p_description,p_amount,p_idempotency_key); $$;
create function public.decide_job_extra(p_extra_id uuid,p_decision text) returns jsonb language sql security invoker set search_path='' as $$ select private.decide_job_extra(p_extra_id,p_decision); $$;
create function public.get_quote_policy() returns jsonb language sql security invoker set search_path='' as $$ select private.get_quote_policy(); $$;
create function public.update_quote_policy(p_policy jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.update_quote_policy(p_policy); $$;
revoke all on function public.review_service_quote(uuid,text),private.review_service_quote(uuid,text),public.submit_service_quote(uuid),private.submit_service_quote(uuid),public.propose_job_extra(uuid,text,text,numeric,uuid),private.propose_job_extra(uuid,text,text,numeric,uuid),public.decide_job_extra(uuid,text),private.decide_job_extra(uuid,text),public.get_quote_policy(),private.get_quote_policy(),public.update_quote_policy(jsonb),private.update_quote_policy(jsonb) from public,anon,service_role;
grant execute on function public.review_service_quote(uuid,text),private.review_service_quote(uuid,text),public.submit_service_quote(uuid),private.submit_service_quote(uuid),public.propose_job_extra(uuid,text,text,numeric,uuid),private.propose_job_extra(uuid,text,text,numeric,uuid),public.decide_job_extra(uuid,text),private.decide_job_extra(uuid,text),public.get_quote_policy(),private.get_quote_policy(),public.update_quote_policy(jsonb),private.update_quote_policy(jsonb) to authenticated;
revoke all on function private.protect_service_quote() from public,anon,authenticated,service_role;

-- Retire the legacy pricing entrypoint, including direct PostgREST calls.
revoke execute on function public.create_service_request_from_app(uuid,uuid,text,text,text,date,text,public.urgency_level,jsonb,numeric,numeric,numeric),
  private.create_service_request_from_app(uuid,uuid,text,text,text,date,text,public.urgency_level,jsonb,numeric,numeric,numeric)
  from public,anon,authenticated,service_role;

create function private.protect_quoted_address() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists (select 1 from public.service_requests r join public.service_quotes q on q.request_id=r.id where r.address_id=old.id and q.status='accepted')
     and (to_jsonb(new) - 'updated_at' - 'is_default') is distinct from (to_jsonb(old) - 'updated_at' - 'is_default') then
    raise exception 'Accepted quote address is immutable: request a new quote';
  end if;
  return new;
end;
$$;
revoke all on function private.protect_quoted_address() from public,anon,authenticated,service_role;
create trigger customer_addresses_protect_quote before update on public.customer_addresses for each row execute function private.protect_quoted_address();

-- Secure visit progression for jobs created from an accepted quote.
create function private.advance_service_job(p_job_id uuid,p_expected_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.jobs%rowtype; next_status public.job_status; pro uuid := private.current_professional_id(true);
begin
  select * into j from public.jobs where id=p_job_id for update;
  if pro is null or j.id is null or j.professional_id is distinct from pro then raise exception 'Assigned professional required'; end if;
  if j.status::text is distinct from p_expected_status then raise exception 'Job status changed: refresh before continuing'; end if;
  next_status := case j.status when 'confirmed' then 'technician_on_way'::public.job_status when 'technician_on_way' then 'arrived'::public.job_status when 'arrived' then 'onsite_diagnosis'::public.job_status when 'onsite_diagnosis' then 'in_progress'::public.job_status end;
  if next_status is null then raise exception 'No visit transition available'; end if;
  if next_status='in_progress' and exists(select 1 from public.job_extras where job_id=j.id and status='proposed') then raise exception 'Customer decision pending on additional work'; end if;
  update public.jobs set status=next_status,technician_on_way_at=case when next_status='technician_on_way' then now() else technician_on_way_at end,
    arrived_at=case when next_status='arrived' then now() else arrived_at end,started_at=case when next_status='in_progress' then now() else started_at end where id=j.id;
  return jsonb_build_object('job_id',j.id,'status',next_status);
end;
$$;
create function public.advance_service_job(p_job_id uuid,p_expected_status text) returns jsonb language sql security invoker set search_path='' as $$ select private.advance_service_job(p_job_id,p_expected_status); $$;
revoke all on function public.advance_service_job(uuid,text),private.advance_service_job(uuid,text) from public,anon,service_role;
grant execute on function public.advance_service_job(uuid,text),private.advance_service_job(uuid,text) to authenticated;
