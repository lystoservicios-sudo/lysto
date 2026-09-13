alter table private.professional_application_submissions drop constraint professional_application_submissions_submitted_by_fkey;
alter table private.professional_application_submissions add constraint professional_application_submissions_submitted_by_fkey foreign key(submitted_by) references public.profiles(id) on delete cascade;

create or replace function private.upload_actor(p_auth_user_id uuid) returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare v_profile public.profiles;
begin
  select p.* into v_profile from public.profiles p join auth.users u on u.id=p.auth_user_id
  where p.auth_user_id=p_auth_user_id and u.raw_app_meta_data->>'app_role'=p.role::text
    and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())
  for share of p,u;
  if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
  if v_profile.role='professional' then
    perform 1 from public.professional_profiles where profile_id=v_profile.id and (status='approved' or (status in ('form_started','form_submitted','under_review','rejected') and invitation_id is not null)) for share;
    if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
  elsif v_profile.role='customer' then
    perform 1 from public.customer_profiles where profile_id=v_profile.id for share;
    if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
  elsif v_profile.role='admin' then
    perform 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id where a.profile_id=v_profile.id;
    if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
  end if;
  return v_profile;
end;
$$;

create or replace function private.authorize_upload_target(p_actor public.profiles,p_kind text,p_entity_id uuid,p_draft_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_kind='request-photo' and p_actor.role='customer' then
    if p_entity_id is not null then
      perform 1 from public.service_requests r join public.customer_profiles c on c.id=r.customer_id where r.id=p_entity_id and c.profile_id=p_actor.id for share of r,c;
    else
      perform 1 from private.request_upload_drafts d join public.customer_profiles c on c.id=d.customer_id where d.id=p_draft_id and d.owner_profile_id=p_actor.id and c.profile_id=p_actor.id and d.request_id is null for share of d,c;
    end if;
  elsif p_kind='equipment-photo' and p_actor.role='customer' then
    perform 1 from public.customer_equipment e join public.customer_profiles c on c.id=e.customer_id
      where e.id=p_entity_id and e.archived_at is null and c.profile_id=p_actor.id for share of e,c;
  elsif p_kind='professional-document' and p_actor.role='professional' then
    perform 1 from public.professional_profiles pp where pp.id=p_entity_id and pp.profile_id=p_actor.id
      and ((pp.status='approved' and pp.invitation_id is null) or (pp.status in ('form_started','rejected') and exists(select 1 from public.professional_invitations i where i.id=pp.invitation_id and i.bound_auth_user_id=p_actor.auth_user_id and i.consumed_at is not null and i.status='opened'))) for share of pp;
  elsif p_kind in ('job-photo','job-document') and p_actor.role='professional' then
    perform 1 from public.jobs j join public.professional_profiles p on p.id=j.professional_id where j.id=p_entity_id and p.profile_id=p_actor.id and p.status='approved' for share of j,p;
  else
    raise exception using errcode='42501',message='Upload access denied';
  end if;
  if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
end;
$$;

create or replace function private.professional_review_context(p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_id uuid:=coalesce(p_id,private.current_professional_id(false));v_documents jsonb;
begin
  if not private.has_admin_permission('operations') and (v_id is null or v_id is distinct from private.current_professional_id(false)) then raise exception using errcode='42501',message='Professional review access denied'; end if;
  if not exists(select 1 from public.professional_profiles where id=v_id) then raise exception using errcode='P0002',message='Application unavailable'; end if;
  if not private.has_admin_permission('operations') then perform private.read_professional_onboarding(); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'documentType',d.document_type,'status',d.status,'version',d.version,'expiresAt',d.expires_at,
    'reviewedBy',d.reviewed_by,'reviewedAt',d.reviewed_at,'reason',d.review_reason,'createdAt',d.created_at) order by d.created_at desc,d.id desc),'[]'::jsonb)
    into v_documents from public.professional_documents d where d.professional_id=v_id;
  return jsonb_build_object('application',private.professional_application_document(v_id),'requirements',private.professional_requirements(v_id),'documents',v_documents);
end;
$$;
