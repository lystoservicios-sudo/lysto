alter table public.jobs add column assignment_version integer not null default 0 check(assignment_version>=0);

create table public.assignment_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id),
  version integer not null check(version>0),
  status text not null default 'pending' check(status in('pending','accepted','rejected','expired','cancelled')),
  expires_at timestamptz not null,
  responded_at timestamptz,
  rejection_reason text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  check(rejection_reason is null or length(rejection_reason) between 10 and 1000),
  unique(job_id,version)
);
create unique index assignment_offer_one_pending on public.assignment_offers(job_id) where status='pending';
create index assignment_offer_professional_queue on public.assignment_offers(professional_id,status,expires_at,id);
alter table public.assignment_offers enable row level security;
revoke all on public.assignment_offers from anon,authenticated;
create policy assignment_offer_participant_read on public.assignment_offers for select to authenticated using(
  professional_id=(select private.current_professional_id(false)) or private.has_admin_permission('operations') or
  exists(select 1 from public.jobs j where j.id=job_id and j.customer_id=(select private.current_customer_id())));
grant select on public.assignment_offers to authenticated;

create function private.assignment_candidate_is_eligible(
  p_job_id uuid,p_professional_id uuid,p_starts_at timestamptz,p_ends_at timestamptz
) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_request public.service_requests%rowtype;v_city text;
begin
  select * into v_request from public.service_requests
    where id=(select request_id from public.jobs where id=p_job_id);
  if not found then return false; end if;
  select city into v_city from public.customer_addresses where id=v_request.address_id;
  return exists(select 1 from public.professional_profiles p where p.id=p_professional_id and p.status='approved'
      and private.professional_clearance_valid(p.id))
    and exists(select 1 from public.professional_service_categories c where c.professional_id=p_professional_id
      and c.category_id=v_request.category_id and c.approved)
    and exists(select 1 from public.professional_tools t where t.professional_id=p_professional_id and t.has_tool)
    and exists(select 1 from public.professional_service_zones z where z.professional_id=p_professional_id and z.active
      and (lower(z.zone_name)=lower(v_city) or lower(z.zone_slug)=regexp_replace(lower(v_city),'[^a-z0-9]+','_','g')))
    and exists(select 1 from public.professional_availability a where a.professional_id=p_professional_id and a.active
      and a.weekday=extract(dow from p_starts_at at time zone 'America/Argentina/Buenos_Aires')::integer
      and a.start_time<=(p_starts_at at time zone 'America/Argentina/Buenos_Aires')::time
      and a.end_time>=(p_ends_at at time zone 'America/Argentina/Buenos_Aires')::time)
    and not exists(select 1 from public.professional_absences a where a.professional_id=p_professional_id
      and tstzrange(a.starts_at,a.ends_at,'[)')&&tstzrange(p_starts_at,p_ends_at,'[)'))
    and not exists(select 1 from public.job_schedule_reservations s where s.professional_id=p_professional_id
      and s.state in('hold','confirmed') and tstzrange(s.starts_at-s.travel_buffer_minutes*interval '1 minute',
        s.ends_at+s.travel_buffer_minutes*interval '1 minute','[)')&&tstzrange(p_starts_at,p_ends_at,'[)'));
end; $$;

create function public.list_assignment_candidates(
  p_job_id uuid,p_starts_at timestamptz,p_duration_minutes integer,p_travel_buffer_minutes integer
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not private.has_admin_permission('operations') then raise exception using errcode='42501',message='operations_required'; end if;
  if p_duration_minutes not between 30 and 480 or p_travel_buffer_minutes not between 0 and 180 or p_starts_at<clock_timestamp() then
    raise exception using errcode='22023',message='invalid_schedule'; end if;
  if not exists(select 1 from public.jobs where id=p_job_id and status='pending_assignment') then
    raise exception using errcode='P0002',message='assignable_job_not_found'; end if;
  perform private.expire_schedule_holds(null);
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'firstName',profile.first_name,'lastName',profile.last_name,'ratingAvg',p.rating_avg,
    'jobsCompleted',p.jobs_completed,'acceptanceRate',p.acceptance_rate,'internalScore',p.internal_score,
    'paymentAccountConnected',exists(select 1 from public.mp_split_connected_accounts m where m.seller_id=p.id::text and m.enabled)
  ) order by p.internal_score desc,p.rating_avg desc nulls last,p.id)
  from public.professional_profiles p join public.profiles profile on profile.id=p.profile_id
  where private.assignment_candidate_is_eligible(p_job_id,p.id,p_starts_at,
    p_starts_at+p_duration_minutes*interval '1 minute')),'[]'::jsonb);
end; $$;

