-- Orientative customer home layouts. Equipment and service history remain canonical.
create table public.customer_homes (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  current_address_id uuid not null, name text not null check(length(btrim(name)) between 1 and 80),
  kind text not null check(kind in ('house','apartment','ph','office','commercial')),
  building text check(building in ('low','high')), balcony boolean not null default false,
  terrace boolean not null default false, windows text not null check(windows in ('small','large','mixed')),
  version integer not null default 1 check(version>0), created_at timestamptz not null default now(), archived_at timestamptz,
  unique(id,customer_id), foreign key(current_address_id,customer_id) references public.customer_addresses(id,customer_id)
);
create index customer_homes_owner_idx on public.customer_homes(customer_id,created_at,id);
create index customer_homes_address_idx on public.customer_homes(current_address_id,customer_id);
create table public.customer_home_addresses (
  home_id uuid not null, customer_id uuid not null, address_id uuid not null, archived_at timestamptz,
  primary key(home_id,address_id), foreign key(home_id,customer_id) references public.customer_homes(id,customer_id) on delete cascade,
  foreign key(address_id,customer_id) references public.customer_addresses(id,customer_id)
);
create unique index customer_home_addresses_active_idx on public.customer_home_addresses(customer_id,address_id) where archived_at is null;
create index customer_home_addresses_address_idx on public.customer_home_addresses(address_id,customer_id);
create table public.customer_home_floors (
  id uuid primary key, home_id uuid not null, customer_id uuid not null, name text not null check(length(btrim(name)) between 1 and 80),
  sort_order integer not null check(sort_order between 0 and 11),
  unique(id,home_id,customer_id), foreign key(home_id,customer_id) references public.customer_homes(id,customer_id) on delete cascade
);
create index customer_home_floors_owner_idx on public.customer_home_floors(customer_id,home_id,sort_order);
create index customer_home_floors_home_idx on public.customer_home_floors(home_id,customer_id);
create table public.customer_home_rooms (
  id uuid primary key, home_id uuid not null, floor_id uuid not null, customer_id uuid not null,
  name text not null check(length(btrim(name)) between 1 and 80),
  kind text not null check(kind in ('living','bedroom','kitchen','bathroom','office','dining','laundry','hall','storage','garage','patio','balcony','terrace','meeting','reception','commercial')),
  variant text not null check(length(variant) between 1 and 40), x numeric not null check(x between -80 and 80), z numeric not null check(z between -80 and 80),
  width numeric not null check(width between 2 and 12), depth numeric not null check(depth between 2 and 12),
  rotation integer not null check(rotation in (0,90,180,270)), windows text not null check(windows in ('small','large','none')),
  unique(id,home_id,customer_id), foreign key(floor_id,home_id,customer_id) references public.customer_home_floors(id,home_id,customer_id) on delete cascade
);
create index customer_home_rooms_floor_idx on public.customer_home_rooms(floor_id,home_id,customer_id);
create index customer_home_rooms_owner_idx on public.customer_home_rooms(customer_id,home_id);
create index customer_home_rooms_home_idx on public.customer_home_rooms(home_id,customer_id);
alter table public.customer_equipment add constraint customer_equipment_hogar_owner_key unique(id,customer_id);
create table public.customer_equipment_placements (
  equipment_id uuid primary key, home_id uuid not null, room_id uuid not null, customer_id uuid not null,
  wall text not null check(wall in ('north','east','south','west')),
  wall_offset numeric not null check(wall_offset between 0 and 1), height numeric not null check(height between .35 and 2.5),
  foreign key(equipment_id,customer_id) references public.customer_equipment(id,customer_id) on delete cascade,
  foreign key(room_id,home_id,customer_id) references public.customer_home_rooms(id,home_id,customer_id) on delete cascade
);
create index customer_equipment_placements_room_idx on public.customer_equipment_placements(room_id,home_id,customer_id);
create index customer_equipment_placements_owner_idx on public.customer_equipment_placements(customer_id,home_id);
create index customer_equipment_placements_home_idx on public.customer_equipment_placements(home_id,customer_id);
create table private.customer_home_operations (
  customer_id uuid not null references public.customer_profiles(id) on delete cascade, idempotency_key uuid not null,
  operation text not null, input jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
  primary key(customer_id,idempotency_key)
);
alter table private.customer_home_operations enable row level security;
revoke all on private.customer_home_operations from public,anon,authenticated,service_role;

