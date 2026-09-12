alter table public.profiles add column version integer not null default 1;
alter table public.profiles add column notification_preference text not null default 'email'
  check(notification_preference in ('email','whatsapp','both'));
alter table public.customer_addresses add column version integer not null default 1;
alter table public.customer_addresses add column label text;
alter table public.customer_addresses add column archived_at timestamptz;
alter table public.customer_equipment add column version integer not null default 1;
alter table public.customer_equipment add column archived_at timestamptz;

-- Retain the most recently edited default if legacy rows have several.
with ranked as (select id,row_number() over(partition by customer_id order by updated_at desc,id desc) as position from public.customer_addresses where is_default)
update public.customer_addresses a set is_default=false from ranked r where a.id=r.id and r.position>1;
create unique index idx_one_active_default_address on public.customer_addresses(customer_id) where is_default and archived_at is null;
create index idx_customer_address_page on public.customer_addresses(customer_id,created_at desc,id desc);

create function private.advance_asset_version() returns trigger language plpgsql set search_path='' as $$
begin new.version=old.version+1; return new; end;
$$;
revoke all on function private.advance_asset_version() from public,anon,authenticated,service_role;
create trigger profiles_asset_version before update on public.profiles for each row execute function private.advance_asset_version();
create trigger addresses_asset_version before update on public.customer_addresses for each row execute function private.advance_asset_version();
create trigger equipment_asset_version before update on public.customer_equipment for each row execute function private.advance_asset_version();

create function private.customer_profile_document(p public.profiles) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('id',p.id,'firstName',p.first_name,'lastName',p.last_name,'email',p.email,'phone',coalesce(p.phone,''),'notificationPreference',p.notification_preference,'version',p.version);
$$;
create function private.customer_address_document(a public.customer_addresses) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('id',a.id,'label',coalesce(a.label,concat_ws(' ',a.street,a.number)),
    'street',a.street,'number',a.number,'floor',a.floor,'apartment',a.apartment,'city',a.city,'province',a.province,
    'postalCode',a.postal_code,'reference',a.reference,'propertyType',a.property_type,'isDefault',a.is_default,
    'access',jsonb_strip_nulls(jsonb_build_object('hasElevator',a.has_elevator,'hasParking',a.has_parking,'stairsRequired',a.stairs_required,'outdoorUnitAtHeight',a.outdoor_unit_at_height,'outdoorUnitOnBalcony',a.outdoor_unit_on_balcony,'difficultAccess',a.difficult_access)),
    'version',a.version,'createdAt',a.created_at,'archivedAt',a.archived_at);
$$;
create function private.customer_equipment_document(e public.customer_equipment) returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('id',e.id,'nickname',e.nickname,'addressId',e.address_id,'brand',e.brand,'model',e.model,
    'equipmentType',e.equipment_type,'frigorias',e.frigorias,'serialNumber',e.serial_number,'version',e.version,'createdAt',e.created_at,'archivedAt',e.archived_at);
$$;
revoke all on function private.customer_profile_document(public.profiles),private.customer_address_document(public.customer_addresses),private.customer_equipment_document(public.customer_equipment) from public,anon,authenticated,service_role;

create function private.validate_asset_object(p_data jsonb,p_keys text[]) returns void language plpgsql set search_path='' as $$
begin
  if p_data is null or jsonb_typeof(p_data)<>'object' or exists(select 1 from jsonb_object_keys(p_data) k where not k=any(p_keys)) then
    raise exception using errcode='22023',message='Invalid asset fields';
  end if;
end;
$$;
revoke all on function private.validate_asset_object(jsonb,text[]) from public,anon,authenticated,service_role;