create function public.create_assignment_offer(
  p_job_id uuid,p_professional_id uuid,p_starts_at timestamptz,p_duration_minutes integer,
  p_travel_buffer_minutes integer,p_expires_at timestamptz,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.jobs%rowtype;v_actor uuid:=private.current_profile_id();v_offer public.assignment_offers%rowtype;
  v_res public.job_schedule_reservations%rowtype;v_admin uuid:=private.current_admin_profile_id();
begin
  if not private.has_admin_permission('operations') then raise exception using errcode='42501',message='operations_required'; end if;
  if p_expires_at<clock_timestamp()+interval '5 minutes' or p_expires_at>clock_timestamp()+interval '120 minutes' then
    raise exception using errcode='22023',message='invalid_offer_expiry'; end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found then raise exception using errcode='P0002',message='job_not_found'; end if;
  if v_job.status<>'pending_assignment' or v_job.assignment_version<>p_expected_version then
    raise exception using errcode='40001',message='assignment_version_conflict'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_professional_id::text,4516));
  if not private.assignment_candidate_is_eligible(p_job_id,p_professional_id,p_starts_at,
    p_starts_at+p_duration_minutes*interval '1 minute') then
    raise exception using errcode='22023',message='professional_ineligible_or_unavailable'; end if;
  perform private.assign_professional_to_job(v_job.id,v_job.request_id,p_professional_id,v_admin);
  select * into v_job from public.jobs where id=p_job_id for update;
  update public.jobs set assignment_version=assignment_version+1 where id=p_job_id;
  insert into public.assignment_offers(job_id,professional_id,version,expires_at,created_by)
    values(p_job_id,p_professional_id,p_expected_version+1,p_expires_at,v_actor) returning * into v_offer;
  v_res=private.insert_schedule_reservation(v_job,p_starts_at,p_duration_minutes,p_travel_buffer_minutes,'hold',
    greatest(5,least(120,ceil(extract(epoch from p_expires_at-clock_timestamp())/60)::integer)),v_actor);
  update public.job_schedule_reservations set hold_expires_at=p_expires_at where id=v_res.id;
  return jsonb_build_object('id',v_offer.id,'jobId',p_job_id,'professionalId',p_professional_id,
    'version',v_offer.version,'status',v_offer.status,'expiresAt',v_offer.expires_at,
    'scheduleVersion',v_res.version,'paymentAccountConnected',exists(select 1 from public.mp_split_connected_accounts
      where seller_id=p_professional_id::text and enabled));
exception when unique_violation then raise exception using errcode='40001',message='assignment_conflict';
end; $$;

create function private.expire_assignment_offer(p_offer_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_offer public.assignment_offers%rowtype;v_job public.jobs%rowtype;
begin
  select * into v_offer from public.assignment_offers where id=p_offer_id for update;
  if not found or v_offer.status<>'pending' or v_offer.expires_at>clock_timestamp() then return false; end if;
  select * into v_job from public.jobs where id=v_offer.job_id for update;
  update public.assignment_offers set status='expired',responded_at=clock_timestamp() where id=v_offer.id;
  if v_job.status='pending_professional_acceptance' and v_job.professional_id=v_offer.professional_id then
    update public.jobs set status='pending_assignment',professional_id=null,assignment_version=assignment_version+1 where id=v_job.id;
    update public.service_requests set status='pending_assignment' where id=v_job.request_id;
  end if;
  insert into public.notifications(profile_id,event_type,title,body,entity_type,entity_id,action_url)
    select p.id,'job.assignment_expired','Propuesta vencida',
      case when p.role='professional' then 'La propuesta venció y la capacidad quedó liberada.'
           when p.role='customer' then 'La propuesta venció y continuamos buscando un profesional.'
           else 'Una propuesta venció y el trabajo volvió a la cola.' end,
      'job',v_job.id,case when p.role='professional' then '/pro/solicitudes'
        when p.role='customer' then '/mis-solicitudes/'||v_job.request_id::text else '/admin/servicios' end
    from public.profiles p where
      exists(select 1 from public.professional_profiles x where x.id=v_offer.professional_id and x.profile_id=p.id) or
      exists(select 1 from public.customer_profiles c where c.id=v_job.customer_id and c.profile_id=p.id) or
      exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id
        where a.profile_id=p.id and g.permission in('operations','owner'));
  return true;
end; $$;

create function public.expire_assignment_offers(p_limit integer default 50) returns integer
language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_count integer:=0;
begin
  if auth.role()<>'service_role' and not private.has_admin_permission('operations') then
    raise exception using errcode='42501',message='operations_required'; end if;
  if p_limit not between 1 and 100 then raise exception using errcode='22023',message='invalid_limit'; end if;
  for v_id in select id from public.assignment_offers where status='pending' and expires_at<=clock_timestamp()
    order by expires_at,id for update skip locked limit p_limit
  loop if private.expire_assignment_offer(v_id) then v_count=v_count+1; end if; end loop;
  return v_count;
