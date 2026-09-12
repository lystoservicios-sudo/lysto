create extension if not exists btree_gist with schema extensions;

alter table public.jobs add column schedule_version integer not null default 0 check(schedule_version>=0);
alter table public.professional_profiles add column schedule_settings_version integer not null default 0
  check(schedule_settings_version>=0);

create table public.professional_absences (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check(ends_at>starts_at),
  check(reason is null or length(reason) between 5 and 500)
);
create index professional_absences_range on public.professional_absences
  using gist(professional_id,tstzrange(starts_at,ends_at,'[)'));

create table public.job_schedule_reservations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id),
  version integer not null check(version>0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  local_visit_date date not null,
  timezone text not null default 'America/Argentina/Buenos_Aires'
    check(timezone='America/Argentina/Buenos_Aires'),
  duration_minutes integer not null check(duration_minutes between 30 and 480),
  travel_buffer_minutes integer not null default 30 check(travel_buffer_minutes between 0 and 180),
  state text not null check(state in ('hold','confirmed','released','expired')),
  hold_expires_at timestamptz,
  released_reason text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  released_at timestamptz,
  check(ends_at=starts_at+duration_minutes*interval '1 minute'),
  check((state='hold' and hold_expires_at is not null) or state<>'hold'),
  check(released_reason is null or length(released_reason) between 5 and 500),
  unique(job_id,version)
);
alter table public.job_schedule_reservations add constraint job_schedule_no_professional_overlap
  exclude using gist (
    professional_id with =,
    tstzrange(
      starts_at-travel_buffer_minutes*interval '1 minute',
      ends_at+travel_buffer_minutes*interval '1 minute','[)'
    ) with &&
  ) where(state in ('hold','confirmed'));
create unique index job_schedule_one_active on public.job_schedule_reservations(job_id)
  where state in ('hold','confirmed');
create index job_schedule_professional_range on public.job_schedule_reservations(professional_id,starts_at,ends_at)
  where state in ('hold','confirmed');

create table public.job_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  expected_schedule_version integer not null check(expected_schedule_version>=0),
  requested_by uuid not null references public.profiles(id),
  requested_by_role public.user_role not null,
  reason text not null check(length(reason) between 15 and 1000),
  proposed_starts_at timestamptz not null,
  proposed_ends_at timestamptz not null,
  proposed_local_date date not null,
  duration_minutes integer not null check(duration_minutes between 30 and 480),
  travel_buffer_minutes integer not null check(travel_buffer_minutes between 0 and 180),
  customer_approved_at timestamptz,
  professional_approved_at timestamptz,
  status text not null default 'pending' check(status in ('pending','approved','rejected','superseded')),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  check(proposed_ends_at=proposed_starts_at+duration_minutes*interval '1 minute')
);
create unique index job_reschedule_one_pending on public.job_reschedule_requests(job_id) where status='pending';

alter table public.professional_absences enable row level security;
alter table public.job_schedule_reservations enable row level security;
alter table public.job_reschedule_requests enable row level security;
revoke all on public.professional_absences,public.job_schedule_reservations,public.job_reschedule_requests from anon,authenticated;

create policy professional_absences_owner_read on public.professional_absences for select to authenticated
  using(professional_id=(select private.current_professional_id(false)) or private.has_admin_permission('operations'));
create policy schedule_participant_read on public.job_schedule_reservations for select to authenticated using(
  exists(select 1 from public.jobs j where j.id=job_id and (
    j.customer_id=(select private.current_customer_id()) or
    j.professional_id=(select private.current_professional_id(false)) or
    private.has_admin_permission('operations'))));
create policy reschedule_participant_read on public.job_reschedule_requests for select to authenticated using(
  exists(select 1 from public.jobs j where j.id=job_id and (
    j.customer_id=(select private.current_customer_id()) or
    j.professional_id=(select private.current_professional_id(false)) or
    private.has_admin_permission('operations'))));
grant select on public.professional_absences,public.job_schedule_reservations,public.job_reschedule_requests to authenticated;

create function private.expire_schedule_holds(p_professional_id uuid default null) returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  update public.job_schedule_reservations set state='expired',released_at=clock_timestamp(),released_reason='hold_expired'
    where state='hold' and hold_expires_at<=clock_timestamp()
      and (p_professional_id is null or professional_id=p_professional_id);
  get diagnostics v_count=row_count;
  return v_count;
end; $$;

create function public.expire_schedule_holds() returns integer language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' and not private.has_admin_permission('operations') then
    raise exception using errcode='42501',message='operations_required'; end if;
  return private.expire_schedule_holds(null);
end; $$;

create function private.release_schedule_after_job_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (new.professional_id is null and old.professional_id is not null) or
     (new.status in('cancelled_by_customer','cancelled_by_professional','cancelled_by_admin') and new.status is distinct from old.status) then
    update public.job_schedule_reservations set state='released',released_at=clock_timestamp(),released_reason='job_cancelled_or_assignment_released'
      where job_id=new.id and state in('hold','confirmed');
  end if;
  return new;
