-- A suspension preserves jobs, payments and OAuth history. Every transition
-- records active work for operations, including an infrastructure intervention.
create function private.record_professional_suspension() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_reason text := nullif(btrim(current_setting('lysto.suspension_reason',true)),'');
  v_audit uuid := gen_random_uuid();
  v_actor uuid;
  v_jobs uuid[];
begin
  if new.status<>'suspended' or old.status='suspended' then return new; end if;
  if current_setting('role',true)='authenticated' then
    if not private.has_admin_permission('operations') then raise exception using errcode='42501',message='Operations permission required'; end if;
    if v_reason is null or length(v_reason)<10 or length(v_reason)>1000 then
      raise exception using errcode='22023',message='A suspension reason is required';
    end if;
    v_actor=private.current_profile_id();
  end if;
  v_reason=coalesce(v_reason,'Intervención de infraestructura; consultar registro de mantenimiento');
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into v_jobs from public.jobs
    where professional_id=new.id and status not in ('completed','cancelled_by_customer','cancelled_by_professional','cancelled_by_admin');
  insert into public.admin_audit_logs(id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(v_audit,v_actor,'professional.suspended','professional',new.id,
    jsonb_build_object('reason',v_reason,'previous_status',old.status,'active_job_ids',v_jobs,'source',case when v_actor is null then 'infrastructure' else 'administration' end));
  insert into private.outbox_events(event_type,aggregate_type,aggregate_id,channel,recipient_profile_id,recipient_key,dedupe_key,payload)
  select 'professional.suspended','professional',new.id,'in_app',p.id,p.id::text,v_audit::text,
    jsonb_build_object('professional_id',new.id,'active_job_ids',v_jobs,'audit_id',v_audit)
  from public.admin_profiles a join public.profiles p on p.id=a.profile_id
  join auth.users u on u.id=p.auth_user_id
  where p.role='admin' and u.raw_app_meta_data->>'app_role'='admin' and u.deleted_at is null
    and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
    and exists(select 1 from private.admin_profile_permissions g where g.admin_profile_id=a.id and g.permission in ('operations','owner'));
  return new;
end;
$$;
revoke all on function private.record_professional_suspension() from public,anon,authenticated,service_role;
create trigger professional_suspension_record after update of status on public.professional_profiles
for each row execute function private.record_professional_suspension();

create function private.suspend_professional(p_professional_id uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_professional public.professional_profiles%rowtype; v_count bigint; v_idempotent boolean;
begin
  if not private.has_admin_permission('operations') then raise exception using errcode='42501',message='Operations permission required'; end if;
  if p_reason is null or length(btrim(p_reason))<10 or length(btrim(p_reason))>1000 then
    raise exception using errcode='22023',message='A suspension reason is required';
  end if;
  select * into v_professional from public.professional_profiles where id=p_professional_id for update;
  if not found then raise exception using errcode='P0002',message='Professional not found'; end if;
  v_idempotent=v_professional.status='suspended';
  if not v_idempotent then
    perform set_config('lysto.suspension_reason',btrim(p_reason),true);
    update public.professional_profiles set status='suspended' where id=p_professional_id;
    perform set_config('lysto.suspension_reason','',true);
  end if;
  select count(*) into v_count from public.jobs where professional_id=p_professional_id
    and status not in ('completed','cancelled_by_customer','cancelled_by_professional','cancelled_by_admin');
  return jsonb_build_object('professional_id',p_professional_id,'status','suspended','active_jobs',v_count,'idempotent',v_idempotent);
end;
$$;
create function public.suspend_professional(p_professional_id uuid,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$
  select private.suspend_professional(p_professional_id,p_reason);
$$;
revoke all on function private.suspend_professional(uuid,text),public.suspend_professional(uuid,text) from public,anon,authenticated,service_role;
grant execute on function private.suspend_professional(uuid,text),public.suspend_professional(uuid,text) to authenticated;

create or replace function private.assign_professional_to_job(
  p_job_id uuid,
  p_request_id uuid,
  p_professional_id uuid,
  p_admin_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_actor_admin_id uuid := private.current_admin_profile_id();
begin
  if not private.has_admin_permission('operations') then
    raise exception 'Operations permission required';
  end if;

  if p_admin_profile_id is distinct from v_actor_admin_id then
    raise exception 'Admin actor mismatch';
  end if;

  select *
  into v_job
  from public.jobs j
  where j.id = p_job_id
    and j.request_id = p_request_id
  for update;

  if v_job.id is null then
    raise exception 'Job not found';
  end if;
  if v_job.status <> 'pending_assignment' then
    raise exception 'Job is not pending assignment';
  end if;
  -- Serialize assignment with suspension of this professional.
  perform 1 from public.professional_profiles pp
    where pp.id=p_professional_id and pp.status='approved' for share;
  if not found then
    raise exception 'Professional is not approved';
  end if;

  update public.jobs
  set professional_id = p_professional_id,
      status = 'pending_professional_acceptance'
  where id = p_job_id;

  update public.service_requests
  set status = 'pending_professional_acceptance'
  where id = p_request_id;

  perform private.append_admin_audit(
    'job.assigned',
    'job',
    p_job_id,
    jsonb_build_object('professional_id', p_professional_id)
  );

  return jsonb_build_object(
    'job_id', p_job_id,
    'professional_id', p_professional_id,
    'status', 'pending_professional_acceptance'
  );
end;
$$;