end; $$;

create function public.respond_assignment_offer(
  p_offer_id uuid,p_response text,p_reason text,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_offer public.assignment_offers%rowtype;v_job public.jobs%rowtype;v_pro uuid:=private.current_professional_id(true);
begin
  if v_pro is null then raise exception using errcode='42501',message='approved_professional_required'; end if;
  select * into v_offer from public.assignment_offers where id=p_offer_id for update;
  if not found or v_offer.professional_id<>v_pro then raise exception using errcode='P0002',message='offer_not_found'; end if;
  select * into v_job from public.jobs where id=v_offer.job_id for update;
  if v_offer.status='accepted' and p_response='accepted' then
    return jsonb_build_object('id',v_offer.id,'jobId',v_job.id,'status','accepted','assignmentVersion',v_offer.version,
      'paymentStatus',case when exists(select 1 from public.marketplace_checkouts where job_id=v_job.id and extra_id is null and status='approved') then 'approved' else 'pending' end);
  end if;
  if v_offer.status<>'pending' or v_offer.version<>p_expected_version or v_job.assignment_version<>p_expected_version then
    raise exception using errcode='40001',message='assignment_version_conflict'; end if;
  if v_offer.expires_at<=clock_timestamp() then
    perform private.expire_assignment_offer(v_offer.id);
    return jsonb_build_object('id',v_offer.id,'jobId',v_job.id,'status','expired','assignmentVersion',v_offer.version+1);
  end if;
  if p_response='accepted' then
    perform private.professional_respond_to_job(v_job.id,v_pro,'accepted',null);
    update public.assignment_offers set status='accepted',responded_at=clock_timestamp() where id=v_offer.id;
    update public.job_schedule_reservations set state='confirmed',hold_expires_at=null
      where job_id=v_job.id and state='hold';
    return jsonb_build_object('id',v_offer.id,'jobId',v_job.id,'status','accepted','assignmentVersion',v_offer.version,
      'paymentAccountConnected',exists(select 1 from public.mp_split_connected_accounts where seller_id=v_pro::text and enabled),
      'paymentStatus',case when exists(select 1 from public.marketplace_checkouts where job_id=v_job.id and extra_id is null and status='approved') then 'approved' else 'pending' end);
  elsif p_response='rejected' then
    if length(trim(coalesce(p_reason,'')))<10 then raise exception using errcode='22023',message='rejection_reason_required'; end if;
    update public.assignment_offers set status='rejected',responded_at=clock_timestamp(),rejection_reason=trim(p_reason) where id=v_offer.id;
    perform private.professional_respond_to_job(v_job.id,v_pro,'rejected',p_reason);
    update public.jobs set assignment_version=assignment_version+1 where id=v_job.id;
    insert into public.notifications(profile_id,event_type,title,body,entity_type,entity_id,action_url)
      select p.id,'job.assignment_rejected','Propuesta rechazada',
        case when p.role='customer' then 'Continuamos buscando un profesional disponible.' else 'La propuesta fue rechazada y el trabajo volvió a la cola.' end,
        'job',v_job.id,case when p.role='customer' then '/mis-solicitudes/'||v_job.request_id::text else '/admin/servicios' end
      from public.profiles p where
        exists(select 1 from public.customer_profiles c where c.id=v_job.customer_id and c.profile_id=p.id) or
        exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id
          where a.profile_id=p.id and g.permission in('operations','owner'));
    return jsonb_build_object('id',v_offer.id,'jobId',v_job.id,'status','rejected','assignmentVersion',v_offer.version+1);
  end if;
  raise exception using errcode='22023',message='invalid_response';
end; $$;

revoke all on function private.assignment_candidate_is_eligible(uuid,uuid,timestamptz,timestamptz),
  private.expire_assignment_offer(uuid) from public,anon,authenticated,service_role;
revoke all on function public.list_assignment_candidates(uuid,timestamptz,integer,integer),
  public.create_assignment_offer(uuid,uuid,timestamptz,integer,integer,timestamptz,integer),
  public.respond_assignment_offer(uuid,text,text,integer),public.expire_assignment_offers(integer) from public,anon;
grant execute on function public.list_assignment_candidates(uuid,timestamptz,integer,integer),
  public.create_assignment_offer(uuid,uuid,timestamptz,integer,integer,timestamptz,integer),
  public.respond_assignment_offer(uuid,text,text,integer),public.expire_assignment_offers(integer) to authenticated;
grant execute on function public.expire_assignment_offers(integer) to service_role;
