alter table public.professional_service_zones add column service_zone_id uuid references public.service_zones(id);
update public.professional_service_zones p set service_zone_id=z.id from public.service_zones z where z.name=p.zone_name;
create unique index professional_zone_identity on public.professional_service_zones(professional_id,service_zone_id) where service_zone_id is not null;

create function private.cancel_professional_invitation(p_id uuid,p_expected_version integer,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_row public.professional_invitations%rowtype;
begin
  v_actor=private.lock_admin_mutation('operations');
  if length(btrim(coalesce(p_reason,''))) not between 10 and 1000 then raise exception using errcode='22023',message='Cancellation reason required'; end if;
  select * into v_row from public.professional_invitations where id=p_id for update;
  if not found then raise exception using errcode='P0002',message='Invitation unavailable'; end if;
  if p_expected_version is null or v_row.version<>p_expected_version or v_row.status not in ('queued','sent') or v_row.consumed_at is not null then
    raise exception using errcode='40001',message='Invitation no longer cancellable at this version'; end if;
  update public.professional_invitations set status='cancelled' where id=p_id;
  -- Preserve the delivery ledger. The worker must check invitation status before
  -- sending and acknowledge a cancelled delivery without contacting a provider.
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'professional.invitation.cancelled','professional_invitation',p_id,jsonb_build_object('reason',btrim(p_reason),'from_status',v_row.status,'to_status','cancelled'));
  return private.invitation_document(p_id);
