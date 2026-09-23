-- Only a server-inspected derivative may become a professional's public avatar.
create table private.professional_avatars (
  professional_id uuid primary key references public.professional_profiles(id) on delete cascade,
  object_path text not null unique,
  output_sha256 text not null check (output_sha256 ~ '^[a-f0-9]{64}$'),
  updated_at timestamptz not null default now(),
  check (object_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.webp$')
);
alter table private.professional_avatars enable row level security;
alter table private.professional_avatars force row level security;
revoke all on private.professional_avatars from public,anon,authenticated,service_role;

create function private.set_professional_avatar(
  p_auth_user_id uuid,p_professional_id uuid,p_path text,p_sha256 text,p_public_url text
) returns text language plpgsql security definer set search_path='' as $$
declare v_profile uuid;v_previous text;v_object storage.objects%rowtype;
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Server-only avatar finalization'; end if;
  if p_auth_user_id is null or p_professional_id is null or p_path is null or p_sha256 is null or p_public_url is null
    or p_path !~ ('^'||p_auth_user_id::text||'/[a-f0-9-]{36}\.webp$')
    or p_sha256 !~ '^[a-f0-9]{64}$'
    or p_public_url not like '%/storage/v1/object/public/public-avatars/'||p_path then
    raise exception using errcode='22023',message='Invalid avatar reference'; end if;
  select p.id into v_profile from public.profiles p
    join public.professional_profiles pro on pro.profile_id=p.id
    left join public.professional_invitations i on i.id=pro.invitation_id
    join auth.users u on u.id=p.auth_user_id
    where p.auth_user_id=p_auth_user_id and pro.id=p_professional_id
      and ((i.bound_auth_user_id=p_auth_user_id and i.consumed_at is not null)
        or (pro.invitation_id is null and pro.status='approved'))
      and pro.status in ('form_started','rejected','form_submitted','under_review','approved')
      and u.email_confirmed_at is not null
    for update of p;
  if not found then raise exception using errcode='42501',message='Bound professional required'; end if;
  select * into v_object from storage.objects where bucket_id='public-avatars' and name=p_path;
  if not found or v_object.metadata->>'mimetype' is distinct from 'image/webp'
    or coalesce((v_object.metadata->>'size')::bigint,0) not between 1 and 2097152 then
    raise exception using errcode='22023',message='Inspected avatar object required'; end if;
  select object_path into v_previous from private.professional_avatars where professional_id=p_professional_id;
  insert into private.professional_avatars(professional_id,object_path,output_sha256)
    values(p_professional_id,p_path,p_sha256)
    on conflict(professional_id) do update set object_path=excluded.object_path,
      output_sha256=excluded.output_sha256,updated_at=now();
  update public.profiles set avatar_url=p_public_url where id=v_profile;
  return v_previous;
end; $$;

revoke all on function private.set_professional_avatar(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function private.set_professional_avatar(uuid,uuid,text,text,text) to service_role;

create function public.set_professional_avatar(
  p_auth_user_id uuid,p_professional_id uuid,p_path text,p_sha256 text,p_public_url text
) returns text language sql security invoker set search_path='' as $$
  select private.set_professional_avatar(p_auth_user_id,p_professional_id,p_path,p_sha256,p_public_url);
$$;
revoke all on function public.set_professional_avatar(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.set_professional_avatar(uuid,uuid,text,text,text) to service_role;

create function private.professional_readiness_reasons(p_id uuid) returns text[]
language sql stable security definer set search_path='' as $$
  select array_remove(array[
    case when not private.professional_clearance_valid(p_id) then 'documentos' end,
    case when not exists(select 1 from private.professional_avatars a
      join public.professional_profiles pro on pro.id=a.professional_id
      join public.profiles profile on profile.id=pro.profile_id
      join storage.objects o on o.bucket_id='public-avatars' and o.name=a.object_path
      where a.professional_id=p_id and profile.avatar_url like '%/storage/v1/object/public/public-avatars/'||a.object_path)
      then 'foto' end,
    case when not exists(select 1 from public.mp_split_connected_accounts m
      where m.seller_id=p_id::text and m.enabled) then 'mercado_pago' end
  ],null)::text[];
$$;
revoke all on function private.professional_readiness_reasons(uuid) from public,anon,authenticated,service_role;

create function private.professional_ready_for_new_work(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select cardinality(private.professional_readiness_reasons(p_id))=0;
$$;
revoke all on function private.professional_ready_for_new_work(uuid) from public,anon,authenticated,service_role;

-- Existing candidate logic remains intact; readiness adds a shared, fail-closed gate.
alter function private.assignment_candidate_is_eligible(uuid,uuid,timestamptz,timestamptz)
  rename to assignment_candidate_is_eligible_without_readiness;
create function private.assignment_candidate_is_eligible(
  p_job_id uuid,p_professional_id uuid,p_starts_at timestamptz,p_ends_at timestamptz
) returns boolean language sql stable security definer set search_path='' as $$
  select private.professional_ready_for_new_work(p_professional_id)
    and private.assignment_candidate_is_eligible_without_readiness(p_job_id,p_professional_id,p_starts_at,p_ends_at);
$$;
revoke all on function private.assignment_candidate_is_eligible(uuid,uuid,timestamptz,timestamptz)
  from public,anon,authenticated,service_role;

-- Also covers the older manual assignment RPC, not only assignment offers.
create function private.guard_new_professional_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    if new.status<>'pending_professional_acceptance' then return new; end if;
  elsif new.status<>'pending_professional_acceptance'
    or (old.status='pending_professional_acceptance' and new.professional_id is not distinct from old.professional_id) then
    return new;
  end if;
  perform 1 from public.professional_profiles where id=new.professional_id for share;
  perform 1 from public.mp_split_connected_accounts where seller_id=new.professional_id::text and enabled for share;
  if not private.professional_ready_for_new_work(new.professional_id) then
    raise exception using errcode='22023',message='Professional not ready for new work';
  end if;
  return new;
end; $$;
create trigger guard_new_professional_assignment before insert or update of status,professional_id on public.jobs
for each row execute function private.guard_new_professional_assignment();
revoke all on function private.guard_new_professional_assignment() from public,anon,authenticated,service_role;

create or replace function private.professional_review_context(p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_id uuid:=coalesce(p_id,private.current_professional_id(false));v_documents jsonb;v_avatar text;v_submission uuid;v_reason text;
begin
  if not private.has_admin_permission('operations') and (v_id is null or v_id is distinct from private.current_professional_id(false)) then raise exception using errcode='42501',message='Professional review access denied'; end if;
  select current_submission_id into v_submission from public.professional_profiles where id=v_id;
  if not found then raise exception using errcode='P0002',message='Application unavailable'; end if;
  if not private.has_admin_permission('operations') then perform private.read_professional_onboarding(); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'documentType',d.document_type,'status',d.status,'version',d.version,'expiresAt',d.expires_at,
    'reviewedBy',d.reviewed_by,'reviewedAt',d.reviewed_at,'reason',d.review_reason,'createdAt',d.created_at,
    'inSubmission',exists(select 1 from private.professional_application_submissions s where s.id=v_submission and d.id=any(s.document_ids)))
    order by d.created_at desc,d.id desc),'[]'::jsonb)
    into v_documents from public.professional_documents d where d.professional_id=v_id;
  select metadata->>'reason' into v_reason from public.admin_audit_logs
    where entity_id=v_id and action in ('professional.approved','professional.rejected','professional.revalidation_requested')
    order by created_at desc,id desc limit 1;
  select p.avatar_url into v_avatar from public.profiles p
    join public.professional_profiles pro on pro.profile_id=p.id
    join private.professional_avatars a on a.professional_id=pro.id
    where pro.id=v_id and p.avatar_url like '%/storage/v1/object/public/public-avatars/'||a.object_path;
  return jsonb_build_object('application',private.professional_application_document(v_id),'requirements',private.professional_requirements(v_id),
    'documents',v_documents,'decisionReason',v_reason,'eligible',private.professional_clearance_valid(v_id),
    'avatarUrl',v_avatar,'readyForNewWork',private.professional_ready_for_new_work(v_id),
    'readinessReasons',private.professional_readiness_reasons(v_id));
end; $$;

create or replace function private.list_professional_workflow(p_resource text,p_limit integer default 25,p_before_created_at timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb; v_total bigint;
begin
  if not private.has_admin_permission('operations') then raise exception 'Operations permission required' using errcode='42501'; end if;
  if p_resource not in ('invitations','professionals') or p_resource is null or p_limit is null or p_limit<1 or p_limit>100
    or (p_before_created_at is null)<>(p_before_id is null) then raise exception 'Invalid page' using errcode='22023'; end if;
  if p_resource='invitations' then
    select count(*) into v_total from public.professional_invitations;
    select coalesce(jsonb_agg(private.invitation_document(id) order by created_at desc,id desc),'[]'::jsonb) into v_items
      from (select id,created_at from public.professional_invitations
        where p_before_id is null or (created_at,id)<(p_before_created_at,p_before_id)
        order by created_at desc,id desc limit p_limit+1) page;
  else
    select count(*) into v_total from public.professional_profiles;
    select coalesce(jsonb_agg(jsonb_build_object('id',pp.id,'createdAt',pp.created_at,'version',pp.version,
      'firstName',p.first_name,'lastName',p.last_name,'email',p.email,'status',pp.status,
      'eligible',private.professional_clearance_valid(pp.id),'readyForNewWork',private.professional_ready_for_new_work(pp.id),
      'invited',pp.invitation_id is not null)
      order by pp.created_at desc,pp.id desc),'[]'::jsonb) into v_items
      from (select * from public.professional_profiles
        where p_before_id is null or (created_at,id)<(p_before_created_at,p_before_id)
        order by created_at desc,id desc limit p_limit+1) pp join public.profiles p on p.id=pp.profile_id;
  end if;
  return jsonb_build_object('items',v_items,'total',v_total);
end; $$;