end; $$;
create trigger job_schedule_release after update of status,professional_id on public.jobs
  for each row execute function private.release_schedule_after_job_change();

create function private.assert_schedule_candidate(
  p_professional_id uuid,p_starts_at timestamptz,p_ends_at timestamptz
) returns void language plpgsql security definer set search_path='' as $$
declare v_local_start timestamp;v_local_end timestamp;v_weekday integer;
begin
  if p_starts_at<clock_timestamp() then raise exception using errcode='22023',message='visit_in_past'; end if;
  if p_ends_at<=p_starts_at then raise exception using errcode='22023',message='invalid_interval'; end if;
  if not exists(select 1 from public.professional_profiles where id=p_professional_id and status='approved') then
    raise exception using errcode='22023',message='professional_unavailable'; end if;
  v_local_start=p_starts_at at time zone 'America/Argentina/Buenos_Aires';
  v_local_end=p_ends_at at time zone 'America/Argentina/Buenos_Aires';
  if v_local_start::date<>v_local_end::date then raise exception using errcode='22023',message='outside_availability'; end if;
  v_weekday=extract(dow from v_local_start)::integer;
  if not exists(select 1 from public.professional_availability a where a.professional_id=p_professional_id and a.active
    and a.weekday=v_weekday and a.start_time<=v_local_start::time and a.end_time>=v_local_end::time) then
    raise exception using errcode='22023',message='outside_availability'; end if;
  if exists(select 1 from public.professional_absences a where a.professional_id=p_professional_id
    and tstzrange(a.starts_at,a.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)')) then
    raise exception using errcode='22023',message='professional_absent'; end if;
end; $$;

create function private.insert_schedule_reservation(
  p_job public.jobs,p_starts_at timestamptz,p_duration integer,p_buffer integer,p_state text,p_hold_minutes integer,p_actor uuid
) returns public.job_schedule_reservations language plpgsql security definer set search_path='' as $$
declare v_reservation public.job_schedule_reservations%rowtype;v_end timestamptz;
begin
  if p_duration not between 30 and 480 or p_buffer not between 0 and 180 or
     (p_state='hold' and p_hold_minutes not between 5 and 120) then
    raise exception using errcode='22023',message='invalid_schedule_policy'; end if;
  v_end=p_starts_at+p_duration*interval '1 minute';
  perform private.assert_schedule_candidate(p_job.professional_id,p_starts_at,v_end);
  perform private.expire_schedule_holds(p_job.professional_id);
  update public.job_schedule_reservations set state='released',released_at=clock_timestamp(),released_reason='schedule_replaced'
    where job_id=p_job.id and state in('hold','confirmed');
  begin
    insert into public.job_schedule_reservations(job_id,professional_id,version,starts_at,ends_at,local_visit_date,
      duration_minutes,travel_buffer_minutes,state,hold_expires_at,created_by)
    values(p_job.id,p_job.professional_id,p_job.schedule_version+1,p_starts_at,v_end,
      (p_starts_at at time zone 'America/Argentina/Buenos_Aires')::date,p_duration,p_buffer,p_state,
      case when p_state='hold' then clock_timestamp()+p_hold_minutes*interval '1 minute' end,p_actor)
    returning * into v_reservation;
  exception when exclusion_violation or unique_violation then
    raise exception using errcode='40001',message='schedule_conflict';
  end;
  update public.jobs set schedule_version=schedule_version+1 where id=p_job.id;
  return v_reservation;
end; $$;

create function public.reserve_job_schedule(
  p_job_id uuid,p_starts_at timestamptz,p_duration_minutes integer,p_travel_buffer_minutes integer,
  p_state text,p_hold_minutes integer,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.jobs%rowtype;v_actor uuid;v_res public.job_schedule_reservations%rowtype;
begin
  if not private.has_admin_permission('operations') then raise exception using errcode='42501',message='operations_required'; end if;
  v_actor=private.current_profile_id();
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found then raise exception using errcode='P0002',message='job_not_found'; end if;
  if v_job.professional_id is null or v_job.status in('completed','cancelled_by_customer','cancelled_by_professional','cancelled_by_admin') then
    raise exception using errcode='22023',message='job_not_schedulable'; end if;
  if v_job.schedule_version<>p_expected_version then raise exception using errcode='40001',message='schedule_version_conflict'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_job.professional_id::text,4515));
  v_res=private.insert_schedule_reservation(v_job,p_starts_at,p_duration_minutes,p_travel_buffer_minutes,p_state,p_hold_minutes,v_actor);
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'job.schedule_reserved','job',p_job_id,jsonb_build_object('version',v_res.version,'state',v_res.state));
  return jsonb_build_object('id',v_res.id,'jobId',v_res.job_id,'version',v_res.version,'state',v_res.state,
    'startsAt',v_res.starts_at,'endsAt',v_res.ends_at,'localDate',v_res.local_visit_date,'holdExpiresAt',v_res.hold_expires_at);
end; $$;