create function private.write_customer_asset(p_kind text,p_id uuid,p_expected_version integer,p_data jsonb,p_archive boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_customer uuid:=private.current_customer_id(); v_profile public.profiles%rowtype;
  v_address public.customer_addresses%rowtype; v_equipment public.customer_equipment%rowtype;
  v_id uuid; v_replaced uuid; v_access jsonb; v_category uuid; v_request uuid; v_job public.jobs%rowtype;
begin
  if v_customer is null then raise exception using errcode='42501',message='Customer session required'; end if;
  -- Serialize defaults, versions and links for this owner, not the entire table.
  perform 1 from public.customer_profiles where id=v_customer for update;
  if p_kind not in ('profile','address','equipment') or p_kind is null or p_archive is null then
    raise exception using errcode='22023',message='Invalid asset operation';
  end if;
  if (p_id is not null or p_kind='profile') and (p_expected_version is null or p_expected_version<1) then
    raise exception using errcode='22023',message='Expected asset version required';
  end if;
  if p_archive and (p_id is null or p_kind='profile' or p_data is distinct from '{}'::jsonb) then
    raise exception using errcode='22023',message='Invalid archive operation';
  end if;
  if p_kind='profile' then
    perform private.validate_asset_object(p_data,array['firstName','lastName','phone','notificationPreference']);
    if exists(select 1 from jsonb_each(p_data) where jsonb_typeof(value)<>'string')
      or length(btrim(coalesce(p_data->>'firstName',''))) not between 1 and 100
      or length(btrim(coalesce(p_data->>'lastName',''))) not between 1 and 100
      or length(regexp_replace(coalesce(p_data->>'phone',''),'[^0-9]','','g'))<8
      or length(p_data->>'phone')>40
      or coalesce(p_data->>'notificationPreference','') not in ('email','whatsapp','both') then
      raise exception using errcode='22023',message='Invalid profile details';
    end if;
    select * into v_profile from public.profiles where id=private.current_profile_id() for update;
    if not found or (p_id is not null and p_id<>v_profile.id) then raise exception using errcode='P0002',message='Asset not found'; end if;
    if v_profile.version<>p_expected_version then raise exception using errcode='40001',message='Asset version changed'; end if;
    update public.profiles set first_name=btrim(p_data->>'firstName'),last_name=btrim(p_data->>'lastName'),phone=btrim(p_data->>'phone'),notification_preference=p_data->>'notificationPreference'
      where id=v_profile.id returning * into v_profile;
    return jsonb_build_object('profile',private.customer_profile_document(v_profile));
  end if;
  if p_kind='address' then
    if p_id is not null then
      select * into v_address from public.customer_addresses where id=p_id and customer_id=v_customer and archived_at is null for update;
      if not found then raise exception using errcode='P0002',message='Asset not found'; end if;
      if v_address.version<>p_expected_version then raise exception using errcode='40001',message='Asset version changed'; end if;
      if p_archive then
        update public.customer_addresses set archived_at=now(),is_default=false where id=p_id returning * into v_address;
        return jsonb_build_object('address',private.customer_address_document(v_address));
      end if;
    end if;
    perform private.validate_asset_object(p_data,array['label','street','number','floor','apartment','city','province','postalCode','reference','propertyType','access','isDefault']);
    v_access=coalesce(p_data->'access','{}'::jsonb);
    perform private.validate_asset_object(v_access,array['hasElevator','hasParking','stairsRequired','outdoorUnitAtHeight','outdoorUnitOnBalcony','difficultAccess']);
    if exists(select 1 from jsonb_each(v_access) where jsonb_typeof(value)<>'boolean')
      or exists(select 1 from jsonb_each(p_data) where key not in ('access','isDefault') and jsonb_typeof(value) not in ('string','null'))
      or (p_data ? 'isDefault' and jsonb_typeof(p_data->'isDefault')<>'boolean')
      or length(btrim(coalesce(p_data->>'label',''))) not between 1 and 80
      or length(btrim(coalesce(p_data->>'street',''))) not between 1 and 200
      or length(btrim(coalesce(p_data->>'number',''))) not between 1 and 30
      or length(btrim(coalesce(p_data->>'city',''))) not between 1 and 100
      or length(btrim(coalesce(p_data->>'province',''))) not between 1 and 100
      or coalesce(p_data->>'propertyType','') not in ('apartment','house','commercial')
      or length(coalesce(p_data->>'floor',''))>100 or length(coalesce(p_data->>'apartment',''))>100
      or length(coalesce(p_data->>'postalCode',''))>30 or length(coalesce(p_data->>'reference',''))>500 then
      raise exception using errcode='22023',message='Invalid address details';
    end if;
    v_id=p_id;
    if p_id is not null and (exists(select 1 from public.service_requests where address_id=p_id) or exists(select 1 from public.customer_equipment where address_id=p_id)) then
      -- Never rewrite an address used by a service or an equipment record.
      update public.customer_addresses set archived_at=now(),is_default=false where id=p_id;
      v_replaced=p_id; v_id=null;
    end if;
    if coalesce((p_data->>'isDefault')::boolean,false) then
      update public.customer_addresses set is_default=false where customer_id=v_customer and is_default and id is distinct from v_id;
    end if;
    if v_id is null then
      insert into public.customer_addresses(customer_id,label,street,number,city,province) values(v_customer,btrim(p_data->>'label'),btrim(p_data->>'street'),btrim(p_data->>'number'),btrim(p_data->>'city'),btrim(p_data->>'province')) returning id into v_id;
    end if;
    update public.customer_addresses set label=btrim(p_data->>'label'),street=btrim(p_data->>'street'),number=btrim(p_data->>'number'),
      floor=nullif(btrim(p_data->>'floor'),''),apartment=nullif(btrim(p_data->>'apartment'),''),city=btrim(p_data->>'city'),province=btrim(p_data->>'province'),postal_code=nullif(btrim(p_data->>'postalCode'),''),reference=nullif(btrim(p_data->>'reference'),''),property_type=(p_data->>'propertyType')::public.property_type,
      has_elevator=(v_access->>'hasElevator')::boolean,has_parking=(v_access->>'hasParking')::boolean,stairs_required=(v_access->>'stairsRequired')::boolean,outdoor_unit_at_height=(v_access->>'outdoorUnitAtHeight')::boolean,outdoor_unit_on_balcony=(v_access->>'outdoorUnitOnBalcony')::boolean,difficult_access=(v_access->>'difficultAccess')::boolean,is_default=coalesce((p_data->>'isDefault')::boolean,false)
      where id=v_id returning * into v_address;
    return jsonb_build_object('address',private.customer_address_document(v_address),'replacedId',v_replaced);
  end if;
  if p_id is not null then
    select * into v_equipment from public.customer_equipment where id=p_id and customer_id=v_customer and archived_at is null for update;
    if not found then raise exception using errcode='P0002',message='Asset not found'; end if;
    if v_equipment.version<>p_expected_version then raise exception using errcode='40001',message='Asset version changed'; end if;
    if not p_archive then raise exception using errcode='22023',message='Equipment operation unavailable'; end if;
    update public.customer_equipment set archived_at=now() where id=p_id returning * into v_equipment;
    return jsonb_build_object('equipment',private.customer_equipment_document(v_equipment));
  end if;
  perform private.validate_asset_object(p_data,array['nickname','addressId','equipmentType','brand','model','serialNumber','frigorias','requestId','jobId']);
  if exists(select 1 from jsonb_each(p_data) where key<>'frigorias' and jsonb_typeof(value) not in ('string','null'))
    or length(btrim(coalesce(p_data->>'nickname',''))) not between 1 and 100
    or coalesce(p_data->>'equipmentType','') not in ('split','inverter','on_off','window','floor_ceiling','central')
    or length(coalesce(p_data->>'brand',''))>200 or length(coalesce(p_data->>'model',''))>200 or length(coalesce(p_data->>'serialNumber',''))>200
    or (p_data ? 'frigorias' and p_data->'frigorias'<>'null'::jsonb and (jsonb_typeof(p_data->'frigorias')<>'number' or (p_data->>'frigorias')::numeric not between 1000 and 30000 or (p_data->>'frigorias')::numeric<>trunc((p_data->>'frigorias')::numeric))) then
    raise exception using errcode='22023',message='Invalid equipment details';
  end if;
  if nullif(p_data->>'addressId','') is not null then
    select * into v_address from public.customer_addresses where id=(p_data->>'addressId')::uuid and customer_id=v_customer and archived_at is null for share;
    if not found then raise exception using errcode='P0002',message='Asset not found'; end if;
  end if;
  v_request=(p_data->>'requestId')::uuid;
  if nullif(p_data->>'jobId','') is not null then
    select * into v_job from public.jobs where id=(p_data->>'jobId')::uuid and customer_id=v_customer for update;
    if not found or (v_request is not null and v_request<>v_job.request_id) then raise exception using errcode='P0002',message='Asset not found'; end if;
    v_request=v_job.request_id;
  end if;
  if v_request is not null then
    perform 1 from public.service_requests where id=v_request and customer_id=v_customer for update;
    if not found then raise exception using errcode='P0002',message='Asset not found'; end if;
    if exists(select 1 from public.service_requests where id=v_request and equipment_id is not null) then raise exception using errcode='40001',message='Request already has equipment'; end if;
  end if;
  select id into v_category from public.service_categories where slug='aire_acondicionado' and active;
  if v_category is null then raise exception using errcode='22023',message='Equipment category unavailable'; end if;
  insert into public.customer_equipment(customer_id,address_id,category_id,nickname,brand,model,equipment_type,frigorias,serial_number)
  values(v_customer,v_address.id,v_category,btrim(p_data->>'nickname'),nullif(btrim(p_data->>'brand'),''),nullif(btrim(p_data->>'model'),''),p_data->>'equipmentType',p_data->>'frigorias',nullif(btrim(p_data->>'serialNumber'),'')) returning * into v_equipment;
  if v_request is not null then update public.service_requests set equipment_id=v_equipment.id where id=v_request; end if;
  return jsonb_build_object('equipment',private.customer_equipment_document(v_equipment));
end;
$$;
create function public.write_customer_asset(p_kind text,p_id uuid,p_expected_version integer,p_data jsonb,p_archive boolean default false) returns jsonb
language sql security invoker set search_path='' as $$ select private.write_customer_asset(p_kind,p_id,p_expected_version,p_data,p_archive); $$;
revoke all on function private.write_customer_asset(text,uuid,integer,jsonb,boolean),public.write_customer_asset(text,uuid,integer,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function private.write_customer_asset(text,uuid,integer,jsonb,boolean),public.write_customer_asset(text,uuid,integer,jsonb,boolean) to authenticated;

-- No direct REST write can bypass versions, ownership validation or archival.
revoke update on public.profiles from authenticated;
revoke update(first_name,last_name,phone,avatar_url) on public.profiles from authenticated;
revoke insert,update,delete on public.customer_addresses,public.customer_equipment from authenticated;
do $$ declare c record; begin
  for c in select table_name,column_name,privilege_type from information_schema.column_privileges where table_schema='public' and table_name in ('customer_addresses','customer_equipment') and grantee='authenticated' and privilege_type in ('INSERT','UPDATE') loop
    execute format('revoke %s (%I) on public.%I from authenticated',c.privilege_type,c.column_name,c.table_name);
  end loop;
end; $$;