alter table public.customer_homes enable row level security;
alter table public.customer_home_addresses enable row level security;
alter table public.customer_home_floors enable row level security;
alter table public.customer_home_rooms enable row level security;
alter table public.customer_equipment_placements enable row level security;
create policy customer_homes_owner_select on public.customer_homes for select to authenticated using(customer_id=(select private.current_customer_id()));
create policy customer_home_addresses_owner_select on public.customer_home_addresses for select to authenticated using(customer_id=(select private.current_customer_id()));
create policy customer_home_floors_owner_select on public.customer_home_floors for select to authenticated using(customer_id=(select private.current_customer_id()));
create policy customer_home_rooms_owner_select on public.customer_home_rooms for select to authenticated using(customer_id=(select private.current_customer_id()));
create policy customer_equipment_placements_owner_select on public.customer_equipment_placements for select to authenticated using(customer_id=(select private.current_customer_id()));
revoke all on public.customer_homes,public.customer_home_addresses,public.customer_home_floors,public.customer_home_rooms,public.customer_equipment_placements from public,anon,authenticated,service_role;
grant select on public.customer_homes,public.customer_home_addresses,public.customer_home_floors,public.customer_home_rooms,public.customer_equipment_placements to authenticated;
revoke insert,update,delete on public.customer_homes,public.customer_home_addresses,public.customer_home_floors,public.customer_home_rooms,public.customer_equipment_placements from authenticated;

create function private.customer_home_document(p_id uuid) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',h.id,'name',h.name,'addressId',h.current_address_id,'kind',h.kind,'building',h.building,
    'features',jsonb_build_object('balcony',h.balcony,'terrace',h.terrace,'windows',h.windows),'version',h.version,
    'addressIds',coalesce((select jsonb_agg(a.address_id order by a.address_id) from public.customer_home_addresses a where a.home_id=h.id and a.archived_at is null),'[]'::jsonb),
    'floors',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'order',f.sort_order,
      'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'kind',r.kind,'variant',r.variant,'x',r.x,'z',r.z,'width',r.width,'depth',r.depth,'rotation',r.rotation,'windows',r.windows) order by r.z,r.x,r.id)
        from public.customer_home_rooms r where r.floor_id=f.id),'[]'::jsonb)) order by f.sort_order,f.id) from public.customer_home_floors f where f.home_id=h.id),'[]'::jsonb),
    'placements',coalesce((select jsonb_agg(jsonb_build_object('equipmentId',p.equipment_id,'roomId',p.room_id,'wall',p.wall,'offset',p.wall_offset,'height',p.height) order by p.equipment_id)
      from public.customer_equipment_placements p join public.customer_equipment e on e.id=p.equipment_id where p.home_id=h.id and e.archived_at is null),'[]'::jsonb))
  from public.customer_homes h where h.id=p_id;
$$;
revoke all on function private.customer_home_document(uuid) from public,anon,authenticated,service_role;

