-- Deny UNKNOWN (NULL) authorization results and preserve current role/ownership checks.
-- Privileged implementations are private; public RPCs execute with invoker privileges.
begin;

create or replace function private.guarded_get_schedule_availability(p_professional_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security definer set search_path='' as $guarded$
declare v_self uuid:=private.current_professional_id(false);
begin
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>31 then
    raise exception using errcode='22023',message='invalid_date_range'; end if;
  if p_professional_id is null or ((v_self is not null and p_professional_id=v_self) or private.has_admin_permission('operations')) is not true then
    raise exception using errcode='42501',message='schedule_read_forbidden'; end if;
  perform private.expire_schedule_holds(p_professional_id);
  return jsonb_build_object(
    'timezone','America/Argentina/Buenos_Aires',
    'settingsVersion',(select schedule_settings_version from public.professional_profiles where id=p_professional_id),
    'windows',coalesce((select jsonb_agg(jsonb_build_object('weekday',weekday,'startTime',start_time,'endTime',end_time) order by weekday,start_time)
      from public.professional_availability where professional_id=p_professional_id and active),'[]'::jsonb),
    'absences',coalesce((select jsonb_agg(jsonb_build_object('startsAt',starts_at,'endsAt',ends_at) order by starts_at)
      from public.professional_absences where professional_id=p_professional_id
        and starts_at<((p_to+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
        and ends_at>=(p_from::timestamp at time zone 'America/Argentina/Buenos_Aires')),'[]'::jsonb),
    'reservations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'jobId',job_id,'version',version,'startsAt',starts_at,
      'endsAt',ends_at,'localDate',local_visit_date,'state',state,'holdExpiresAt',hold_expires_at) order by starts_at,id)
      from public.job_schedule_reservations where professional_id=p_professional_id and state in('hold','confirmed')
        and starts_at<((p_to+1)::timestamp at time zone 'America/Argentina/Buenos_Aires')
        and ends_at>=(p_from::timestamp at time zone 'America/Argentina/Buenos_Aires')),'[]'::jsonb));
end; $guarded$;
revoke all on function private.guarded_get_schedule_availability(uuid,date,date) from public,anon,authenticated,service_role;
grant execute on function private.guarded_get_schedule_availability(uuid,date,date) to authenticated;
create or replace function public.get_schedule_availability(p_professional_id uuid, p_from date, p_to date)
returns jsonb language sql security invoker set search_path='' as $api$
  select private.guarded_get_schedule_availability(p_professional_id,p_from,p_to);
$api$;

create or replace function private.guarded_replace_professional_schedule_settings(p_professional_id uuid, p_windows jsonb, p_absences jsonb, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $guarded$
declare v_pro public.professional_profiles%rowtype;v_actor uuid:=private.current_profile_id();v_item jsonb;v_start timestamptz;v_end timestamptz;
begin
  if v_actor is null or (
    p_professional_id=private.current_professional_id(true) or private.has_admin_permission('operations')) is not true then
    raise exception using errcode='42501',message='schedule_write_forbidden'; end if;
  if jsonb_typeof(p_windows) is distinct from 'array' or jsonb_typeof(p_absences) is distinct from 'array' or
    jsonb_array_length(p_windows)>50 or jsonb_array_length(p_absences)>50 then
    raise exception using errcode='22023',message='invalid_schedule_settings'; end if;
  select * into v_pro from public.professional_profiles where id=p_professional_id for update;
  if not found then raise exception using errcode='P0002',message='professional_not_found'; end if;
  if v_pro.schedule_settings_version is distinct from p_expected_version then raise exception using errcode='40001',message='schedule_version_conflict'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text,4515));
  delete from public.professional_availability where professional_id=p_professional_id;
  for v_item in select value from jsonb_array_elements(p_windows) loop
    if jsonb_typeof(v_item)<>'object' or not(v_item?&array['weekday','startTime','endTime']) or
      exists(select 1 from jsonb_object_keys(v_item) k where k not in('weekday','startTime','endTime')) or
      (v_item->>'weekday')::integer not between 0 and 6 or (v_item->>'startTime')::time>=(v_item->>'endTime')::time then
      raise exception using errcode='22023',message='invalid_availability_window'; end if;
    insert into public.professional_availability(professional_id,weekday,start_time,end_time)
      values(p_professional_id,(v_item->>'weekday')::integer,(v_item->>'startTime')::time,(v_item->>'endTime')::time);
  end loop;
  if exists(select 1 from public.professional_availability a join public.professional_availability b
    on a.professional_id=b.professional_id and a.weekday=b.weekday and a.id<b.id
      and a.start_time<b.end_time and b.start_time<a.end_time where a.professional_id=p_professional_id) then
    raise exception using errcode='22023',message='overlapping_availability_windows'; end if;
  delete from public.professional_absences where professional_id=p_professional_id and starts_at>=clock_timestamp();
  for v_item in select value from jsonb_array_elements(p_absences) loop
    if jsonb_typeof(v_item)<>'object' or exists(select 1 from jsonb_object_keys(v_item) k where k not in('startsAt','endsAt','reason')) then
      raise exception using errcode='22023',message='invalid_absence'; end if;
    v_start=(v_item->>'startsAt')::timestamptz;v_end=(v_item->>'endsAt')::timestamptz;
    if v_start<clock_timestamp() or v_end<=v_start or length(coalesce(v_item->>'reason','')) not between 5 and 500 then
      raise exception using errcode='22023',message='invalid_absence'; end if;
    insert into public.professional_absences(professional_id,starts_at,ends_at,reason,created_by)
      values(p_professional_id,v_start,v_end,v_item->>'reason',v_actor);
  end loop;
  for v_start,v_end in select starts_at,ends_at from public.job_schedule_reservations
    where professional_id=p_professional_id and state in('hold','confirmed')
  loop perform private.assert_schedule_candidate(p_professional_id,v_start,v_end); end loop;
  update public.professional_profiles set schedule_settings_version=schedule_settings_version+1 where id=p_professional_id;
  if public.current_user_role()='admin' then
    insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
      values(v_actor,'professional.schedule_settings_changed','professional',p_professional_id,
        jsonb_build_object('expectedVersion',p_expected_version));
  end if;
  return jsonb_build_object('professionalId',p_professional_id,'version',p_expected_version+1);
