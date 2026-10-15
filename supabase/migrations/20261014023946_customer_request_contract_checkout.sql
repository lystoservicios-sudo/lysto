-- A separate, explicit initial-labor contract. Legacy quote review and genuine
-- professional acceptance are unchanged. Publishing this migration enables no
-- commercial policy, tariff, seller or production charge.
create table private.customer_request_policy_versions (
  id uuid primary key default gen_random_uuid(), quote_policy_id uuid not null references private.quote_policy_versions(id),
  scopes jsonb not null check(jsonb_typeof(scopes)='object'), approved_until timestamptz not null,
  approved_by uuid not null references public.profiles(id), reason text not null check(length(btrim(reason)) between 15 and 2000),
  created_at timestamptz not null default clock_timestamp()
);
create table private.customer_request_policy_current (
  singleton boolean primary key default true check(singleton), enabled boolean not null default false,
  policy_id uuid references private.customer_request_policy_versions(id), version integer not null default 0 check(version>=0)
);
insert into private.customer_request_policy_current(singleton) values(true);
create index customer_request_policy_quote_idx on private.customer_request_policy_versions(quote_policy_id);
alter table private.customer_request_policy_versions enable row level security;
alter table private.customer_request_policy_current enable row level security;
revoke all on private.customer_request_policy_versions,private.customer_request_policy_current from public,anon,authenticated,service_role;

create table private.customer_request_previews (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id), input jsonb not null, context_snapshot jsonb not null,
  policy_id uuid not null references private.customer_request_policy_versions(id), quote_policy_id uuid not null references private.quote_policy_versions(id),
  professional_id uuid not null references public.professional_profiles(id), seller_account_id text not null,
  origin text not null, live_mode boolean not null, payload jsonb not null, expires_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp()
);
create index customer_request_previews_owner_idx on private.customer_request_previews(customer_id,created_at,id);
create index customer_request_previews_policy_idx on private.customer_request_previews(policy_id);
create index customer_request_previews_quote_policy_idx on private.customer_request_previews(quote_policy_id);
create index customer_request_previews_professional_idx on private.customer_request_previews(professional_id);
create index customer_request_previews_actor_idx on private.customer_request_previews(actor_profile_id);
create table private.customer_request_commands (
  customer_id uuid not null references public.customer_profiles(id) on delete cascade, command_id uuid not null,
  fingerprint jsonb not null, result jsonb not null, created_at timestamptz not null default clock_timestamp(),
  primary key(customer_id,command_id)
);
create table private.customer_request_contracts (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  preview_id uuid not null unique references private.customer_request_previews(id),
  quote_id uuid not null unique references public.service_quotes(id),
  professional_id uuid not null references public.professional_profiles(id),
  policy_id uuid not null references private.customer_request_policy_versions(id),
  state text not null default 'awaiting_payment' check(state in('awaiting_payment','paid','expired','payment_review')),
  accepted_by uuid not null references public.profiles(id), accepted_at timestamptz not null default clock_timestamp(),
  hold_expires_at timestamptz not null default clock_timestamp()+interval '30 minutes',
  paid_at timestamptz, contract_scope text not null default 'initial_labor' check(contract_scope='initial_labor')
);
create index customer_request_contracts_professional_idx on private.customer_request_contracts(professional_id);
create index customer_request_contracts_policy_idx on private.customer_request_contracts(policy_id);
create index customer_request_contracts_actor_idx on private.customer_request_contracts(accepted_by);
alter table private.customer_request_previews enable row level security;
alter table private.customer_request_commands enable row level security;
alter table private.customer_request_contracts enable row level security;
revoke all on private.customer_request_previews,private.customer_request_commands,private.customer_request_contracts from public,anon,authenticated,service_role;

alter table public.jobs add column automatic_assignment_at timestamptz;
alter table public.service_requests add column visit_address_id uuid,
  add column visit_address_snapshot jsonb check(visit_address_snapshot is null or jsonb_typeof(visit_address_snapshot)='object'),
  add column context_snapshot jsonb check(context_snapshot is null or jsonb_typeof(context_snapshot)='object'),
  add column contract_source text check(contract_source is null or contract_source='automatic_customer_request');
alter table public.service_requests add constraint service_requests_visit_address_owner_fk
  foreign key(visit_address_id,customer_id) references public.customer_addresses(id,customer_id);
alter table public.service_requests add constraint service_requests_canonical_equipment_owner_fk
  foreign key(equipment_id,customer_id) references public.customer_equipment(id,customer_id);
-- Keep the four-column historical location FK. The only new nullable-address
-- case is a validated automatic contract for owned, previously unlocated stock.
alter table public.service_requests drop constraint service_requests_equipment_requires_address;
alter table public.service_requests add constraint service_requests_equipment_requires_address check(
  equipment_id is null or address_id is not null or
  (contract_source='automatic_customer_request' and visit_address_id is not null and visit_address_snapshot is not null));
create index service_requests_visit_address_idx on public.service_requests(visit_address_id,customer_id);

-- SECURITY INVOKER is intentional: direct browser/service-role table writes
-- retain their database role, whereas the verified private writer runs as its
-- owner. A client cannot opt into the new FK exception by supplying a marker.
create function private.guard_customer_request_source() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if current_user in('anon','authenticated','service_role') then
    if tg_op='INSERT' then
      if new.contract_source is not null or new.visit_address_id is not null or new.visit_address_snapshot is not null or new.context_snapshot is not null then
        raise exception using errcode='42501',message='Verified automatic request writer required'; end if;
    elsif row(new.contract_source,new.visit_address_id,new.visit_address_snapshot,new.context_snapshot)
       is distinct from row(old.contract_source,old.visit_address_id,old.visit_address_snapshot,old.context_snapshot) then
      raise exception using errcode='42501',message='Verified automatic request writer required'; end if;
  end if;
  return new;
end; $$;
create trigger customer_request_source_guard before insert or update on public.service_requests
  for each row execute function private.guard_customer_request_source();
revoke all on function private.guard_customer_request_source() from public,anon,authenticated,service_role;

create function private.customer_request_actor(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_role text; v_aal text; v_actor uuid;
begin
  select u.raw_app_meta_data->>'app_role',s.aal::text into v_role,v_aal
    from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=p_actor_session_id and u.id=p_actor_user_id for share of s,u;
  if not found or v_role is distinct from 'customer' or not private.session_is_active(p_actor_user_id,p_actor_session_id) then
    raise exception using errcode='42501',message='Current customer session required'; end if;
  -- Asset writers serialize customer -> profile. Preserve that order while
  -- permitting canonical payment's customer FK KEY SHARE under its contract
  -- lock. Reading the joined profile does not acquire a profile row lock yet.
  perform 1 from public.customer_profiles c join public.profiles p on p.id=c.profile_id
    where c.id=p_customer_id and p.auth_user_id=p_actor_user_id and p.role='customer' for no key update of c;
  if not found then raise exception using errcode='42501',message='Active verified customer required'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',p_actor_user_id,'session_id',p_actor_session_id,
    'aal',v_aal,'app_metadata',jsonb_build_object('app_role','customer'))::text,true);
  select p.id into v_actor from public.customer_profiles c join public.profiles p on p.id=c.profile_id
    join auth.users u on u.id=p.auth_user_id where c.id=p_customer_id and p.auth_user_id=p_actor_user_id and p.role='customer'
    and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()) for share of p,u;
  if not found or p_customer_id is distinct from private.current_customer_id() then
    raise exception using errcode='42501',message='Active verified customer required'; end if;
  return v_actor;
end; $$;