-- Explicit links preserve home identity when the canonical address RPC creates a revision.
-- No address-text inference, and no rewrite of any historical equipment/service location.
alter function private.write_customer_asset(text,uuid,integer,jsonb,boolean) rename to write_customer_asset_before_hogar;
revoke all on function private.write_customer_asset_before_hogar(text,uuid,integer,jsonb,boolean) from public,anon,authenticated,service_role;
create function private.write_customer_asset(p_kind text,p_id uuid,p_expected_version integer,p_data jsonb,p_archive boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb; v_replaced uuid; v_next uuid; v_home uuid; v_customer uuid:=private.current_customer_id();
begin
  -- The guard shares the owner lock with home creation; otherwise a concurrent
  -- create could bind this address between the guard and canonical archival.
  perform 1 from public.customer_profiles where id=v_customer for update;
  if p_kind='address' and p_archive and exists(select 1 from public.customer_homes where customer_id=v_customer and current_address_id=p_id and archived_at is null) then
    raise exception using errcode='P0001',message='Address linked to active home';
  end if;
  v_result:=private.write_customer_asset_before_hogar(p_kind,p_id,p_expected_version,p_data,p_archive);
  if p_kind='address' then
    v_replaced:=(v_result->>'replacedId')::uuid;
    if v_replaced is not null then
      v_next:=(v_result->'address'->>'id')::uuid;
      select home_id into v_home from public.customer_home_addresses where customer_id=v_customer and address_id=v_replaced and archived_at is null;
      if v_home is not null then
        insert into public.customer_home_addresses(home_id,customer_id,address_id) values(v_home,v_customer,v_next);
        update public.customer_homes set current_address_id=v_next,version=version+1 where id=v_home and customer_id=v_customer and archived_at is null;
      end if;
    end if;
  end if;
  return v_result;
end;
$$;
create or replace function public.write_customer_asset(p_kind text,p_id uuid,p_expected_version integer,p_data jsonb,p_archive boolean default false) returns jsonb
language sql security invoker set search_path='' as $$ select private.write_customer_asset(p_kind,p_id,p_expected_version,p_data,p_archive); $$;
revoke all on function private.write_customer_asset(text,uuid,integer,jsonb,boolean),public.write_customer_asset(text,uuid,integer,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function private.write_customer_asset(text,uuid,integer,jsonb,boolean),public.write_customer_asset(text,uuid,integer,jsonb,boolean) to authenticated;

create function private.validate_home_layout(p_data jsonb) returns void language plpgsql set search_path='' as $$
declare f jsonb; r jsonb; p jsonb; v_ids uuid[]:='{}'; v_rooms uuid[]:='{}'; v_equipment uuid[]:='{}'; v_orders integer[]:='{}'; v_id uuid; v_order integer; v_variant text; v_kind text;
begin
  perform private.validate_asset_object(p_data,array['name','addressId','kind','building','features','floors','placements','idempotencyKey']);
  perform private.validate_asset_object(p_data->'features',array['balcony','terrace','windows']);
  if jsonb_typeof(p_data->'name') is distinct from 'string' or length(btrim(p_data->>'name')) not between 1 and 80
    or jsonb_typeof(p_data->'addressId') is distinct from 'string'
    or coalesce(p_data->>'kind','') not in ('house','apartment','ph','office','commercial')
    or (p_data->'building' is distinct from 'null'::jsonb and coalesce(p_data->>'building','') not in ('low','high'))
    or jsonb_typeof(p_data->'features'->'balcony') is distinct from 'boolean' or jsonb_typeof(p_data->'features'->'terrace') is distinct from 'boolean'
    or coalesce(p_data->'features'->>'windows','') not in ('small','large','mixed')
    or jsonb_typeof(p_data->'floors') is distinct from 'array' or jsonb_typeof(p_data->'placements') is distinct from 'array' then
    raise exception using errcode='22023',message='Invalid home details';
  end if;
  if jsonb_array_length(p_data->'floors') not between 1 and 12 or jsonb_array_length(p_data->'placements')>500 then raise exception using errcode='22023',message='Invalid layout size'; end if;
  for f in select value from jsonb_array_elements(p_data->'floors') loop
    perform private.validate_asset_object(f,array['id','name','order','rooms']);
    if jsonb_typeof(f->'id') is distinct from 'string' or jsonb_typeof(f->'name') is distinct from 'string' or length(btrim(f->>'name')) not between 1 and 80
      or jsonb_typeof(f->'order') is distinct from 'number' or (f->>'order')::numeric<>trunc((f->>'order')::numeric)
      or (f->>'order')::numeric not between 0 and 11 or jsonb_typeof(f->'rooms') is distinct from 'array' then raise exception using errcode='22023',message='Invalid floor'; end if;
    if jsonb_array_length(f->'rooms')>60 then raise exception using errcode='22023',message='Too many rooms'; end if;
    v_id:=(f->>'id')::uuid; v_order:=(f->>'order')::integer;
    if v_id=any(v_ids) or v_order=any(v_orders) then raise exception using errcode='22023',message='Duplicate floor'; end if;
    v_ids:=array_append(v_ids,v_id); v_orders:=array_append(v_orders,v_order);
    for r in select value from jsonb_array_elements(f->'rooms') loop
      perform private.validate_asset_object(r,array['id','name','kind','variant','x','z','width','depth','rotation','windows']);
      if jsonb_typeof(r->'id') is distinct from 'string' or jsonb_typeof(r->'name') is distinct from 'string' or length(btrim(r->>'name')) not between 1 and 80
        or coalesce(r->>'kind','') not in ('living','bedroom','kitchen','bathroom','office','dining','laundry','hall','storage','garage','patio','balcony','terrace','meeting','reception','commercial')
        or jsonb_typeof(r->'variant') is distinct from 'string' or coalesce(r->>'windows','') not in ('small','large','none')
        or exists(select 1 from jsonb_each(r) where key in ('x','z','width','depth','rotation') and jsonb_typeof(value)<>'number')
        or not(r ?& array['x','z','width','depth','rotation'])
        or (r->>'x')::numeric not between -80 and 80 or (r->>'z')::numeric not between -80 and 80
        or (r->>'width')::numeric not between 2 and 12 or (r->>'depth')::numeric not between 2 and 12
        or (r->>'rotation')::numeric not in (0,90,180,270) then raise exception using errcode='22023',message='Invalid room'; end if;
      v_kind:=r->>'kind'; v_variant:=r->>'variant';
      if not case v_kind
        when 'living' then v_variant in ('compact','family','dining') when 'bedroom' then v_variant in ('principal','double','guest')
        when 'kitchen' then v_variant in ('linear','l','island') when 'bathroom' then v_variant in ('shower','bathtub','compact')
        when 'office' then v_variant in ('individual','shared','studio') when 'dining' then v_variant in ('compact','family')
        when 'laundry' then v_variant in ('compact','separate') when 'hall' then v_variant in ('entrance','corridor')
        when 'storage' then v_variant in ('closet','utility') when 'garage' then v_variant in ('single','double')
        when 'patio' then v_variant in ('courtyard','garden') when 'balcony' then v_variant in ('narrow','wide')
        when 'terrace' then v_variant in ('open','covered') when 'meeting' then v_variant in ('compact','boardroom')
        when 'reception' then v_variant in ('compact','lounge') when 'commercial' then v_variant in ('retail','open') else false end then raise exception using errcode='22023',message='Invalid room variant'; end if;
      if (v_kind in ('living','bedroom') and p_data->>'kind' not in ('house','apartment','ph'))
        or (v_kind in ('meeting','reception') and p_data->>'kind' not in ('office','commercial'))
        or (v_kind='commercial' and p_data->>'kind'<>'commercial') or (v_kind='garage' and p_data->>'kind'='apartment')
        or (v_kind='balcony' and not(p_data->'features'->>'balcony')::boolean) or (v_kind='terrace' and not(p_data->'features'->>'terrace')::boolean)
        then raise exception using errcode='22023',message='Incompatible room kind'; end if;
      v_id:=(r->>'id')::uuid;
      if v_id=any(v_ids) then raise exception using errcode='22023',message='Duplicate room'; end if;
      v_ids:=array_append(v_ids,v_id); v_rooms:=array_append(v_rooms,v_id);
    end loop;
    if exists(select 1 from jsonb_array_elements(f->'rooms') a cross join jsonb_array_elements(f->'rooms') b
      where a->>'id'<b->>'id'
      and (a->>'x')::numeric < (b->>'x')::numeric + (case when (b->>'rotation')::int%180=0 then (b->>'width')::numeric else (b->>'depth')::numeric end) - .01
      and (a->>'x')::numeric + (case when (a->>'rotation')::int%180=0 then (a->>'width')::numeric else (a->>'depth')::numeric end) > (b->>'x')::numeric + .01
      and (a->>'z')::numeric < (b->>'z')::numeric + (case when (b->>'rotation')::int%180=0 then (b->>'depth')::numeric else (b->>'width')::numeric end) - .01
      and (a->>'z')::numeric + (case when (a->>'rotation')::int%180=0 then (a->>'depth')::numeric else (a->>'width')::numeric end) > (b->>'z')::numeric + .01) then raise exception using errcode='22023',message='Rooms overlap'; end if;
  end loop;
  for p in select value from jsonb_array_elements(p_data->'placements') loop
    perform private.validate_asset_object(p,array['equipmentId','roomId','wall','offset','height']);
    if jsonb_typeof(p->'equipmentId') is distinct from 'string' or jsonb_typeof(p->'roomId') is distinct from 'string'
      or coalesce(p->>'wall','') not in ('north','east','south','west') or jsonb_typeof(p->'offset') is distinct from 'number' or jsonb_typeof(p->'height') is distinct from 'number'
      or (p->>'offset')::numeric not between 0 and 1 or (p->>'height')::numeric not between .35 and 2.5
      or not((p->>'roomId')::uuid=any(v_rooms)) or (p->>'equipmentId')::uuid=any(v_equipment) then raise exception using errcode='22023',message='Invalid placement'; end if;
    v_equipment:=array_append(v_equipment,(p->>'equipmentId')::uuid);
  end loop;
end;
$$;
revoke all on function private.validate_home_layout(jsonb) from public,anon,authenticated,service_role;

create function private.write_customer_home(p_operation text,p_id uuid,p_expected_version integer,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_customer uuid:=private.current_customer_id(); v_home public.customer_homes%rowtype; v_prior private.customer_home_operations%rowtype;
  v_id uuid; v_key uuid; v_result jsonb; v_original_input jsonb; v_new_address jsonb; v_affected_rows integer; f jsonb; r jsonb; p jsonb; v_equipment public.customer_equipment%rowtype; v_equipment_data jsonb;
  v_floor_ids uuid[]:='{}'; v_room_ids uuid[]:='{}'; v_equipment_ids uuid[]:='{}';
begin
  if v_customer is null then raise exception using errcode='42501',message='Customer session required'; end if;
  perform 1 from public.customer_profiles where id=v_customer for update;
  if p_operation is null or p_operation not in ('create','save','archive','equipment') or p_data is null or jsonb_typeof(p_data)<>'object' then raise exception using errcode='22023',message='Invalid home operation'; end if;
  -- The original command, not the normalized address ID, defines retry identity.
  v_original_input:=jsonb_build_object('id',p_id,'data',p_data);
  if p_operation in ('create','equipment') then
    if jsonb_typeof(p_data->'idempotencyKey') is distinct from 'string' then raise exception using errcode='22023',message='Idempotency key required'; end if;
    v_key:=(p_data->>'idempotencyKey')::uuid;
    select * into v_prior from private.customer_home_operations where customer_id=v_customer and idempotency_key=v_key;
    if found then
      if v_prior.operation<>p_operation or v_prior.input is distinct from v_original_input then raise exception using errcode='40001',message='Idempotency key already used'; end if;
      return v_prior.result;
    end if;
  end if;
  if p_operation<>'create' then
    select * into v_home from public.customer_homes where id=p_id and customer_id=v_customer and archived_at is null for update;
    if not found then raise exception using errcode='P0002',message='Home not found'; end if;
    if p_expected_version is null or p_expected_version<1 then raise exception using errcode='22023',message='Home version required'; end if;
    if v_home.version<>p_expected_version then raise exception using errcode='40001',message='Home version changed'; end if;
    v_id:=p_id;
  elsif p_id is not null or p_expected_version is not null then raise exception using errcode='22023',message='Invalid create operation'; end if;
  if p_operation='archive' then
    if p_data<>'{}'::jsonb then raise exception using errcode='22023',message='Invalid archive fields'; end if;
    update public.customer_homes set archived_at=now(),version=version+1 where id=v_id;
    update public.customer_home_addresses set archived_at=now() where home_id=v_id and archived_at is null;
    delete from public.customer_equipment_placements where home_id=v_id;
    return jsonb_build_object('archived',true);
  end if;
  if p_operation='equipment' then
    perform private.validate_asset_object(p_data,array['idempotencyKey','equipment','placement']);
    perform private.validate_asset_object(p_data->'equipment',array['nickname','equipmentType','brand','model','serialNumber','frigorias']);
    perform private.validate_asset_object(p_data->'placement',array['roomId','wall','offset','height']);
    p:=p_data->'placement';
    if jsonb_typeof(p->'roomId') is distinct from 'string' or coalesce(p->>'wall','') not in ('north','east','south','west')
      or jsonb_typeof(p->'offset') is distinct from 'number' or jsonb_typeof(p->'height') is distinct from 'number'
      or (p->>'offset')::numeric not between 0 and 1 or (p->>'height')::numeric not between .35 and 2.5 then raise exception using errcode='22023',message='Invalid placement'; end if;
    perform 1 from public.customer_home_rooms where id=(p->>'roomId')::uuid and home_id=v_id and customer_id=v_customer;
    if not found then raise exception using errcode='P0002',message='Room not found'; end if;
    -- Keep the persisted aggregate readable by the same bounded contract. Old
    -- archived inventory may retain placement metadata, but is absent from the
    -- snapshot, so capacity counts only active equipment under the owner lock.
    if (select count(*) from public.customer_equipment_placements placement_row join public.customer_equipment e on e.id=placement_row.equipment_id where placement_row.home_id=v_id and e.archived_at is null)>=500 then
      raise exception using errcode='22023',message='Home equipment limit reached';
    end if;
    v_equipment_data:=private.write_customer_asset_before_hogar('equipment',null,null,(p_data->'equipment')||jsonb_build_object('addressId',v_home.current_address_id),false);
    insert into public.customer_equipment_placements(equipment_id,home_id,room_id,customer_id,wall,wall_offset,height)
      values((v_equipment_data->'equipment'->>'id')::uuid,v_id,(p->>'roomId')::uuid,v_customer,p->>'wall',(p->>'offset')::numeric,(p->>'height')::numeric);
    update public.customer_homes set version=version+1 where id=v_id;
    v_result:=jsonb_build_object('home',private.customer_home_document(v_id),'equipment',v_equipment_data->'equipment');
  else
    if p_operation='create' then
      if not(p_data ? 'addressId') or jsonb_typeof(p_data->'addressId') not in ('string','null')
        or ((p_data->'addressId'<>'null'::jsonb) = (p_data ? 'newAddress')) then raise exception using errcode='22023',message='Choose one existing or new address'; end if;
      if p_data ? 'newAddress' then
        -- Canonical address validation and insertion participate in this RPC's
        -- transaction. A failed layout rolls this address back as well.
        v_new_address:=private.write_customer_asset('address',null,null,p_data->'newAddress',false)->'address';
        p_data:=(p_data-'newAddress')||jsonb_build_object('addressId',v_new_address->>'id');
      end if;
    end if;
    perform private.validate_home_layout(p_data);
    if p_operation='create' then
      if jsonb_array_length(p_data->'placements')<>0 then raise exception using errcode='22023',message='Create without equipment placements'; end if;
      perform 1 from public.customer_addresses where id=(p_data->>'addressId')::uuid and customer_id=v_customer and archived_at is null for share;
      if not found then raise exception using errcode='P0002',message='Address not found'; end if;
      if exists(select 1 from public.customer_home_addresses where address_id=(p_data->>'addressId')::uuid and archived_at is null) then raise exception using errcode='40001',message='Address already has a home'; end if;
      if (select count(*) from public.customer_homes where customer_id=v_customer and archived_at is null)>=50 then raise exception using errcode='22023',message='Home limit reached'; end if;
      insert into public.customer_homes(customer_id,current_address_id,name,kind,building,balcony,terrace,windows)
        values(v_customer,(p_data->>'addressId')::uuid,btrim(p_data->>'name'),p_data->>'kind',p_data->>'building',(p_data->'features'->>'balcony')::boolean,(p_data->'features'->>'terrace')::boolean,p_data->'features'->>'windows') returning id into v_id;
      insert into public.customer_home_addresses(home_id,customer_id,address_id) values(v_id,v_customer,(p_data->>'addressId')::uuid);
    else
      if p_data ? 'idempotencyKey' or (p_data->>'addressId')::uuid<>v_home.current_address_id then raise exception using errcode='22023',message='Home address cannot be silently moved'; end if;
      update public.customer_homes set name=btrim(p_data->>'name'),kind=p_data->>'kind',building=p_data->>'building',balcony=(p_data->'features'->>'balcony')::boolean,terrace=(p_data->'features'->>'terrace')::boolean,windows=p_data->'features'->>'windows',version=version+1 where id=v_id;
    end if;
    -- Identity checks precede all upserts: another owner's floor/room cannot be adopted.
    for f in select value from jsonb_array_elements(p_data->'floors') loop
      if exists(select 1 from public.customer_home_floors where id=(f->>'id')::uuid and (home_id<>v_id or customer_id<>v_customer)) then raise exception using errcode='P0002',message='Floor not found'; end if;
      if exists(select 1 from public.customer_home_rooms where id=(f->>'id')::uuid) then raise exception using errcode='22023',message='Identity collision'; end if;
      insert into public.customer_home_floors as target(id,home_id,customer_id,name,sort_order) values((f->>'id')::uuid,v_id,v_customer,btrim(f->>'name'),(f->>'order')::int)
        on conflict(id) do update set name=excluded.name,sort_order=excluded.sort_order
        where target.home_id=excluded.home_id and target.customer_id=excluded.customer_id;
      get diagnostics v_affected_rows=row_count;
      if v_affected_rows<>1 then raise exception using errcode='P0002',message='Floor not found'; end if;
      v_floor_ids:=array_append(v_floor_ids,(f->>'id')::uuid);
      for r in select value from jsonb_array_elements(f->'rooms') loop
        if exists(select 1 from public.customer_home_rooms where id=(r->>'id')::uuid and (home_id<>v_id or customer_id<>v_customer)) then raise exception using errcode='P0002',message='Room not found'; end if;
        if exists(select 1 from public.customer_home_floors where id=(r->>'id')::uuid) then raise exception using errcode='22023',message='Identity collision'; end if;
        insert into public.customer_home_rooms as target(id,home_id,floor_id,customer_id,name,kind,variant,x,z,width,depth,rotation,windows)
          values((r->>'id')::uuid,v_id,(f->>'id')::uuid,v_customer,btrim(r->>'name'),r->>'kind',r->>'variant',(r->>'x')::numeric,(r->>'z')::numeric,(r->>'width')::numeric,(r->>'depth')::numeric,(r->>'rotation')::int,r->>'windows')
          on conflict(id) do update set floor_id=excluded.floor_id,name=excluded.name,kind=excluded.kind,variant=excluded.variant,x=excluded.x,z=excluded.z,width=excluded.width,depth=excluded.depth,rotation=excluded.rotation,windows=excluded.windows
          where target.home_id=excluded.home_id and target.customer_id=excluded.customer_id;
        get diagnostics v_affected_rows=row_count;
        if v_affected_rows<>1 then raise exception using errcode='P0002',message='Room not found'; end if;
        v_room_ids:=array_append(v_room_ids,(r->>'id')::uuid);
      end loop;
    end loop;
    for p in select value from jsonb_array_elements(p_data->'placements') loop
      select * into v_equipment from public.customer_equipment where id=(p->>'equipmentId')::uuid and customer_id=v_customer and archived_at is null for share;
      if not found then raise exception using errcode='P0002',message='Equipment not found'; end if;
      if v_equipment.address_id is not null and not exists(select 1 from public.customer_home_addresses where home_id=v_id and customer_id=v_customer and address_id=v_equipment.address_id and archived_at is null) then raise exception using errcode='22023',message='Equipment belongs to another location'; end if;
      if coalesce(v_equipment.equipment_type,'') not in ('split','inverter','on_off','window','floor_ceiling','central') then raise exception using errcode='22023',message='Only air conditioning equipment supported'; end if;
      if exists(select 1 from public.customer_equipment_placements where equipment_id=v_equipment.id and home_id<>v_id) then raise exception using errcode='40001',message='Equipment already placed elsewhere'; end if;
      insert into public.customer_equipment_placements as target(equipment_id,home_id,room_id,customer_id,wall,wall_offset,height)
        values(v_equipment.id,v_id,(p->>'roomId')::uuid,v_customer,p->>'wall',(p->>'offset')::numeric,(p->>'height')::numeric)
        on conflict(equipment_id) do update set room_id=excluded.room_id,wall=excluded.wall,wall_offset=excluded.wall_offset,height=excluded.height
        where target.home_id=excluded.home_id and target.customer_id=excluded.customer_id;
      get diagnostics v_affected_rows=row_count;
      if v_affected_rows<>1 then raise exception using errcode='P0002',message='Placement not found'; end if;
      v_equipment_ids:=array_append(v_equipment_ids,v_equipment.id);
    end loop;
    -- Delete arrangements only. Never delete customer_equipment or service records.
    delete from public.customer_equipment_placements where home_id=v_id and not(equipment_id=any(v_equipment_ids));
    delete from public.customer_home_rooms where home_id=v_id and not(id=any(v_room_ids));
    delete from public.customer_home_floors where home_id=v_id and not(id=any(v_floor_ids));
    v_result:=jsonb_build_object('home',private.customer_home_document(v_id));
    if v_new_address is not null then v_result:=v_result||jsonb_build_object('address',v_new_address); end if;
  end if;
  if v_key is not null then insert into private.customer_home_operations(customer_id,idempotency_key,operation,input,result) values(v_customer,v_key,p_operation,v_original_input,v_result); end if;
  return v_result;
end;
$$;
create function public.write_customer_home(p_operation text,p_id uuid,p_expected_version integer,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.write_customer_home(p_operation,p_id,p_expected_version,p_data); $$;
revoke all on function private.write_customer_home(text,uuid,integer,jsonb),public.write_customer_home(text,uuid,integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.write_customer_home(text,uuid,integer,jsonb),public.write_customer_home(text,uuid,integer,jsonb) to authenticated;

create function private.read_customer_homes() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_customer uuid:=private.current_customer_id();
begin
  if v_customer is null then raise exception using errcode='42501',message='Customer session required'; end if;
  return jsonb_build_object('homes',coalesce((select jsonb_agg(private.customer_home_document(h.id) order by h.created_at,h.id) from public.customer_homes h where h.customer_id=v_customer and h.archived_at is null),'[]'::jsonb),
    'addresses',coalesce((select jsonb_agg(private.customer_address_document(a) order by a.is_default desc,a.created_at,a.id) from public.customer_addresses a where a.customer_id=v_customer and a.archived_at is null),'[]'::jsonb),
    'equipment',coalesce((select jsonb_agg(private.customer_equipment_document(e) order by e.created_at,e.id) from public.customer_equipment e where e.customer_id=v_customer and e.archived_at is null),'[]'::jsonb));
end;
$$;
create function public.read_customer_homes() returns jsonb language sql stable security invoker set search_path='' as $$ select private.read_customer_homes(); $$;
revoke all on function private.read_customer_homes(),public.read_customer_homes() from public,anon,authenticated,service_role;
grant execute on function private.read_customer_homes(),public.read_customer_homes() to authenticated;
notify pgrst,'reload schema';
