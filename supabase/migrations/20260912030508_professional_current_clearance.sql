-- Invited professionals need a current clearance on every operational access.
-- Pre-existing infrastructure-provisioned profiles retain their established
-- approval; real-environment acceptance must inventory those legacy approvals.
create function private.professional_clearance_valid(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.professional_profiles pp where pp.id=p_id and pp.status='approved'
    and (pp.invitation_id is null or exists(select 1 from private.professional_application_submissions s
      where s.id=pp.current_submission_id and s.professional_id=pp.id
        and s.requirements=private.professional_requirements(pp.id)
        and s.legal_acceptance->'accepted'='true'::jsonb
        and not exists(select 1 from unnest(s.document_ids) selected(document_id)
          left join public.professional_documents d on d.id=selected.document_id and d.professional_id=pp.id
          left join private.upload_intents i on i.id=d.id and i.status='verified' and i.kind='professional-document' and i.entity_id=pp.id
          where d.id is null or i.id is null or d.status<>'approved' or d.reviewed_by is null or d.reviewed_at is null
            or not exists(select 1 from storage.objects o where o.bucket_id=i.output_bucket and o.name=i.output_path)
            or (d.expires_at is not null and d.expires_at<=current_date)
            or (d.expires_at is null and exists(select 1 from jsonb_array_elements(s.requirements->'policies') p where p->'expiryDocuments' ? d.document_type))))));
$$;
revoke all on function private.professional_clearance_valid(uuid) from public,anon,authenticated,service_role;

create or replace function private.current_professional_id(p_require_approved boolean default false) returns uuid
language sql stable security definer set search_path='' as $$
  select id from public.professional_profiles
    where profile_id=private.current_profile_id() and auth.jwt()->'app_metadata'->>'app_role'='professional'
      and (not p_require_approved or private.professional_clearance_valid(id)) limit 1;
$$;

create or replace function private.get_session_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile_id',p.id,'role',p.role,'customer_id',cp.id,
    'professional_id',pp.id,'professional_status',pp.status,'professional_eligible',private.professional_clearance_valid(pp.id),'admin_profile_id',ap.id,
    'session_id',private.current_session_id(),'session_active',true,
    'aal',case when private.current_session_has_mfa() then 'aal2' else 'aal1' end,
    'permissions',coalesce((select jsonb_agg(g.permission order by g.permission)
      from private.admin_profile_permissions g where g.admin_profile_id=ap.id),'[]'::jsonb)
  ) from public.profiles p
  left join public.customer_profiles cp on cp.profile_id=p.id and p.role='customer'
  left join public.professional_profiles pp on pp.profile_id=p.id and p.role='professional'
  left join public.admin_profiles ap on ap.profile_id=p.id and p.role='admin'
  where p.auth_user_id=auth.uid() and p.role::text=auth.jwt()->'app_metadata'->>'app_role'
    and private.current_session_active(false) limit 1;
$$;

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
    where pp.id=p_professional_id and pp.status='approved' and private.professional_clearance_valid(pp.id) for share;
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