exception when invalid_text_representation or datetime_field_overflow then
  raise exception using errcode='22023',message='invalid_schedule_settings';
end; $guarded$;
revoke all on function private.guarded_replace_professional_schedule_settings(uuid,jsonb,jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function private.guarded_replace_professional_schedule_settings(uuid,jsonb,jsonb,integer) to authenticated;
create or replace function public.replace_professional_schedule_settings(p_professional_id uuid, p_windows jsonb, p_absences jsonb, p_expected_version integer)
returns jsonb language sql security invoker set search_path='' as $api$
  select private.guarded_replace_professional_schedule_settings(p_professional_id,p_windows,p_absences,p_expected_version);
$api$;

create or replace function private.guarded_request_job_reschedule(p_job_id uuid, p_starts_at timestamp with time zone, p_duration_minutes integer, p_travel_buffer_minutes integer, p_reason text, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $guarded$
declare v_job public.jobs%rowtype;v_actor uuid:=private.current_profile_id();v_role public.user_role:=public.current_user_role();v_id uuid;
begin
  if v_actor is null or v_role is null then raise exception using errcode='42501',message='current_session_required'; end if;
  if length(trim(p_reason)) not between 15 and 1000 then raise exception using errcode='22023',message='invalid_reason'; end if;
  if p_duration_minutes not between 30 and 480 or p_travel_buffer_minutes not between 0 and 180 then
    raise exception using errcode='22023',message='invalid_schedule_policy'; end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found then raise exception using errcode='P0002',message='job_not_found'; end if;
  if v_job.schedule_version is distinct from p_expected_version then raise exception using errcode='40001',message='schedule_version_conflict'; end if;
  if v_job.status not in('pending_professional_acceptance','confirmed') then raise exception using errcode='22023',message='job_not_reschedulable'; end if;
  if v_actor is null or ((v_role='customer' and v_job.customer_id=private.current_customer_id()) or
          (v_role='professional' and v_job.professional_id=private.current_professional_id(true)) or
          (v_role='admin' and private.has_admin_permission('operations'))) is not true then
    raise exception using errcode='42501',message='reschedule_forbidden'; end if;
  perform private.assert_schedule_candidate(v_job.professional_id,p_starts_at,p_starts_at+p_duration_minutes*interval '1 minute');
  update public.job_reschedule_requests set status='superseded',decided_at=clock_timestamp(),decided_by=v_actor
    where job_id=p_job_id and status='pending';
  insert into public.job_reschedule_requests(job_id,expected_schedule_version,requested_by,requested_by_role,reason,
    proposed_starts_at,proposed_ends_at,proposed_local_date,duration_minutes,travel_buffer_minutes,
    customer_approved_at,professional_approved_at)
  values(p_job_id,p_expected_version,v_actor,v_role,trim(p_reason),p_starts_at,p_starts_at+p_duration_minutes*interval '1 minute',
    (p_starts_at at time zone 'America/Argentina/Buenos_Aires')::date,p_duration_minutes,p_travel_buffer_minutes,
    case when v_role='customer' then clock_timestamp() end,case when v_role='professional' then clock_timestamp() end)
  returning id into v_id;
  insert into public.notifications(profile_id,event_type,title,body,entity_type,entity_id,action_url)
    select p.id,'job.reschedule_requested','Reprogramación pendiente','Hay una nueva fecha propuesta para tu visita.','job',p_job_id,
      case when p.role='professional' then '/pro/agenda' else '/mis-solicitudes/'||v_job.request_id::text end
    from public.profiles p where
      (p.role='customer' and exists(select 1 from public.customer_profiles c where c.id=v_job.customer_id and c.profile_id=p.id)) or
      (p.role='professional' and exists(select 1 from public.professional_profiles x where x.id=v_job.professional_id and x.profile_id=p.id));
  return jsonb_build_object('id',v_id,'status','pending','expectedVersion',p_expected_version);
end; $guarded$;
revoke all on function private.guarded_request_job_reschedule(uuid,timestamp with time zone,integer,integer,text,integer) from public,anon,authenticated,service_role;
grant execute on function private.guarded_request_job_reschedule(uuid,timestamp with time zone,integer,integer,text,integer) to authenticated;
create or replace function public.request_job_reschedule(p_job_id uuid, p_starts_at timestamp with time zone, p_duration_minutes integer, p_travel_buffer_minutes integer, p_reason text, p_expected_version integer)
returns jsonb language sql security invoker set search_path='' as $api$
  select private.guarded_request_job_reschedule(p_job_id,p_starts_at,p_duration_minutes,p_travel_buffer_minutes,p_reason,p_expected_version);
$api$;

create or replace function private.guarded_respond_job_reschedule(p_request_id uuid, p_decision text, p_expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $guarded$
declare v_request public.job_reschedule_requests%rowtype;v_job public.jobs%rowtype;v_actor uuid:=private.current_profile_id();
  v_role public.user_role:=public.current_user_role();v_res public.job_schedule_reservations%rowtype;
begin
  if p_decision is null or p_decision not in('approve','reject') then raise exception using errcode='22023',message='invalid_decision'; end if;
  -- Resolve the parent without locking the child. Every schedule mutation takes
  -- the job lock first, then the request lock; the reverse order can deadlock.
  select * into v_request from public.job_reschedule_requests where id=p_request_id;
  if not found then raise exception using errcode='P0002',message='reschedule_not_found'; end if;
  select * into v_job from public.jobs where id=v_request.job_id for update;
  if not found then raise exception using errcode='P0002',message='job_not_found'; end if;
  select * into v_request from public.job_reschedule_requests where id=p_request_id and job_id=v_job.id for update;
  if not found then raise exception using errcode='P0002',message='reschedule_not_found'; end if;
  if v_request.status<>'pending' or v_job.schedule_version is distinct from p_expected_version or v_request.expected_schedule_version is distinct from p_expected_version then
    raise exception using errcode='40001',message='schedule_version_conflict'; end if;
  if v_actor is null or ((v_role='customer' and v_job.customer_id=private.current_customer_id()) or
          (v_role='professional' and v_job.professional_id=private.current_professional_id(true))) is not true then
    raise exception using errcode='42501',message='reschedule_forbidden'; end if;
  if p_decision='reject' then
    update public.job_reschedule_requests set status='rejected',decided_by=v_actor,decided_at=clock_timestamp() where id=p_request_id;
    return jsonb_build_object('id',p_request_id,'status','rejected');
  end if;
  update public.job_reschedule_requests set
    customer_approved_at=case when v_role='customer' then coalesce(customer_approved_at,clock_timestamp()) else customer_approved_at end,
    professional_approved_at=case when v_role='professional' then coalesce(professional_approved_at,clock_timestamp()) else professional_approved_at end
    where id=p_request_id returning * into v_request;
  if v_request.customer_approved_at is null or v_request.professional_approved_at is null then
    return jsonb_build_object('id',p_request_id,'status','pending'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v_job.professional_id::text,4515));
  v_res=private.insert_schedule_reservation(v_job,v_request.proposed_starts_at,v_request.duration_minutes,
    v_request.travel_buffer_minutes,'confirmed',0,v_actor);
  update public.job_reschedule_requests set status='approved',decided_by=v_actor,decided_at=clock_timestamp() where id=p_request_id;
  insert into public.notifications(profile_id,event_type,title,body,entity_type,entity_id,action_url)
    select p.id,'job.rescheduled','Visita reprogramada','La nueva fecha de la visita quedó confirmada.','job',v_job.id,
      case when p.role='professional' then '/pro/agenda' else '/mis-solicitudes/'||v_job.request_id::text end
    from public.profiles p where
      (p.role='customer' and exists(select 1 from public.customer_profiles c where c.id=v_job.customer_id and c.profile_id=p.id)) or
      (p.role='professional' and exists(select 1 from public.professional_profiles x where x.id=v_job.professional_id and x.profile_id=p.id));
  return jsonb_build_object('id',p_request_id,'status','approved','scheduleVersion',v_res.version,
    'startsAt',v_res.starts_at,'endsAt',v_res.ends_at);
end; $guarded$;
revoke all on function private.guarded_respond_job_reschedule(uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function private.guarded_respond_job_reschedule(uuid,text,integer) to authenticated;
create or replace function public.respond_job_reschedule(p_request_id uuid, p_decision text, p_expected_version integer)
returns jsonb language sql security invoker set search_path='' as $api$
  select private.guarded_respond_job_reschedule(p_request_id,p_decision,p_expected_version);
$api$;

notify pgrst, 'reload schema';
commit;