end;
$$;
create function public.cancel_professional_invitation(p_id uuid,p_expected_version integer,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$ select private.cancel_professional_invitation(p_id,p_expected_version,p_reason); $$;
revoke all on function private.cancel_professional_invitation(uuid,integer,text),public.cancel_professional_invitation(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function private.cancel_professional_invitation(uuid,integer,text),public.cancel_professional_invitation(uuid,integer,text) to authenticated;

create function private.professional_application_document(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('professionalId',pp.id,'version',pp.version,'status',pp.status,'firstName',p.first_name,'lastName',p.last_name,
    'email',p.email,'phone',coalesce(p.phone,''),'dni',coalesce(pp.dni,''),'cuil',coalesce(pp.cuil,''),'birthdate',coalesce(pp.birthdate::text,''),
    'yearsExperience',pp.years_experience,'licenseNumber',coalesce(pp.license_number,''),'licenseEntity',coalesce(pp.license_entity,''),
    'hasMobility',pp.has_mobility,'mobilityType',coalesce(pp.mobility_type,''),'bio',coalesce(pp.bio,''),
    'categoryIds',coalesce((select jsonb_agg(category_id order by category_id) from public.professional_service_categories where professional_id=pp.id),'[]'::jsonb),
    'zoneIds',coalesce((select jsonb_agg(service_zone_id order by service_zone_id) from public.professional_service_zones where professional_id=pp.id and active and service_zone_id is not null),'[]'::jsonb),
    'tools',coalesce((select jsonb_agg(tool_code order by tool_code) from public.professional_tools where professional_id=pp.id and has_tool),'[]'::jsonb),
    'availability',coalesce((select jsonb_agg(jsonb_build_object('weekday',weekday,'startTime',to_char(start_time,'HH24:MI'),'endTime',to_char(end_time,'HH24:MI')) order by weekday,start_time) from public.professional_availability where professional_id=pp.id and active),'[]'::jsonb))
  from public.professional_profiles pp join public.profiles p on p.id=pp.profile_id where pp.id=p_id;
$$;
revoke all on function private.professional_application_document(uuid) from public,anon,authenticated,service_role;

create or replace function private.read_professional_onboarding() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_pro public.professional_profiles%rowtype;
begin
  select * into v_pro from public.professional_profiles where id=private.current_professional_id(false);
  if not found or v_pro.status not in ('form_started','form_submitted','under_review','rejected','approved')
    or not exists(select 1 from public.professional_invitations where id=v_pro.invitation_id and bound_auth_user_id=auth.uid() and consumed_at is not null and status in ('opened','completed')) then
    raise exception using errcode='42501',message='Bound professional application required'; end if;
  return private.professional_application_document(v_pro.id);
end;
$$;

create function private.save_professional_onboarding(p_expected_version integer,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_pro public.professional_profiles%rowtype;v_item jsonb;v_text text;v_categories uuid[];v_zones uuid[];
begin
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=private.current_session_id() and u.id=auth.uid() for share of s,u;
  if not found or not private.current_session_active(false) then raise exception using errcode='42501',message='Active professional session required'; end if;
  select * into v_pro from public.professional_profiles where id=private.current_professional_id(false) for update;
  if not found or v_pro.status not in ('form_started','rejected') then raise exception using errcode='42501',message='Editable professional application required'; end if;
  perform 1 from public.professional_invitations where id=v_pro.invitation_id and bound_auth_user_id=auth.uid() and consumed_at is not null and status='opened' for share;
  if not found then raise exception using errcode='42501',message='Bound professional application required'; end if;
  if p_expected_version is null or v_pro.version<>p_expected_version then raise exception using errcode='40001',message='Application changed'; end if;
  perform private.validate_asset_object(p_input,array['firstName','lastName','phone','dni','cuil','birthdate','yearsExperience','licenseNumber','licenseEntity','hasMobility','mobilityType','bio','categoryIds','zoneIds','tools','availability']);
  if not p_input ?& array['firstName','lastName','phone','dni','cuil','birthdate','yearsExperience','licenseNumber','licenseEntity','hasMobility','mobilityType','bio','categoryIds','zoneIds','tools','availability'] then
    raise exception using errcode='22023',message='Complete draft shape required'; end if;
  foreach v_text in array array['firstName','lastName','phone','dni','cuil','birthdate','licenseNumber','licenseEntity','mobilityType','bio'] loop
    if jsonb_typeof(p_input->v_text)<>'string' or length(p_input->>v_text)>(case when v_text='bio' then 2000 else 100 end) then raise exception using errcode='22023',message='Invalid draft text'; end if;
  end loop;
  if jsonb_typeof(p_input->'yearsExperience')<>'number' or (p_input->>'yearsExperience')::numeric not between 0 and 80
    or (p_input->>'yearsExperience')::numeric<>trunc((p_input->>'yearsExperience')::numeric)
    or jsonb_typeof(p_input->'hasMobility')<>'boolean'
    or ((p_input->>'birthdate')<>'' and ((p_input->>'birthdate')!~ '^\d{4}-\d{2}-\d{2}$' or (p_input->>'birthdate')::date>current_date)) then raise exception using errcode='22023',message='Invalid draft values'; end if;
  foreach v_text in array array['categoryIds','zoneIds','tools','availability'] loop
    if jsonb_typeof(p_input->v_text)<>'array' then raise exception using errcode='22023',message='Invalid draft list'; end if;
    if jsonb_array_length(p_input->v_text)>50 then raise exception using errcode='22023',message='Draft list too large'; end if;
  end loop;
  select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_categories from jsonb_array_elements_text(p_input->'categoryIds');
  select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_zones from jsonb_array_elements_text(p_input->'zoneIds');
  if cardinality(v_categories)<>(select count(distinct id) from public.service_categories where id=any(v_categories) and active)
    or cardinality(v_zones)<>(select count(distinct id) from public.service_zones where id=any(v_zones) and active) then raise exception using errcode='22023',message='Active unique categories and zones required'; end if;
  perform 1 from public.service_categories where id=any(v_categories) for share;
  perform 1 from public.service_zones where id=any(v_zones) for share;
  for v_text in select value from jsonb_array_elements_text(p_input->'tools') loop
    if v_text not in ('vacuum_pump','manifold_r410a_r32','digital_scale','multimeter','clamp_meter','leak_detector','thermometer','ladder','safety_equipment') then raise exception using errcode='22023',message='Unknown tool'; end if;
  end loop;
  for v_item in select value from jsonb_array_elements(p_input->'availability') loop
    perform private.validate_asset_object(v_item,array['weekday','startTime','endTime']);
    if not v_item ?& array['weekday','startTime','endTime'] or jsonb_typeof(v_item->'weekday')<>'number'
      or (v_item->>'weekday')::numeric not between 0 and 6 or (v_item->>'weekday')::numeric<>trunc((v_item->>'weekday')::numeric)
      or (v_item->>'startTime')!~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (v_item->>'endTime')!~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or (v_item->>'startTime')::time>=(v_item->>'endTime')::time then raise exception using errcode='22023',message='Invalid availability'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_input->'availability') with ordinality a(item,n)
    join jsonb_array_elements(p_input->'availability') with ordinality b(item,n) on a.n<b.n
    where a.item->>'weekday'=b.item->>'weekday' and (a.item->>'startTime')::time<(b.item->>'endTime')::time and (b.item->>'startTime')::time<(a.item->>'endTime')::time) then
    raise exception using errcode='22023',message='Availability overlaps'; end if;
  update public.profiles set first_name=btrim(p_input->>'firstName'),last_name=btrim(p_input->>'lastName'),phone=btrim(p_input->>'phone') where id=v_pro.profile_id;
  update public.professional_profiles set dni=p_input->>'dni',cuil=p_input->>'cuil',birthdate=nullif(p_input->>'birthdate','')::date,
    years_experience=(p_input->>'yearsExperience')::integer,license_number=p_input->>'licenseNumber',license_entity=p_input->>'licenseEntity',
    has_mobility=(p_input->>'hasMobility')::boolean,mobility_type=p_input->>'mobilityType',bio=p_input->>'bio' where id=v_pro.id;
  delete from public.professional_service_categories where professional_id=v_pro.id;
  insert into public.professional_service_categories(professional_id,category_id,approved) select v_pro.id,id,false from unnest(v_categories) id;
  delete from public.professional_service_zones where professional_id=v_pro.id;
  insert into public.professional_service_zones(professional_id,service_zone_id,zone_slug,zone_name) select v_pro.id,id,id::text,name from public.service_zones where id=any(v_zones);
  delete from public.professional_tools where professional_id=v_pro.id;
  insert into public.professional_tools(professional_id,tool_code,tool_label,has_tool) select distinct v_pro.id,value,value,true from jsonb_array_elements_text(p_input->'tools');
  delete from public.professional_availability where professional_id=v_pro.id;
  insert into public.professional_availability(professional_id,weekday,start_time,end_time) select v_pro.id,(item->>'weekday')::integer,(item->>'startTime')::time,(item->>'endTime')::time from jsonb_array_elements(p_input->'availability') item;
  return private.professional_application_document(v_pro.id);
end;
$$;
create function public.save_professional_onboarding(p_expected_version integer,p_input jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.save_professional_onboarding(p_expected_version,p_input); $$;
revoke all on function private.save_professional_onboarding(integer,jsonb),public.save_professional_onboarding(integer,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.save_professional_onboarding(integer,jsonb),public.save_professional_onboarding(integer,jsonb) to authenticated;

revoke insert,update,delete on public.professional_tools,public.professional_service_categories,public.professional_service_zones,public.professional_availability from authenticated;
do $$ declare c record; begin
  for c in select table_name,column_name,privilege_type from information_schema.column_privileges where table_schema='public' and table_name in ('professional_tools','professional_service_categories','professional_service_zones','professional_availability') and grantee='authenticated' and privilege_type in ('INSERT','UPDATE') loop
    execute format('revoke %s (%I) on public.%I from authenticated',c.privilege_type,c.column_name,c.table_name);
  end loop;
end; $$;
