-- Storage authorization must enforce current clearance even when callers bypass HTTP.
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
    perform 1 from public.jobs j join public.professional_profiles p on p.id=j.professional_id where j.id=p_entity_id and p.profile_id=p_actor.id and private.professional_clearance_valid(p.id) for share of j,p;
  else
    raise exception using errcode='42501',message='Upload access denied';
  end if;
  if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
end;
$$;

create or replace function private.can_read_upload(p_intent private.upload_intents,p_actor public.profiles) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_intent.status<>'verified' then
    if p_intent.status<>'pending' or p_intent.owner_profile_id<>p_actor.id then return false; end if;
    perform private.authorize_upload_target(p_actor,p_intent.kind,p_intent.entity_id,p_intent.draft_id);
    return true;
  end if;
  if p_intent.kind='request-photo' then
    if p_intent.entity_id is null then return p_intent.owner_profile_id=p_actor.id; end if;
    return exists(select 1 from public.service_requests r where r.id=p_intent.entity_id and (
      exists(select 1 from public.customer_profiles c where c.id=r.customer_id and c.profile_id=p_actor.id and p_actor.role='customer')
      or exists(select 1 from public.jobs j join public.professional_profiles p on p.id=j.professional_id where j.request_id=r.id and p.profile_id=p_actor.id and private.professional_clearance_valid(p.id) and p_actor.role='professional')
      or (p_actor.role='admin' and exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id where a.profile_id=p_actor.id and g.permission in ('operations','quality','owner')))));
  elsif p_intent.kind='equipment-photo' then
    return exists(select 1 from public.customer_equipment e where e.id=p_intent.entity_id and (
      exists(select 1 from public.customer_profiles c where c.id=e.customer_id and c.profile_id=p_actor.id and p_actor.role='customer')
      or exists(select 1 from public.jobs j join public.service_requests r on r.id=j.request_id join public.professional_profiles p on p.id=j.professional_id where r.equipment_id=e.id and p.profile_id=p_actor.id and private.professional_clearance_valid(p.id) and p_actor.role='professional')
      or (p_actor.role='admin' and exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id where a.profile_id=p_actor.id and g.permission in ('operations','quality','owner')))));
  elsif p_intent.kind='professional-document' then
    return exists(select 1 from public.professional_profiles p where p.id=p_intent.entity_id and (
      (p.profile_id=p_actor.id and p_actor.role='professional')
      or (p_actor.role='admin' and exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id where a.profile_id=p_actor.id and g.permission in ('operations','owner')))));
  end if;
  return exists(select 1 from public.jobs j where j.id=p_intent.entity_id and (
    exists(select 1 from public.customer_profiles c where c.id=j.customer_id and c.profile_id=p_actor.id and p_actor.role='customer')
    or exists(select 1 from public.professional_profiles p where p.id=j.professional_id and p.profile_id=p_actor.id and private.professional_clearance_valid(p.id) and p_actor.role='professional')
    or (p_actor.role='admin' and exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id where a.profile_id=p_actor.id and g.permission in ('operations','quality','owner')))));
end;
$$;