create function public.request_job_reschedule(
  p_job_id uuid,p_starts_at timestamptz,p_duration_minutes integer,p_travel_buffer_minutes integer,
  p_reason text,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.jobs%rowtype;v_actor uuid:=private.current_profile_id();v_role public.user_role:=public.current_user_role();v_id uuid;
begin
  if v_actor is null or v_role is null then raise exception using errcode='42501',message='current_session_required'; end if;
  if length(trim(p_reason)) not between 15 and 1000 then raise exception using errcode='22023',message='invalid_reason'; end if;
  if p_duration_minutes not between 30 and 480 or p_travel_buffer_minutes not between 0 and 180 then
    raise exception using errcode='22023',message='invalid_schedule_policy'; end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found then raise exception using errcode='P0002',message='job_not_found'; end if;
  if v_job.schedule_version<>p_expected_version then raise exception using errcode='40001',message='schedule_version_conflict'; end if;
  if v_job.status not in('pending_professional_acceptance','confirmed') then raise exception using errcode='22023',message='job_not_reschedulable'; end if;
  if not ((v_role='customer' and v_job.customer_id=private.current_customer_id()) or
          (v_role='professional' and v_job.professional_id=private.current_professional_id(true)) or
          (v_role='admin' and private.has_admin_permission('operations'))) then
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
end; $$;

create function public.respond_job_reschedule(p_request_id uuid,p_decision text,p_expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_request public.job_reschedule_requests%rowtype;v_job public.jobs%rowtype;v_actor uuid:=private.current_profile_id();
  v_role public.user_role:=public.current_user_role();v_res public.job_schedule_reservations%rowtype;
begin
  if p_decision not in('approve','reject') then raise exception using errcode='22023',message='invalid_decision'; end if;
  select * into v_request from public.job_reschedule_requests where id=p_request_id for update;
  if not found then raise exception using errcode='P0002',message='reschedule_not_found'; end if;
  select * into v_job from public.jobs where id=v_request.job_id for update;
  if v_request.status<>'pending' or v_job.schedule_version<>p_expected_version or v_request.expected_schedule_version<>p_expected_version then
    raise exception using errcode='40001',message='schedule_version_conflict'; end if;
  if not ((v_role='customer' and v_job.customer_id=private.current_customer_id()) or
          (v_role='professional' and v_job.professional_id=private.current_professional_id(true))) then
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
end; $$;

create function public.get_schedule_availability(p_professional_id uuid,p_from date,p_to date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_self uuid:=private.current_professional_id(false);
begin
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>31 then
    raise exception using errcode='22023',message='invalid_date_range'; end if;
  if p_professional_id<>v_self and not private.has_admin_permission('operations') then
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
end; $$;

create function public.replace_professional_schedule_settings(
  p_professional_id uuid,p_windows jsonb,p_absences jsonb,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_pro public.professional_profiles%rowtype;v_actor uuid:=private.current_profile_id();v_item jsonb;v_start timestamptz;v_end timestamptz;
begin
  if v_actor is null or not (
    p_professional_id=private.current_professional_id(true) or private.has_admin_permission('operations')) then
    raise exception using errcode='42501',message='schedule_write_forbidden'; end if;
  if jsonb_typeof(p_windows)<>'array' or jsonb_typeof(p_absences)<>'array' or
    jsonb_array_length(p_windows)>50 or jsonb_array_length(p_absences)>50 then
    raise exception using errcode='22023',message='invalid_schedule_settings'; end if;
  select * into v_pro from public.professional_profiles where id=p_professional_id for update;
  if not found then raise exception using errcode='P0002',message='professional_not_found'; end if;
  if v_pro.schedule_settings_version<>p_expected_version then raise exception using errcode='40001',message='schedule_version_conflict'; end if;
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
end; $$;

revoke all on function private.expire_schedule_holds(uuid),private.release_schedule_after_job_change(),private.assert_schedule_candidate(uuid,timestamptz,timestamptz),
  private.insert_schedule_reservation(public.jobs,timestamptz,integer,integer,text,integer,uuid) from public,anon,authenticated,service_role;
revoke all on function public.reserve_job_schedule(uuid,timestamptz,integer,integer,text,integer,integer),
  public.request_job_reschedule(uuid,timestamptz,integer,integer,text,integer),
  public.respond_job_reschedule(uuid,text,integer),public.get_schedule_availability(uuid,date,date),
  public.replace_professional_schedule_settings(uuid,jsonb,jsonb,integer),public.expire_schedule_holds() from public,anon;
grant execute on function public.reserve_job_schedule(uuid,timestamptz,integer,integer,text,integer,integer),
  public.request_job_reschedule(uuid,timestamptz,integer,integer,text,integer),
  public.respond_job_reschedule(uuid,text,integer),public.get_schedule_availability(uuid,date,date),
  public.replace_professional_schedule_settings(uuid,jsonb,jsonb,integer),public.expire_schedule_holds() to authenticated;
grant execute on function public.expire_schedule_holds() to service_role;
