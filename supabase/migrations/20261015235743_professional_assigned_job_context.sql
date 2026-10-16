-- Read-only context for the currently assigned, currently cleared technician.
-- Owner-only Hogar policies remain unchanged; no inventory edit permission is added.
create function private.read_professional_job_context(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  v_professional uuid:=private.current_professional_id(true);
  v_job public.jobs%rowtype; v_request public.service_requests%rowtype;
  v_equipment public.customer_equipment%rowtype; v_home public.customer_homes%rowtype;
  v_visit_address uuid; v_issue text; v_access text; v_reported text;
  v_equipment_document jsonb; v_home_document jsonb;
begin
  -- The helper validates the real Auth session, trusted role, current approval,
  -- clearance/doc expiry, suspension and account ban on every invocation.
  if v_professional is null then
    raise exception using errcode='42501',message='Current approved professional required';
  end if;
  select * into v_job from public.jobs j
    where j.id=p_job_id and j.professional_id=v_professional;
  if v_job.id is null then raise exception using errcode='P0002',message='job_not_found'; end if;
  select * into v_request from public.service_requests r
    where r.id=v_job.request_id and r.customer_id=v_job.customer_id;
  if v_request.id is null then raise exception using errcode='P0002',message='job_not_found'; end if;
  select i.name into v_issue from public.service_issue_types i where i.id=v_request.issue_type_id;
  select a.answer_value into v_reported from public.request_answers a
    where a.request_id=v_request.id and a.question_code='customer_description';

  -- Automatic contracts pin the actual visit separately from an equipment's
  -- historical address. Never use equipment.address_id as the visit location.
  if v_request.contract_source='automatic_customer_request' then
    v_visit_address:=v_request.visit_address_id;
    v_access:=v_request.visit_address_snapshot->>'reference';
  else
    v_visit_address:=v_request.address_id;
    select a.reference into v_access from public.customer_addresses a
      where a.id=v_visit_address and a.customer_id=v_job.customer_id;
  end if;
  select * into v_equipment from public.customer_equipment e
    where e.id=v_request.equipment_id and e.customer_id=v_job.customer_id;
  if v_equipment.id is not null then
    v_equipment_document:=jsonb_build_object('id',v_equipment.id,'nickname',v_equipment.nickname,
      'addressId',v_equipment.address_id,'equipmentType',v_equipment.equipment_type,
      'brand',v_equipment.brand,'model',v_equipment.model,'serialNumber',v_equipment.serial_number,
      'frigorias',v_equipment.frigorias,'version',v_equipment.version,
      'createdAt',v_equipment.created_at,'archivedAt',v_equipment.archived_at);
  end if;

  -- Select only the contracted home (or the assigned equipment's legacy home)
  -- and require an explicit link to the contracted visit address, never text matching.
  select h.* into v_home from public.customer_homes h
    where h.customer_id=v_job.customer_id and h.archived_at is null
      and (h.current_address_id=v_visit_address or exists(select 1 from public.customer_home_addresses a
        where a.home_id=h.id and a.customer_id=v_job.customer_id and a.address_id=v_visit_address and a.archived_at is null))
      and (case when v_request.contract_source='automatic_customer_request'
        then h.id::text=v_request.context_snapshot->'home'->>'id'
        else exists(select 1 from public.customer_equipment_placements p
          where p.home_id=h.id and p.customer_id=v_job.customer_id and p.equipment_id=v_request.equipment_id) end)
    limit 1;
  if v_home.id is not null then
    v_home_document:=jsonb_build_object('id',v_home.id,'name',v_home.name,'addressId',v_visit_address,
      'kind',v_home.kind,'building',v_home.building,'version',v_home.version,
      'features',jsonb_build_object('balcony',v_home.balcony,'terrace',v_home.terrace,'windows',v_home.windows),
      'floors',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'order',f.sort_order,
        'rooms',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'kind',r.kind,
          'variant',r.variant,'x',r.x,'z',r.z,'width',r.width,'depth',r.depth,'rotation',r.rotation,'windows',r.windows)
          order by r.z,r.x,r.id) from public.customer_home_rooms r
          where r.floor_id=f.id and r.home_id=v_home.id and r.customer_id=v_job.customer_id),'[]'::jsonb))
        order by f.sort_order,f.id) from public.customer_home_floors f
        where f.home_id=v_home.id and f.customer_id=v_job.customer_id),'[]'::jsonb),
      'placements',coalesce((select jsonb_agg(jsonb_build_object('equipmentId',p.equipment_id,'roomId',p.room_id,
        'wall',p.wall,'offset',p.wall_offset,'height',p.height)) from public.customer_equipment_placements p
        where p.home_id=v_home.id and p.customer_id=v_job.customer_id and p.equipment_id=v_request.equipment_id),'[]'::jsonb));
  end if;

  return jsonb_build_object('jobId',v_job.id,'issueLabel',v_issue,
    'reportedProblem',v_reported,'accessInstructions',v_access,'equipment',v_equipment_document,'home',v_home_document,
    'requestPhotoIds',coalesce((select jsonb_agg(photo.id order by photo.created_at,photo.id) from (
      select m.id,m.created_at from public.request_media m join private.upload_intents i
        on i.id=m.id and i.attachment_id=m.id and i.entity_id=v_request.id and i.kind='request-photo' and i.status='verified'
      where m.request_id=v_request.id and m.media_type='photo' and m.storage_bucket=i.output_bucket and m.storage_path=i.output_path
        and exists(select 1 from storage.objects o where o.bucket_id=i.output_bucket and o.name=i.output_path)
      order by m.created_at,m.id limit 10) photo),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'createdAt',r.created_at,
      'diagnosis',r.real_diagnosis,'work',r.work_done,'nextMaintenanceDate',r.next_maintenance_date)
      order by r.created_at desc,r.id desc) from (select s.id,s.created_at,s.real_diagnosis,s.work_done,s.next_maintenance_date
        from public.equipment_service_records s where s.equipment_id=v_equipment.id
        order by s.created_at desc,s.id desc limit 50) r),'[]'::jsonb),
    'initialPaymentStatus',(select c.status from public.marketplace_checkouts c
      where c.job_id=v_job.id and c.customer_id=v_job.customer_id and c.professional_id=v_professional and c.extra_id is null),
    'extraPayments',coalesce((select jsonb_agg(jsonb_build_object('extraId',c.extra_id,'status',c.status)
      order by c.created_at,c.id) from public.marketplace_checkouts c
      where c.job_id=v_job.id and c.customer_id=v_job.customer_id and c.professional_id=v_professional and c.extra_id is not null),'[]'::jsonb));
end;
$$;
create function public.read_professional_job_context(p_job_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select private.read_professional_job_context(p_job_id);
$$;
revoke all on function private.read_professional_job_context(uuid),public.read_professional_job_context(uuid)
  from public,anon,authenticated,service_role;
grant execute on function private.read_professional_job_context(uuid),public.read_professional_job_context(uuid) to authenticated;
