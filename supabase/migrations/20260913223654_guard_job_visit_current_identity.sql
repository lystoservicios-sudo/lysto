-- SQL NULL must never authorize a privileged visit projection. Preserve the
-- existing participant/operations checks and reject incomplete or revoked identity.
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
    'scheduleVersion',s.version,
    'startsAt',s.starts_at,
    'endsAt',s.ends_at,
    'timezone',s.timezone,
    'addressLabel',left(btrim(concat_ws(', ',btrim(concat_ws(' ',a.street,a.number)),
      nullif(btrim(concat_ws(' ',case when a.floor is not null then 'Piso '||a.floor end,
        case when a.apartment is not null then 'Depto. '||a.apartment end)),''),a.city)),500),
    'professionalName',left(coalesce(nullif(btrim(concat_ws(' ',nullif(btrim(p.first_name),''),
      case when nullif(btrim(p.last_name),'') is null then null else left(btrim(p.last_name),1)||'.' end)),''),'Profesional Lysto'),160),
    'durationMinutes',s.duration_minutes,
    'travelBufferMinutes',s.travel_buffer_minutes,
    'confirmed',true
  ) into v_result
  from public.job_schedule_reservations s
  join public.service_requests r on r.id=v_job.request_id
  join public.customer_addresses a on a.id=r.address_id
  join public.professional_profiles pro on pro.id=v_job.professional_id
  join public.profiles p on p.id=pro.profile_id
  where s.job_id=v_job.id and s.state='confirmed' and v_job.status='confirmed'
  order by s.version desc limit 1;
  return v_result;
end;
$$;