create function private.customer_request_context_snapshot(p_customer_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.customer_addresses%rowtype; e public.customer_equipment%rowtype; h public.customer_homes%rowtype;
  r public.customer_home_rooms%rowtype; f public.customer_home_floors%rowtype; pl public.customer_equipment_placements%rowtype;
  v_capacity integer; v_technology text; v_declaration jsonb:=p_input->'equipmentDeclaration'; v_declared boolean:=false;
begin
  perform private.validate_asset_object(p_input,array['equipmentId','expectedEquipmentVersion','addressId','homeId','expectedHomeVersion',
    'floorId','roomId','equipmentDeclaration','issue','timeSince','description','answers','preferredDate','timeWindow','urgency','uploadIntentIds']);
  if coalesce(p_input->>'issue','')<>all(array['no_enfria','pierde_agua','hace_ruido','no_enciende','no_funciona_calor','instalacion','mantenimiento','unknown'])
    or coalesce(p_input->>'timeSince','')<>all(array['today','days','weeks','months'])
    or coalesce(p_input->>'urgency','') not in('flexible','priority')
    or length(coalesce(p_input->>'description',''))>2000
    or jsonb_typeof(p_input->'answers') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(p_input->'answers'))>20
    or exists(select 1 from jsonb_each(p_input->'answers') where key!~'^[a-z][a-z0-9_]{0,59}$'
      or key in('customer_description','constructor','prototype','__proto__') or jsonb_typeof(value) not in('string','boolean')
      or (jsonb_typeof(value)='string' and length(value#>>'{}')>500)) then
    raise exception using errcode='22023',message='Valid customer details required'; end if;
  select * into e from public.customer_equipment where id=(p_input->>'equipmentId')::uuid
    and customer_id=p_customer_id and archived_at is null for share;
  select * into a from public.customer_addresses where id=(p_input->>'addressId')::uuid
    and customer_id=p_customer_id and archived_at is null for share;
  if e.id is null or a.id is null then raise exception using errcode='P0002',message='Owned location unavailable'; end if;
  if e.version is distinct from (p_input->>'expectedEquipmentVersion')::integer then
    raise exception using errcode='40001',message='Equipment version changed'; end if;
  if nullif(p_input->>'homeId','') is not null then
    select * into h from public.customer_homes where id=(p_input->>'homeId')::uuid and customer_id=p_customer_id and archived_at is null for share;
    if h.id is null or h.current_address_id<>a.id then raise exception using errcode='P0002',message='Owned home unavailable'; end if;
    if h.version is distinct from (p_input->>'expectedHomeVersion')::integer then raise exception using errcode='40001',message='Home version changed'; end if;
  elsif p_input ? 'expectedHomeVersion' or p_input ? 'floorId' or p_input ? 'roomId' then
    raise exception using errcode='22023',message='Home context required';
  end if;
  if e.address_id is not null and e.address_id<>a.id and not exists(select 1 from public.customer_home_addresses
    where home_id=h.id and customer_id=p_customer_id and address_id=e.address_id and archived_at is null) then
    raise exception using errcode='22023',message='Equipment belongs to another location'; end if;
  select * into pl from public.customer_equipment_placements where equipment_id=e.id and customer_id=p_customer_id for share;
  if pl.equipment_id is not null and (pl.home_id is distinct from h.id or pl.room_id is distinct from (p_input->>'roomId')::uuid) then
    raise exception using errcode='40001',message='Equipment placement changed'; end if;
  if p_input ? 'roomId' or p_input ? 'floorId' then
    select * into r from public.customer_home_rooms where id=(p_input->>'roomId')::uuid and home_id=h.id and customer_id=p_customer_id for share;
    select * into f from public.customer_home_floors where id=(p_input->>'floorId')::uuid and home_id=h.id and customer_id=p_customer_id for share;
    if r.id is null or f.id is null or r.floor_id<>f.id then raise exception using errcode='P0002',message='Owned room unavailable'; end if;
  end if;
  v_capacity:=case when e.frigorias ~ '^\d{4,5}$' then e.frigorias::integer end;
  v_technology:=case e.equipment_type when 'inverter' then 'inverter' when 'on_off' then 'conventional' else 'unknown' end;
  if v_declaration is not null then
    perform private.validate_asset_object(v_declaration,array['capacity','technology']);
    if jsonb_typeof(v_declaration) is distinct from 'object' or coalesce(v_declaration->>'technology','') not in('unknown','conventional','inverter')
      or (v_declaration->'capacity'<>'null'::jsonb and (jsonb_typeof(v_declaration->'capacity') is distinct from 'number'
        or (v_declaration->>'capacity')::numeric not between 1000 and 30000
        or (v_declaration->>'capacity')::numeric<>trunc((v_declaration->>'capacity')::numeric))) then
      raise exception using errcode='22023',message='Invalid equipment declaration'; end if;
    if (v_capacity is not null and v_declaration->>'capacity' is not null and v_capacity<>(v_declaration->>'capacity')::integer)
      or (v_technology<>'unknown' and v_declaration->>'technology'<>'unknown' and v_technology<>v_declaration->>'technology') then
      raise exception using errcode='22023',message='Declaration contradicts canonical equipment'; end if;
    v_declared:=(v_capacity is null and v_declaration->>'capacity' is not null)
      or (v_technology='unknown' and v_declaration->>'technology'<>'unknown');
    v_capacity:=coalesce(v_capacity,(v_declaration->>'capacity')::integer);
    if v_technology='unknown' then v_technology:=v_declaration->>'technology'; end if;
  end if;
  return jsonb_build_object('address',private.customer_address_document(a),
    'equipment',jsonb_build_object('id',e.id,'version',e.version,'nickname',e.nickname,'addressId',e.address_id,
      'categoryId',e.category_id,'equipmentType',e.equipment_type,'capacity',v_capacity,'technology',v_technology,'declarationUsed',v_declared),
    'home',case when h.id is not null then jsonb_build_object('id',h.id,'version',h.version,'name',h.name,'kind',h.kind) end,
    'floor',case when f.id is not null then jsonb_build_object('id',f.id,'name',f.name) end,
    'room',case when r.id is not null then jsonb_build_object('id',r.id,'name',r.name,'kind',r.kind,'variant',r.variant) end,
    'placement',case when pl.equipment_id is not null then jsonb_build_object('wall',pl.wall,'offset',pl.wall_offset,'height',pl.height) end);
end; $$;

create function private.customer_request_candidate_is_eligible(
  p_category uuid,p_city text,p_professional uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_buffer integer
) returns boolean language sql stable security definer set search_path='' as $$
  select p_starts_at>clock_timestamp() and p_ends_at>p_starts_at
    and (p_starts_at at time zone 'America/Argentina/Buenos_Aires')::date=(p_ends_at at time zone 'America/Argentina/Buenos_Aires')::date
    and exists(select 1 from public.professional_profiles pro join public.profiles p on p.id=pro.profile_id join auth.users u on u.id=p.auth_user_id
      where pro.id=p_professional and pro.status='approved' and p.role='professional' and u.raw_app_meta_data->>'app_role'='professional'
      and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now()) and length(btrim(coalesce(pro.base_location,'')))>=5
      and private.professional_ready_for_new_work(pro.id) and private.professional_clearance_valid(pro.id))
    and exists(select 1 from public.professional_service_categories where professional_id=p_professional and category_id=p_category and approved)
    and exists(select 1 from public.professional_tools where professional_id=p_professional and has_tool)
    and exists(select 1 from public.mp_split_connected_accounts where seller_id=p_professional::text and enabled
      and (access_token_expires_at>clock_timestamp()+interval '5 minutes' or coalesce(length(btrim(encrypted_refresh_token)),0)>0))
    and exists(select 1 from public.professional_service_zones where professional_id=p_professional and active
      and (lower(zone_name)=lower(p_city) or lower(zone_slug)=regexp_replace(lower(p_city),'[^a-z0-9]+','_','g')))
    and exists(select 1 from public.professional_availability where professional_id=p_professional and active
      and weekday=extract(dow from p_starts_at at time zone 'America/Argentina/Buenos_Aires')::integer
      and start_time<=(p_starts_at at time zone 'America/Argentina/Buenos_Aires')::time
      and end_time>=(p_ends_at at time zone 'America/Argentina/Buenos_Aires')::time)
    and not exists(select 1 from public.professional_absences where professional_id=p_professional
      and tstzrange(starts_at,ends_at,'[)')&&tstzrange(p_starts_at-p_buffer*interval '1 minute',p_ends_at+p_buffer*interval '1 minute','[)'))
    and not exists(select 1 from public.job_schedule_reservations s where s.professional_id=p_professional
      and (s.state='confirmed' or (s.state='hold' and (s.hold_expires_at>clock_timestamp() or exists(
        select 1 from private.customer_request_contracts k join public.marketplace_checkouts c on c.job_id=k.job_id and c.extra_id is null
          where k.job_id=s.job_id and not private.checkout_is_financially_closed(c)))))
      and tstzrange(s.starts_at-s.travel_buffer_minutes*interval '1 minute',s.ends_at+s.travel_buffer_minutes*interval '1 minute','[)')
        &&tstzrange(p_starts_at-p_buffer*interval '1 minute',p_ends_at+p_buffer*interval '1 minute','[)'));
$$;

create function private.read_customer_request_context(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_claims text:=current_setting('request.jwt.claims',true); v_context jsonb; v_policy private.customer_request_policy_versions%rowtype;
  v_quote private.quote_policy_versions%rowtype; v_scope jsonb; v_reason text; v_start timestamptz; v_category uuid; v_candidates jsonb:='[]'::jsonb;
begin
  perform private.customer_request_actor(p_actor_user_id,p_actor_session_id,p_customer_id);
  v_context:=private.customer_request_context_snapshot(p_customer_id,p_input);
  perform private.validate_quote_uploads(p_customer_id,array(select value::uuid from jsonb_array_elements_text(coalesce(p_input->'uploadIntentIds','[]'::jsonb))));
  select q.* into v_quote from private.quote_policy_current c join private.quote_policy_versions q on q.id=c.policy_id where c.singleton;
  select p.* into v_policy from private.customer_request_policy_current c join private.customer_request_policy_versions p on p.id=c.policy_id
    where c.singleton and c.enabled and p.approved_until>clock_timestamp();
  v_scope:=v_policy.scopes->(p_input->>'issue');
  v_start:=((p_input->>'preferredDate')::date+substring(p_input->>'timeWindow' from '^\d{2}:\d{2}')::time) at time zone 'America/Argentina/Buenos_Aires';
  if v_start is null or v_start<=clock_timestamp() then raise exception using errcode='22023',message='Future visit preference required'; end if;
  if p_input->>'timeWindow'<>all(array['08:00 – 10:00','10:00 – 12:00','14:00 – 16:00','16:00 – 18:00','18:00 – 20:00']) then
    raise exception using errcode='22023',message='Invalid visit preference'; end if;
  if v_quote.id is null or v_quote.policy->>'approvedUntil' is null or
    (v_quote.policy->>'approvedUntil')::date<(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date then v_reason:='tariffs_unapproved';
  elsif v_policy.id is null or v_policy.quote_policy_id<>v_quote.id or v_scope is null then v_reason:='initial_scope_unavailable';
  elsif p_input->>'issue'='unknown' then v_reason:='diagnosis_required';
  elsif (v_context->'equipment'->>'capacity')::integer>18000 then v_reason:='capacity_outside_catalog';
  elsif v_context->'equipment'->>'capacity' is null or v_context->'equipment'->>'technology'='unknown' then v_reason:='equipment_unknown';
  elsif (v_context->'equipment'->>'declarationUsed')::boolean and not coalesce((v_scope->>'allowCustomerEquipmentDeclaration')::boolean,false) then v_reason:='equipment_declaration_requires_review';
  end if;
  select id into v_category from public.service_categories where slug='aire_acondicionado' and active;
  if v_reason is null and (v_category is null or v_context->'equipment'->>'categoryId' is distinct from v_category::text) then v_reason:='equipment_category_unavailable'; end if;
  if v_reason is null then
    select coalesce(jsonb_agg(candidate.document order by candidate.score desc,candidate.rating desc nulls last,candidate.id),'[]'::jsonb) into v_candidates
    from (select p.id,p.internal_score as score,p.rating_avg as rating,jsonb_build_object('professionalId',p.id,'origin',p.base_location,'sellerAccountId',m.mercado_pago_user_id) as document
      from public.professional_profiles p join public.mp_split_connected_accounts m on m.seller_id=p.id::text and m.enabled
      where private.customer_request_candidate_is_eligible(v_category,v_context->'address'->>'city',p.id,v_start,
        v_start+(v_scope->>'durationMinutes')::integer*interval '1 minute',(v_scope->>'travelBufferMinutes')::integer)
      order by p.internal_score desc,p.rating_avg desc nulls last,p.id limit 5) candidate;
    if jsonb_array_length(v_candidates)=0 then v_reason:='no_available_professional'; end if;
  end if;
  perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
  return jsonb_build_object('context',v_context,'policy',case when v_policy.id is not null and v_scope is not null then
    jsonb_build_object('id',v_policy.id,'quotePolicyId',v_policy.quote_policy_id,'approvedUntil',v_policy.approved_until,'scope',v_scope) end,
    'quotePolicy',jsonb_build_object('id',v_quote.id,'policy',v_quote.policy),'candidates',v_candidates,'reason',v_reason);
end; $$;

create function private.persist_customer_request_preview(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_claims text:=current_setting('request.jwt.claims',true); v_current jsonb; v_id uuid;
begin
  v_actor:=private.customer_request_actor(p_actor_user_id,p_actor_session_id,p_customer_id);
  v_current:=private.read_customer_request_context(p_actor_user_id,p_actor_session_id,p_customer_id,p_payload->'input');
  if v_current->>'reason' is not null then
    perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
    return jsonb_build_object('status',case when v_current->>'reason'='no_available_professional' then 'unavailable' else 'needs_review' end,'reason',v_current->>'reason'); end if;
  if v_current->'context' is distinct from p_payload->'context'
    or v_current->'policy'->>'id' is distinct from p_payload->>'policyId'
    or v_current->'quotePolicy'->>'id' is distinct from p_payload->>'quotePolicyId'
    or v_current->'quotePolicy'->'policy' is distinct from p_payload->'quotePolicySnapshot'
    or v_current->'policy'->'scope' is distinct from p_payload->'scope'
    or not exists(select 1 from jsonb_array_elements(v_current->'candidates') c where c->>'professionalId'=p_payload->>'professionalId'
      and c->>'sellerAccountId'=p_payload->>'sellerAccountId' and c->>'origin'=p_payload->>'origin') then
    raise exception using errcode='40001',message='Preview context changed'; end if;
  if p_payload->'quote'->>'currency' is distinct from 'ARS' or p_payload->'quote'->>'contractScope' is distinct from 'initial_labor'
    or p_payload->'quote'->'reviewReasons' is distinct from '[]'::jsonb or p_payload->'quote'->>'readyToOffer' is distinct from 'true'
    or p_payload->'route'->>'source' is distinct from 'google' or p_payload->'route'->>'tollsVerified' is distinct from 'true'
    or p_payload->'quote'->>'coverage' is distinct from 'covered' or p_payload->'calculatedInput'->>'materialsConfirmed' is distinct from 'false'
    or p_payload->'calculatedInput'->'materials' is distinct from '[]'::jsonb
    or p_payload->'quote'->'route'->>'origin' is distinct from 'Origen del profesional'
    or p_payload->'quote'->'route'->>'destination' is distinct from 'Dirección de visita'
    or p_payload->'calculatedInput'->'route' is distinct from p_payload->'quote'->'route'
    or ((p_payload->'quote'->'route')-array['origin','destination']) is distinct from ((p_payload->'route')-array['origin','destination'])
    or (p_payload->'quote'->>'total')::numeric<>round((p_payload->'quote'->>'calculatorSubtotal')::numeric*1.3,2)
    or (p_payload->'quote'->>'platformFee')::numeric<>round((p_payload->'quote'->>'total')::numeric*(p_payload->'quotePolicySnapshot'->>'platformFeeRate')::numeric,2)
    or (p_payload->'quote'->>'professionalAmount')::numeric-(p_payload->'quote'->>'paymentCostBudget')::numeric<(p_payload->'quote'->>'calculatorSubtotal')::numeric
    or (p_payload->>'expiresAt')::timestamptz<=clock_timestamp()
    or (p_payload->>'expiresAt')::timestamptz>clock_timestamp()+interval '30 minutes'
    or (p_payload->'route'->>'measuredAt')::timestamptz<clock_timestamp()-interval '30 minutes' then
    raise exception using errcode='22023',message='Verified complete initial labor quote required'; end if;
  insert into private.customer_request_previews(customer_id,actor_profile_id,input,context_snapshot,policy_id,quote_policy_id,
    professional_id,seller_account_id,origin,live_mode,payload,expires_at)
  values(p_customer_id,v_actor,p_payload->'input',p_payload->'context',(p_payload->>'policyId')::uuid,(p_payload->>'quotePolicyId')::uuid,
    (p_payload->>'professionalId')::uuid,p_payload->>'sellerAccountId',p_payload->>'origin',(p_payload->>'liveMode')::boolean,p_payload,(p_payload->>'expiresAt')::timestamptz) returning id into v_id;
  perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
  return jsonb_build_object('status','ready','previewId',v_id,'quote',p_payload->'quote','scope',p_payload->'quote'->>'scope',
    'exclusions',p_payload->'quote'->'exclusions','expiresAt',p_payload->>'expiresAt');
end; $$;

create function private.prepare_customer_request(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid,p_preview_id uuid,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_claims text:=current_setting('request.jwt.claims',true); v_preview private.customer_request_previews%rowtype;
  v_fingerprint jsonb:=jsonb_build_object('previewId',p_preview_id); v_command private.customer_request_commands%rowtype;
  v_current jsonb; v_existing private.customer_request_contracts%rowtype; v_result jsonb;
  v_category uuid; v_issue uuid; v_request uuid:=gen_random_uuid(); v_job public.jobs%rowtype; v_quote uuid:=gen_random_uuid();
  v_price uuid; v_start timestamptz; v_scope jsonb; v_expiry timestamptz; v_res public.job_schedule_reservations%rowtype; v_answer record;
begin
  v_actor:=private.customer_request_actor(p_actor_user_id,p_actor_session_id,p_customer_id);
  if p_command_id is null or p_preview_id is null then raise exception using errcode='22023',message='Idempotent command required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text||':'||p_command_id::text,62401));
  select * into v_command from private.customer_request_commands where customer_id=p_customer_id and command_id=p_command_id;
  if found then
    if v_command.fingerprint is distinct from v_fingerprint then raise exception using errcode='40001',message='Command payload changed'; end if;
    perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
    return v_command.result;
  end if;
  select * into v_preview from private.customer_request_previews where id=p_preview_id and customer_id=p_customer_id for update;
  if not found then raise exception using errcode='P0002',message='Owned preview unavailable'; end if;
  select * into v_existing from private.customer_request_contracts where preview_id=v_preview.id;
  if found then
    select jsonb_build_object('status','ready','jobId',j.id,'requestId',j.request_id,'quoteId',v_existing.quote_id,'quote',v_preview.payload->'quote',
      'scope',v_preview.payload->'quote'->>'scope','exclusions',v_preview.payload->'quote'->'exclusions','expiresAt',v_existing.hold_expires_at) into v_result
      from public.jobs j where j.id=v_existing.job_id;
    insert into private.customer_request_commands(customer_id,command_id,fingerprint,result) values(p_customer_id,p_command_id,v_fingerprint,v_result);
    perform set_config('request.jwt.claims',coalesce(v_claims,''),true); return v_result;
  end if;
  perform private.assert_customer_request_ready();
  if v_preview.expires_at<=clock_timestamp() then
    perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
    return jsonb_build_object('status','price_changed','reason','quote_expired','message','El cálculo venció. Actualizalo antes de pagar.'); end if;
  -- The actor already owns the FK-compatible customer mutex. Match legacy
  -- offers (4516 -> professional) and agenda edits (professional -> 4515).
  perform 1 from private.customer_request_policy_current where singleton for share;
  perform 1 from private.quote_policy_current where singleton for share;
  perform pg_advisory_xact_lock(hashtextextended(v_preview.professional_id::text,4516));
  perform 1 from public.professional_profiles where id=v_preview.professional_id for share;
  perform pg_advisory_xact_lock(hashtextextended(v_preview.professional_id::text,4515));
  perform 1 from public.mp_split_connected_accounts where seller_id=v_preview.professional_id::text for share;
  v_current:=private.read_customer_request_context(p_actor_user_id,p_actor_session_id,p_customer_id,v_preview.input);
  if v_current->'context' is distinct from v_preview.context_snapshot or v_current->'policy'->>'id' is distinct from v_preview.policy_id::text
    or v_current->'quotePolicy'->>'id' is distinct from v_preview.quote_policy_id::text then
    perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
    return jsonb_build_object('status','price_changed','reason','context_or_policy_changed','message','Hay información nueva. Revisá el precio actualizado antes de pagar.'); end if;
  if v_current->>'reason' is not null or not exists(select 1 from jsonb_array_elements(v_current->'candidates') c
    where c->>'professionalId'=v_preview.professional_id::text and c->>'sellerAccountId'=v_preview.seller_account_id and c->>'origin'=v_preview.origin) then
    perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
    return jsonb_build_object('status','unavailable','reason',coalesce(v_current->>'reason','professional_unavailable'),
      'message','Ese horario ya no está disponible. Elegí otro o actualizá la solicitud.'); end if;
  v_scope:=v_preview.payload->'scope';
  v_start:=((v_preview.input->>'preferredDate')::date+substring(v_preview.input->>'timeWindow' from '^\d{2}:\d{2}')::time) at time zone 'America/Argentina/Buenos_Aires';
  v_expiry:=least(clock_timestamp()+interval '30 minutes',v_start);
  select id into v_category from public.service_categories where slug='aire_acondicionado' and active for share;
  select id into v_issue from public.service_issue_types where category_id=v_category and slug=v_preview.input->>'issue' and active for share;
  if v_issue is null then raise exception using errcode='22023',message='Service unavailable'; end if;
  insert into public.service_requests(id,customer_id,category_id,issue_type_id,equipment_id,address_id,visit_address_id,visit_address_snapshot,
    context_snapshot,contract_source,status,time_since,preferred_date,preferred_time_window,urgency_level,submitted_at)
  values(v_request,p_customer_id,v_category,v_issue,(v_preview.context_snapshot->'equipment'->>'id')::uuid,
    (v_preview.context_snapshot->'equipment'->>'addressId')::uuid,(v_preview.context_snapshot->'address'->>'id')::uuid,
    v_preview.context_snapshot->'address',v_preview.context_snapshot,'automatic_customer_request','pending_payment',v_preview.input->>'timeSince',
    (v_preview.input->>'preferredDate')::date,v_preview.input->>'timeWindow',(v_preview.input->>'urgency')::public.urgency_level,clock_timestamp());
  insert into public.price_options(request_id,option_type,title,description,amount,platform_fee,professional_amount,selected)
  values(v_request,(v_preview.input->>'urgency')::public.urgency_level,'Presupuesto Lysto',v_preview.payload->'quote'->>'scope',
    (v_preview.payload->'quote'->>'total')::numeric,(v_preview.payload->'quote'->>'platformFee')::numeric,(v_preview.payload->'quote'->>'professionalAmount')::numeric,true) returning id into v_price;
  update public.service_requests set selected_price_option_id=v_price where id=v_request;
  insert into public.jobs(request_id,customer_id,professional_id,status,automatic_assignment_at,assignment_version,scheduled_date,scheduled_time_window,final_amount)
  values(v_request,p_customer_id,v_preview.professional_id,'confirmed',clock_timestamp(),1,
    (v_preview.input->>'preferredDate')::date,v_preview.input->>'timeWindow',(v_preview.payload->'quote'->>'total')::numeric) returning * into v_job;
  v_result:=jsonb_build_object('status','ready','jobId',v_job.id,'requestId',v_request,'quoteId',v_quote,'quote',v_preview.payload->'quote',
    'scope',v_preview.payload->'quote'->>'scope','exclusions',v_preview.payload->'quote'->'exclusions','expiresAt',v_expiry);
  insert into public.service_quotes(id,customer_id,address,input,quote,preferred_date,time_window,status,expires_at,request_id,accepted_at,
    root_quote_id,revision,created_by,policy_id,policy_snapshot,upload_intent_ids,acceptance_result)
  values(v_quote,p_customer_id,v_preview.context_snapshot->'address',v_preview.payload->'calculatedInput',v_preview.payload->'quote',
    (v_preview.input->>'preferredDate')::date,v_preview.input->>'timeWindow','accepted',v_preview.expires_at,v_request,clock_timestamp(),
    v_quote,1,v_actor,v_preview.quote_policy_id,v_preview.payload->'quotePolicySnapshot',
    array(select value::uuid from jsonb_array_elements_text(v_preview.input->'uploadIntentIds')),
    jsonb_build_object('request_id',v_request,'job_id',v_job.id,'quote_id',v_quote,'status','confirmed'));
  perform private.attach_quote_uploads(v_quote,v_request);
  insert into public.request_answers(request_id,question_code,answer_value,answer_json)
  values(v_request,'customer_description',v_preview.input->>'description',jsonb_build_object('value',v_preview.input->>'description'));
  for v_answer in select key,value from jsonb_each(v_preview.input->'answers') loop
    insert into public.request_answers(request_id,question_code,answer_value,answer_json)
      values(v_request,v_answer.key,v_answer.value#>>'{}',jsonb_build_object('value',v_answer.value)); end loop;
  v_res:=private.insert_schedule_reservation(v_job,v_start,(v_scope->>'durationMinutes')::integer,(v_scope->>'travelBufferMinutes')::integer,'hold',30,v_actor);
  update public.job_schedule_reservations set hold_expires_at=v_expiry where id=v_res.id;
  insert into private.customer_request_contracts(job_id,preview_id,quote_id,professional_id,policy_id,accepted_by,hold_expires_at)
    values(v_job.id,v_preview.id,v_quote,v_preview.professional_id,v_preview.policy_id,v_actor,v_expiry);
  insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata) values(v_job.id,'confirmed',v_actor,
    'Asignación automática disponible; pendiente de pago inicial. No es aceptación individual del profesional.',
    jsonb_build_object('source','automatic_customer_request','quoteId',v_quote,'policyId',v_preview.policy_id,'reservationId',v_res.id));
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata) values(v_actor,'customer_request.contract_prepared','job',v_job.id,
    jsonb_build_object('source','automatic_customer_request','previewId',v_preview.id,'quoteId',v_quote,'policyId',v_preview.policy_id));
  insert into private.customer_request_commands(customer_id,command_id,fingerprint,result) values(p_customer_id,p_command_id,v_fingerprint,v_result);
  perform set_config('request.jwt.claims',coalesce(v_claims,''),true); return v_result;
exception when exclusion_violation or unique_violation then
  raise exception using errcode='40001',message='Automatic contract concurrency conflict';
end; $$;

-- Server-only RPCs reconstruct actual session authority; a service-role JWT is
-- not accepted as a customer identity. No financial field comes from HTTP.
create function public.read_customer_request_context(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid,p_input jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.read_customer_request_context(p_actor_user_id,p_actor_session_id,p_customer_id,p_input); $$;
create function public.persist_customer_request_preview(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid,p_payload jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.persist_customer_request_preview(p_actor_user_id,p_actor_session_id,p_customer_id,p_payload); $$;
create function public.prepare_customer_request(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid,p_preview_id uuid,p_command_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.prepare_customer_request(p_actor_user_id,p_actor_session_id,p_customer_id,p_preview_id,p_command_id); $$;
revoke all on function private.customer_request_actor(uuid,uuid,uuid),private.customer_request_context_snapshot(uuid,jsonb),
  private.customer_request_candidate_is_eligible(uuid,text,uuid,timestamptz,timestamptz,integer),
  private.read_customer_request_context(uuid,uuid,uuid,jsonb),private.persist_customer_request_preview(uuid,uuid,uuid,jsonb),
  private.prepare_customer_request(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function public.read_customer_request_context(uuid,uuid,uuid,jsonb),public.persist_customer_request_preview(uuid,uuid,uuid,jsonb),
  public.prepare_customer_request(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.read_customer_request_context(uuid,uuid,uuid,jsonb),private.persist_customer_request_preview(uuid,uuid,uuid,jsonb),
  private.prepare_customer_request(uuid,uuid,uuid,uuid,uuid),public.read_customer_request_context(uuid,uuid,uuid,jsonb),
  public.persist_customer_request_preview(uuid,uuid,uuid,jsonb),public.prepare_customer_request(uuid,uuid,uuid,uuid,uuid) to service_role;

create function private.read_customer_request_preview(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid,p_preview_id uuid,p_command_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_claims text:=current_setting('request.jwt.claims',true); v_preview private.customer_request_previews%rowtype;
  v_command private.customer_request_commands%rowtype; v_committed boolean;
begin
  perform private.customer_request_actor(p_actor_user_id,p_actor_session_id,p_customer_id);
  select * into v_command from private.customer_request_commands where customer_id=p_customer_id and command_id=p_command_id;
  if found then
    if v_command.fingerprint is distinct from jsonb_build_object('previewId',p_preview_id) then
      raise exception using errcode='40001',message='Command payload changed'; end if;
    perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
    return jsonb_build_object('result',v_command.result,'payload',null,'committed',true);
  end if;
  select * into v_preview from private.customer_request_previews where id=p_preview_id and customer_id=p_customer_id;
  if not found then raise exception using errcode='P0002',message='Owned preview unavailable'; end if;
  select exists(select 1 from private.customer_request_contracts where preview_id=v_preview.id) into v_committed;
  perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
  return jsonb_build_object('result',null,'payload',v_preview.payload,'committed',v_committed);
end; $$;
create function public.read_customer_request_preview(p_actor_user_id uuid,p_actor_session_id uuid,p_customer_id uuid,p_preview_id uuid,p_command_id uuid)
returns jsonb language sql security invoker set search_path='' as $$ select private.read_customer_request_preview(p_actor_user_id,p_actor_session_id,p_customer_id,p_preview_id,p_command_id); $$;
revoke all on function private.read_customer_request_preview(uuid,uuid,uuid,uuid,uuid),public.read_customer_request_preview(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.read_customer_request_preview(uuid,uuid,uuid,uuid,uuid),public.read_customer_request_preview(uuid,uuid,uuid,uuid,uuid) to service_role;

-- This explicit operations/finance decision is deliberately not called by the
-- customer form. There is no seeded duration, repair tariff or fee override.
create function private.configure_customer_request_contract(p_quote_policy_id uuid,p_scopes jsonb,p_approved_until timestamptz,
  p_expected_version integer,p_reason text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_current private.customer_request_policy_current%rowtype; v_quote private.quote_policy_versions%rowtype;
  v_scope jsonb; v_issue text; v_normalized jsonb:='{}'::jsonb; v_id uuid; v_scenario text;
begin
  v_actor:=private.lock_admin_mutation('finance');
  if not private.has_admin_permission('operations') then raise exception using errcode='42501',message='Operations and finance approval required'; end if;
  select * into v_current from private.customer_request_policy_current where singleton for update;
  if v_current.version is distinct from p_expected_version then raise exception using errcode='40001',message='Automatic policy version changed'; end if;
  if p_enabled is distinct from false then
    select q.* into v_quote from private.quote_policy_current c join private.quote_policy_versions q on q.id=c.policy_id
      where c.singleton and q.id=p_quote_policy_id for share of c;
    if v_quote.id is null or v_quote.policy->>'approvedUntil' is null or p_approved_until is null or p_approved_until<=clock_timestamp()
      or p_approved_until>(((v_quote.policy->>'approvedUntil')::date+time '23:59:59') at time zone 'America/Argentina/Buenos_Aires')
      or jsonb_typeof(p_scopes) is distinct from 'object' or p_scopes='{}'::jsonb then
      raise exception using errcode='22023',message='Approved tariff, scope and validity required'; end if;
    for v_issue,v_scope in select key,value from jsonb_each(p_scopes) loop
      if v_issue<>all(array['no_enfria','pierde_agua','hace_ruido','no_enciende','no_funciona_calor','instalacion','mantenimiento']) then
        raise exception using errcode='22023',message='Unknown service scope'; end if;
      perform private.validate_asset_object(v_scope,array['scenario','label','durationMinutes','travelBufferMinutes','initialLaborOnly',
        'excludesUnpricedParts','allowsPredictedRepair','allowCustomerEquipmentDeclaration']);
      if jsonb_typeof(v_scope->'scenario') is distinct from 'string' or v_scope->>'scenario' is null
        or v_scope->>'initialLaborOnly' is distinct from 'true' or v_scope->>'excludesUnpricedParts' is distinct from 'true'
        or jsonb_typeof(v_scope->'allowsPredictedRepair') is distinct from 'boolean'
        or jsonb_typeof(v_scope->'durationMinutes') is distinct from 'number'
        or jsonb_typeof(v_scope->'travelBufferMinutes') is distinct from 'number'
        or (v_scope->>'durationMinutes')::numeric not between 30 and 480
        or (v_scope->>'durationMinutes')::numeric<>trunc((v_scope->>'durationMinutes')::numeric)
        or (v_scope->>'travelBufferMinutes')::numeric not between 0 and 180
        or (v_scope->>'travelBufferMinutes')::numeric<>trunc((v_scope->>'travelBufferMinutes')::numeric)
        or length(btrim(coalesce(v_scope->>'label',''))) not between 10 and 300
        or (v_scope ? 'allowCustomerEquipmentDeclaration' and jsonb_typeof(v_scope->'allowCustomerEquipmentDeclaration')<>'boolean') then
        raise exception using errcode='22023',message='Explicit initial labor and scheduling scope required'; end if;
      v_scenario:=v_scope->>'scenario';
      if not (case v_issue
        when 'no_enfria' then v_scenario=any(array['leak','maintenance','capacitor'])
        when 'pierde_agua' then v_scenario=any(array['maintenance','deep_maintenance'])
        when 'hace_ruido' then v_scenario=any(array['maintenance','deep_maintenance'])
        when 'no_enciende' then v_scenario=any(array['board','capacitor'])
        when 'no_funciona_calor' then v_scenario=any(array['reversing_valve','leak','board'])
        when 'instalacion' then v_scenario='installation'
        when 'mantenimiento' then v_scenario=any(array['maintenance','deep_maintenance']) else false end)
        or (v_issue not in('mantenimiento','instalacion') and v_scope->>'allowsPredictedRepair' is distinct from 'true') then
        raise exception using errcode='22023',message='Scope does not apply to this reported issue'; end if;
      v_normalized:=v_normalized||jsonb_build_object(v_issue,v_scope||jsonb_build_object('allowCustomerEquipmentDeclaration',coalesce((v_scope->>'allowCustomerEquipmentDeclaration')::boolean,false)));
    end loop;
  end if;
  if p_enabled is null or length(btrim(coalesce(p_reason,''))) not between 15 and 2000 then
    raise exception using errcode='22023',message='Attributable approval or withdrawal required'; end if;
  if p_enabled then
    insert into private.customer_request_policy_versions(quote_policy_id,scopes,approved_until,approved_by,reason)
      values(p_quote_policy_id,v_normalized,p_approved_until,v_actor,btrim(p_reason)) returning id into v_id;
  else v_id:=v_current.policy_id; end if;
  update private.customer_request_policy_current set policy_id=v_id,enabled=p_enabled,version=version+1 where singleton;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,case when p_enabled then 'customer_request.policy.approved' else 'customer_request.policy.withdrawn' end,
      'customer_request_policy',v_id,jsonb_build_object('quotePolicyId',p_quote_policy_id,'reason',btrim(p_reason),'enabled',p_enabled));
  return jsonb_build_object('id',v_id,'version',v_current.version+1,'enabled',p_enabled);
end; $$;
create function public.configure_customer_request_contract(p_quote_policy_id uuid,p_scopes jsonb,p_approved_until timestamptz,
  p_expected_version integer,p_reason text,p_enabled boolean)
returns jsonb language sql security invoker set search_path='' as $$
  select private.configure_customer_request_contract(p_quote_policy_id,p_scopes,p_approved_until,p_expected_version,p_reason,p_enabled); $$;
revoke all on function private.configure_customer_request_contract(uuid,jsonb,timestamptz,integer,text,boolean),
  public.configure_customer_request_contract(uuid,jsonb,timestamptz,integer,text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.configure_customer_request_contract(uuid,jsonb,timestamptz,integer,text,boolean),
  public.configure_customer_request_contract(uuid,jsonb,timestamptz,integer,text,boolean) to authenticated;

-- Accepted visit/context snapshots are independent of future home edits. The
-- legacy request columns continue following their existing mutation contracts.
create function private.protect_customer_request_snapshot() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.contract_source='automatic_customer_request' and row(new.equipment_id,new.customer_id,new.address_id,new.visit_address_id,
    new.visit_address_snapshot,new.context_snapshot,new.contract_source,new.category_id)
    is distinct from row(old.equipment_id,old.customer_id,old.address_id,old.visit_address_id,old.visit_address_snapshot,
      old.context_snapshot,old.contract_source,old.category_id) then
    raise exception using errcode='42501',message='Accepted request context is immutable'; end if;
  return new;
end; $$;
create trigger customer_request_snapshot_guard before update on public.service_requests
  for each row execute function private.protect_customer_request_snapshot();
revoke all on function private.protect_customer_request_snapshot() from public,anon,authenticated,service_role;

-- A checkout pins its seller and its still-held capacity. The existing payment
-- guard remains the authority for every historical reviewed quote.
alter function private.prepare_marketplace_checkout(uuid,uuid,uuid,boolean) rename to prepare_marketplace_checkout_before_automatic_request;
create function private.prepare_marketplace_checkout(p_customer uuid,p_job uuid,p_extra uuid,p_live boolean)
returns public.marketplace_checkouts language plpgsql set search_path='' as $$
declare v_contract private.customer_request_contracts%rowtype; v_preview private.customer_request_previews%rowtype; v_checkout public.marketplace_checkouts%rowtype;
begin
  -- NO KEY UPDATE preserves the owning job identity while remaining compatible
  -- with payment projection FK KEY SHARE. All paths then lock checkout before
  -- contract; the legacy helper upgrades the job only after checkout ownership.
  perform 1 from public.jobs where id=p_job and customer_id=p_customer for no key update;
  if not found then raise exception 'payment_forbidden'; end if;
  perform 1 from public.marketplace_checkouts where job_id=p_job and extra_id is not distinct from p_extra for update;
  select * into v_contract from private.customer_request_contracts where job_id=p_job for update;
  if found then
    select * into v_preview from private.customer_request_previews where id=v_contract.preview_id;
    if p_live is distinct from v_preview.live_mode then raise exception 'payment_mode_mismatch'; end if;
    if v_contract.state not in('awaiting_payment','paid') or not exists(select 1 from public.jobs
      where id=p_job and customer_id=p_customer and professional_id=v_contract.professional_id) then raise exception 'checkout_review'; end if;
    if v_contract.state='awaiting_payment' and not exists(select 1 from public.job_schedule_reservations
      where job_id=p_job and professional_id=v_contract.professional_id and state='hold' and hold_expires_at>clock_timestamp()) then
      raise exception 'checkout_expired'; end if;
    if not exists(select 1 from public.mp_split_connected_accounts where seller_id=v_contract.professional_id::text
      and enabled and mercado_pago_user_id=v_preview.seller_account_id) then raise exception 'seller_not_linked'; end if;
  end if;
  v_checkout:=private.prepare_marketplace_checkout_before_automatic_request(p_customer,p_job,p_extra,p_live);
  if v_contract.job_id is not null and p_extra is null and v_checkout.expires_at>v_contract.hold_expires_at
    and v_checkout.preference_id is null and v_checkout.order_id is null then
    update public.marketplace_checkouts set expires_at=v_contract.hold_expires_at where id=v_checkout.id returning * into v_checkout;
  end if;
  return v_checkout;
end; $$;
revoke all on function private.prepare_marketplace_checkout(uuid,uuid,uuid,boolean),
  private.prepare_marketplace_checkout_before_automatic_request(uuid,uuid,uuid,boolean) from public,anon,authenticated,service_role;
-- Renaming preserves the old OID's grants, not the new invoker wrapper's.
-- Keep the existing PostgreSQL-only marketplace boundary and do not expose
-- automatic contracts or private technician origins to browser/service roles.
do $marketplace_writer$ begin
  -- This transport role is provisioned outside migrations. Fresh databases
  -- without marketplace infrastructure must still be able to apply schema.
  if to_regrole('lysto_marketplace') is not null then
    grant execute on function private.prepare_marketplace_checkout(uuid,uuid,uuid,boolean) to lysto_marketplace;
    grant select,update(hold_expires_at) on private.customer_request_contracts to lysto_marketplace;
    grant select on private.customer_request_previews to lysto_marketplace;
    grant select on public.job_schedule_reservations to lysto_marketplace;
    -- PostgreSQL row locks need UPDATE on at least one column. Do not grant
    -- modification of parent identities, job statuses or accepted amounts.
    grant update(updated_at) on public.jobs,public.customer_profiles,public.professional_profiles to lysto_marketplace;
  end if;
end; $marketplace_writer$;

create or replace function private.expire_schedule_holds(p_professional_id uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  -- Match canonical payment's contract -> reservation ordering.
  perform 1 from private.customer_request_contracts k where exists(select 1 from public.job_schedule_reservations s
    where s.job_id=k.job_id and s.state='hold' and s.hold_expires_at<=clock_timestamp()
      and (p_professional_id is null or s.professional_id=p_professional_id)) order by k.job_id for update;
  -- A nominal timeout must not release a slot while Mercado Pago may still
  -- approve that checkout. Reconciliation/financial closure is required first.
  update public.job_schedule_reservations s set state='expired',released_at=clock_timestamp(),released_reason='hold_expired'
    where s.state='hold' and s.hold_expires_at<=clock_timestamp()
      and (p_professional_id is null or s.professional_id=p_professional_id)
      and not exists(select 1 from private.customer_request_contracts k join public.marketplace_checkouts c on c.job_id=k.job_id and c.extra_id is null
        where k.job_id=s.job_id and (c.status in('pending','in_process','creating','ready','review') or not private.checkout_is_financially_closed(c)));
  get diagnostics v_count=row_count;
  update private.customer_request_contracts k set state='expired' where k.state='awaiting_payment'
    and (p_professional_id is null or k.professional_id=p_professional_id)
    and exists(select 1 from public.job_schedule_reservations s where s.job_id=k.job_id and s.state='expired');
  update public.service_requests r set status='expired' from public.jobs j join private.customer_request_contracts k on k.job_id=j.id
    where r.id=j.request_id and r.status='pending_payment' and k.state='expired'
      and (p_professional_id is null or k.professional_id=p_professional_id);
  return v_count;
end; $$;

-- Both Preferences and Orders reach this trigger only through their canonical
-- server ledger. Browser returns never update a checkout or reservation.
create function private.customer_request_payment_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_contract private.customer_request_contracts%rowtype; v_res public.job_schedule_reservations%rowtype;
begin
  if new.extra_id is not null or new.status='approved' and old.status='approved' then return new; end if;
  select * into v_contract from private.customer_request_contracts where job_id=new.job_id for update;
  if not found then return new; end if;
  if new.status='approved' then
    select * into v_res from public.job_schedule_reservations where job_id=new.job_id and professional_id=new.professional_id
      and state in('hold','confirmed') for update;
    if v_contract.state not in('awaiting_payment','paid') or v_res.id is null or v_res.starts_at<=clock_timestamp()
      or v_contract.professional_id<>new.professional_id then
      new.status:='review'; new.review_reason:='late_automatic_contract_payment';
      update private.customer_request_contracts set state='payment_review' where job_id=new.job_id;
      return new;
    end if;
    update public.job_schedule_reservations set state='confirmed',hold_expires_at=null where id=v_res.id and state='hold';
    update private.customer_request_contracts set state='paid',paid_at=coalesce(paid_at,clock_timestamp()) where job_id=new.job_id;
    update public.service_requests set status='payment_approved' where id=(select request_id from public.jobs where id=new.job_id);
    if v_contract.state<>'paid' then
      insert into public.notifications(profile_id,event_type,title,body,entity_type,entity_id,action_url)
      select c.profile_id,'customer_request.payment_confirmed','Servicio confirmado',
        'Mercado Pago confirmó tu pago. Podés seguir la visita desde Servicios.','job',new.job_id,'/app/trabajos/'||new.job_id::text
        from public.customer_profiles c where c.id=new.customer_id;
      insert into public.notifications(profile_id,event_type,title,body,entity_type,entity_id,action_url)
      select p.profile_id,'customer_request.visit_ready','Visita asignada',
        'El pago inicial fue aprobado y la visita asignada está lista para realizarse.','job',new.job_id,'/pro/trabajos/'||new.job_id::text
        from public.professional_profiles p where p.id=new.professional_id;
    end if;
  end if;
  return new;
end; $$;
create trigger customer_request_payment_guard before update of status on public.marketplace_checkouts
  for each row execute function private.customer_request_payment_change();
revoke all on function private.customer_request_payment_change() from public,anon,authenticated,service_role;

-- The inventory's postal FK is historical; a booked automatic visit must use
-- only its immutable owned visit snapshot, never silently fall back to it.
create function private.customer_request_visit_address_label(p_request public.service_requests) returns text
language plpgsql stable security invoker set search_path='' as $$
declare v_address jsonb:=p_request.visit_address_snapshot;
begin
  if p_request.contract_source is distinct from 'automatic_customer_request'
    or p_request.visit_address_id is null or p_request.customer_id is null
    or jsonb_typeof(v_address) is distinct from 'object'
    or v_address->>'id' is distinct from p_request.visit_address_id::text
    or p_request.context_snapshot->'address' is distinct from v_address
    or jsonb_typeof(v_address->'street') is distinct from 'string' or length(btrim(v_address->>'street')) not between 1 and 200
    or jsonb_typeof(v_address->'number') is distinct from 'string' or length(btrim(v_address->>'number')) not between 1 and 30
    or jsonb_typeof(v_address->'city') is distinct from 'string' or length(btrim(v_address->>'city')) not between 1 and 100
    or (v_address->>'floor' is not null and (jsonb_typeof(v_address->'floor') is distinct from 'string' or length(v_address->>'floor')>100))
    or (v_address->>'apartment' is not null and (jsonb_typeof(v_address->'apartment') is distinct from 'string' or length(v_address->>'apartment')>100))
    or not exists(select 1 from public.customer_addresses a where a.id=p_request.visit_address_id and a.customer_id=p_request.customer_id) then
    return null;
  end if;
  return left(btrim(concat_ws(', ',btrim(concat_ws(' ',v_address->>'street',v_address->>'number')),
    nullif(btrim(concat_ws(' ',case when nullif(btrim(v_address->>'floor'),'') is not null then 'Piso '||(v_address->>'floor') end,
      case when nullif(btrim(v_address->>'apartment'),'') is not null then 'Depto. '||(v_address->>'apartment') end)),''),v_address->>'city')),500);
end; $$;
revoke all on function private.customer_request_visit_address_label(public.service_requests) from public,anon,authenticated,service_role;

-- Preserve the latest current-identity/participant guard exactly. Only the
-- automatic projection adds its canonical initial-payment provenance gate.
create or replace function public.get_job_visit(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  v_job public.jobs%rowtype;
  v_role public.user_role:=public.current_user_role();
  v_profile_id uuid:=private.current_profile_id();
  v_result jsonb;
begin
  if v_role is null or v_profile_id is null then
    raise exception using errcode='P0002',message='job_not_found';
  end if;
  select * into v_job from public.jobs where id=p_job_id;
  if not found or (
    (v_role='customer' and v_job.customer_id=private.current_customer_id()) or
    (v_role='professional' and v_job.professional_id=private.current_professional_id(false)) or
    (v_role='admin' and private.has_admin_permission('operations'))
  ) is not true then raise exception using errcode='P0002',message='job_not_found'; end if;

  select jsonb_build_object(
    'scheduleVersion',s.version,'startsAt',s.starts_at,'endsAt',s.ends_at,'timezone',s.timezone,
    'addressLabel',case when r.contract_source='automatic_customer_request' then private.customer_request_visit_address_label(r)
      else left(btrim(concat_ws(', ',btrim(concat_ws(' ',a.street,a.number)),
        nullif(btrim(concat_ws(' ',case when a.floor is not null then 'Piso '||a.floor end,
          case when a.apartment is not null then 'Depto. '||a.apartment end)),''),a.city)),500) end,
    'professionalName',left(coalesce(nullif(btrim(concat_ws(' ',nullif(btrim(p.first_name),''),
      case when nullif(btrim(p.last_name),'') is null then null else left(btrim(p.last_name),1)||'.' end)),''),'Profesional Lysto'),160),
    'durationMinutes',s.duration_minutes,'travelBufferMinutes',s.travel_buffer_minutes,'confirmed',true
  ) into v_result
  from public.job_schedule_reservations s
  join public.service_requests r on r.id=v_job.request_id
  left join public.customer_addresses a on a.id=r.address_id
  join public.professional_profiles pro on pro.id=v_job.professional_id
  join public.profiles p on p.id=pro.profile_id
  where s.job_id=v_job.id and s.state='confirmed' and v_job.status='confirmed'
    and ((r.contract_source is distinct from 'automatic_customer_request' and a.id is not null)
      or (r.contract_source='automatic_customer_request' and r.customer_id=v_job.customer_id
        and s.professional_id=v_job.professional_id and private.customer_request_visit_address_label(r) is not null
        and exists(select 1 from private.customer_request_contracts k
          join public.marketplace_checkouts c on c.job_id=k.job_id
          where k.job_id=v_job.id and k.state='paid' and k.paid_at is not null and k.professional_id=v_job.professional_id
            and c.extra_id is null and c.status='approved' and c.customer_id=v_job.customer_id and c.professional_id=v_job.professional_id)))
  order by s.version desc limit 1;
  return v_result;
end; $$;
revoke all on function public.get_job_visit(uuid) from public,anon;
grant execute on function public.get_job_visit(uuid) to authenticated;

-- Keep every existing delivery scenario (including legacy visit.confirmed)
-- intact; intercept only automatic visits with the same verified recipient and
-- schedule-version checks, plus the paid contract and actual visit snapshot.
alter function private.outbox_recipient(private.outbox_events) rename to outbox_recipient_before_automatic_request;
create function private.outbox_recipient(p_event private.outbox_events) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_email text; v_role text; v_expected_schedule_version integer; v_context jsonb;
begin
  if (p_event.aggregate_type='job' and p_event.event_type='visit.confirmed' and exists(
    select 1 from public.jobs j join public.service_requests r on r.id=j.request_id
      where j.id=p_event.aggregate_id and r.contract_source='automatic_customer_request')) is not true then
    return private.outbox_recipient_before_automatic_request(p_event);
  end if;
  if p_event.channel is distinct from 'email' or (p_event.dedupe_key
    ~ ('^visit-confirmed:'||p_event.aggregate_id::text||':[1-9][0-9]*$')) is not true then
    raise exception using errcode='22023',message='recipient_unavailable'; end if;
  v_expected_schedule_version:=split_part(p_event.dedupe_key,':',3)::integer;
  select u.email,p.role::text into v_email,v_role
    from public.profiles p join auth.users u on u.id=p.auth_user_id
    where p.id=p_event.recipient_profile_id and u.deleted_at is null and u.email_confirmed_at is not null
      and u.email is not null and length(u.email::text) between 3 and 320
      and (u.banned_until is null or u.banned_until<=now())
      and coalesce(u.raw_app_meta_data->>'app_role','customer')=p.role::text
    for share of p,u;
  if not found or v_role is distinct from 'customer' then
    raise exception using errcode='22023',message='recipient_unavailable'; end if;
  select jsonb_build_object('eventType','visit.confirmed','aggregateId',p_event.aggregate_id,'audience','customer',
    'scheduleVersion',s.version,'startsAt',s.starts_at,'endsAt',s.ends_at,'timezone',s.timezone,
    'serviceName',left(sc.name,160),
    'professionalName',left(coalesce(nullif(btrim(concat_ws(' ',nullif(btrim(pp.first_name),''),
      case when nullif(btrim(pp.last_name),'') is null then null else left(btrim(pp.last_name),1)||'.' end)),''),'Profesional Lysto'),160),
    'addressLabel',private.customer_request_visit_address_label(r)) into v_context
    from public.jobs j
    join public.service_requests r on r.id=j.request_id and r.customer_id=j.customer_id
    join public.customer_profiles cp on cp.id=j.customer_id and cp.profile_id=p_event.recipient_profile_id
    join public.job_schedule_reservations s on s.job_id=j.id and s.professional_id=j.professional_id and s.state='confirmed'
    join public.service_categories sc on sc.id=r.category_id
    join public.professional_profiles pro on pro.id=j.professional_id
    join public.profiles pp on pp.id=pro.profile_id
    join private.customer_request_contracts k on k.job_id=j.id and k.professional_id=j.professional_id and k.state='paid' and k.paid_at is not null
    where j.id=p_event.aggregate_id and j.status='confirmed' and s.version=v_expected_schedule_version
      and private.customer_request_visit_address_label(r) is not null
      and exists(select 1 from public.marketplace_checkouts c where c.job_id=j.id
        and c.extra_id is null and c.status='approved' and c.customer_id=j.customer_id and c.professional_id=j.professional_id);
  if not found then raise exception using errcode='22023',message='recipient_unavailable'; end if;
  return jsonb_build_object('recipientEmail',v_email,'context',v_context);
end; $$;
revoke all on function private.outbox_recipient(private.outbox_events),
  private.outbox_recipient_before_automatic_request(private.outbox_events) from public,anon,authenticated,service_role;
