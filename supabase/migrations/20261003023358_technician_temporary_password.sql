-- Professional invitations can provision an Auth identity before the technician
-- receives their temporary credential. The durable outbox never retains it.
alter table public.professional_invitations
  drop constraint professional_invitations_flow_version_check;
alter table public.professional_invitations
  add constraint professional_invitations_flow_version_check check (flow_version in (1,2,3)),
  add column provisioned_auth_user_id uuid references auth.users(id);
create unique index professional_invitation_provisioned_auth_user
  on public.professional_invitations(provisioned_auth_user_id)
  where provisioned_auth_user_id is not null;
alter table public.professional_profiles add column onboarding_completed_at timestamptz;

create function private.mark_professional_setup_complete(p_professional_id uuid) returns void
language sql security definer set search_path='' as $$
  update public.professional_profiles pro set onboarding_completed_at=coalesce(pro.onboarding_completed_at,clock_timestamp())
  where pro.id=p_professional_id and pro.status in ('form_submitted','under_review','approved')
    and exists(select 1 from public.mp_split_connected_accounts m
      where m.seller_id=pro.id::text and m.enabled);
$$;
revoke all on function private.mark_professional_setup_complete(uuid) from public,anon,authenticated,service_role;

create function private.mark_professional_setup_complete_from_account() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.enabled and new.seller_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    perform private.mark_professional_setup_complete(new.seller_id::uuid);
  end if;
  return new;
end; $$;
create trigger professional_setup_complete_from_mp_account
  after insert or update of enabled on public.mp_split_connected_accounts
  for each row execute function private.mark_professional_setup_complete_from_account();
revoke all on function private.mark_professional_setup_complete_from_account() from public,anon,authenticated,service_role;

create function private.mark_professional_setup_complete_from_application() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('form_submitted','under_review','approved') then
    perform private.mark_professional_setup_complete(new.id);
  end if;
  return new;
end; $$;
create trigger professional_setup_complete_from_application
  after insert or update of status on public.professional_profiles
  for each row execute function private.mark_professional_setup_complete_from_application();
revoke all on function private.mark_professional_setup_complete_from_application() from public,anon,authenticated,service_role;

-- Version 3 keeps the same mandatory identity-evidence gate as the prior invite flow.
create or replace function private.require_invited_professional_evidence() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_type text;
begin
  if new.status='form_submitted' and old.status is distinct from new.status
    and exists(select 1 from public.professional_invitations i
      where i.id=new.invitation_id and i.flow_version in (2,3)) then
    if length(btrim(coalesce(new.base_location,'')))<5
      or length(btrim(coalesce(new.license_number,'')))=0
      or length(btrim(coalesce(new.license_entity,'')))=0
      or not exists(select 1 from private.professional_avatars a where a.professional_id=new.id) then
      raise exception using errcode='22023',message='Professional address, license or photo missing';
    end if;
    foreach v_type in array array['identity_front','identity_back','license']::text[] loop
      if not exists(select 1 from public.professional_documents d
        join private.upload_intents i on i.id=d.id and i.status='verified'
          and i.kind='professional-document' and i.entity_id=new.id
        where d.professional_id=new.id and d.document_type=v_type and d.status<>'rejected') then
        raise exception using errcode='22023',message='Required professional document missing';
      end if;
    end loop;
  end if;
  return new;
end; $$;

create function private.professional_password_change_ready() returns boolean
language plpgsql stable security definer set search_path='' as $$
declare v_role public.user_role;v_ready boolean;
begin
  if auth.uid() is null then return false; end if;
  select p.role into v_role from public.profiles p where p.auth_user_id=auth.uid();
  if not found then return false; end if;
  if v_role<>'professional' then return true; end if;
  select coalesce(pro.onboarding_completed_at is not null or
    (i.flow_version is distinct from 3 and pro.status='approved'),false)
    into v_ready from public.profiles p join public.professional_profiles pro on pro.profile_id=p.id
    left join public.professional_invitations i on i.id=pro.invitation_id
    where p.auth_user_id=auth.uid();
  return coalesce(v_ready,false);
end; $$;
create function public.professional_password_change_ready() returns boolean
language sql security invoker set search_path='' as $$
  select private.professional_password_change_ready();
$$;
revoke all on function private.professional_password_change_ready(),
  public.professional_password_change_ready() from public,anon,service_role;
grant execute on function public.professional_password_change_ready() to authenticated;
grant execute on function private.professional_password_change_ready() to authenticated;

create or replace function private.create_professional_invitation_v2(
  p_first_name text,p_last_name text,p_email text,p_specialty_slug text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_invitation jsonb;v_token text;v_first text:=btrim(p_first_name);v_last text:=btrim(p_last_name);v_id uuid;
begin
  if v_first is null or v_last is null or length(v_first) not between 1 and 100
    or length(v_last) not between 1 and 100 then
    raise exception using errcode='22023',message='Name and surname required';
  end if;
  v_invitation=private.create_professional_invitation(p_email,p_specialty_slug,'Convocatoria profesional');
  v_id=(v_invitation->>'id')::uuid;
  update public.professional_invitations set first_name=v_first,last_name=v_last,flow_version=3 where id=v_id;
  select e.payload->>'invitation_token' into v_token from private.outbox_events e
    where e.aggregate_id=v_id and e.event_type='professional.invited' and e.channel='email';
  if v_token is null then raise exception using errcode='P0001',message='Invitation token unavailable'; end if;
  -- The new email is sent synchronously with an ephemeral password. Remove the
  -- legacy event before commit so the worker cannot send a conflicting email.
  delete from private.outbox_events where aggregate_id=v_id
    and event_type='professional.invited' and channel='email' and processed_at is null;
  return private.invitation_document_v2(v_id)||jsonb_build_object('token',v_token);
end; $$;

create function private.bind_professional_invitation_auth_user(p_invitation_id uuid,p_auth_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_invitation public.professional_invitations%rowtype;v_user auth.users%rowtype;
begin
  v_actor=private.lock_admin_mutation('operations');
  select * into v_invitation from public.professional_invitations where id=p_invitation_id for update;
  select * into v_user from auth.users where id=p_auth_user_id and deleted_at is null and banned_until is null;
  if not found or v_invitation.id is null or v_invitation.flow_version<>3
    or v_invitation.status<>'queued' or v_invitation.consumed_at is not null
    or v_invitation.bound_auth_user_id is not null or v_invitation.provisioned_auth_user_id is not null
    or lower(v_user.email)<>lower(v_invitation.email::text)
    or v_user.raw_app_meta_data->>'app_role'<>'professional'
    or v_user.raw_app_meta_data->>'signup_source'<>'professional_invitation' then
    raise exception using errcode='40001',message='Invitation identity could not be bound';
  end if;
  update public.professional_invitations set provisioned_auth_user_id=p_auth_user_id where id=p_invitation_id;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'professional.invitation.identity_provisioned','professional_invitation',p_invitation_id,
      jsonb_build_object('to_status','queued'));
end; $$;

create function public.bind_professional_invitation_auth_user(p_invitation_id uuid,p_auth_user_id uuid)
returns void language sql security invoker set search_path='' as $$
  select private.bind_professional_invitation_auth_user(p_invitation_id,p_auth_user_id);
$$;
revoke all on function private.bind_professional_invitation_auth_user(uuid,uuid),
  public.bind_professional_invitation_auth_user(uuid,uuid) from public,anon,service_role;
grant execute on function public.bind_professional_invitation_auth_user(uuid,uuid) to authenticated;
grant execute on function private.bind_professional_invitation_auth_user(uuid,uuid) to authenticated;

create function private.mark_professional_invitation_sent(p_invitation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_result jsonb;
begin
  v_actor=private.lock_admin_mutation('operations');
  update public.professional_invitations set status='sent'
    where id=p_invitation_id and flow_version=3 and status='queued'
      and provisioned_auth_user_id is not null and bound_auth_user_id is null and consumed_at is null;
  if not found then raise exception using errcode='40001',message='Invitation is no longer deliverable'; end if;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'professional.invitation.email_accepted','professional_invitation',p_invitation_id,
      jsonb_build_object('to_status','sent'));
  select private.invitation_document_v2(p_invitation_id) into v_result;
  return v_result;
end; $$;
create function public.mark_professional_invitation_sent(p_invitation_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select private.mark_professional_invitation_sent(p_invitation_id);
$$;
revoke all on function private.mark_professional_invitation_sent(uuid),
  public.mark_professional_invitation_sent(uuid) from public,anon,service_role;
grant execute on function public.mark_professional_invitation_sent(uuid) to authenticated;
grant execute on function private.mark_professional_invitation_sent(uuid) to authenticated;

create or replace function private.renew_professional_invitation(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_invitation public.professional_invitations%rowtype;v_token text;
begin
  v_actor=private.lock_admin_mutation('operations');
  select * into v_invitation from public.professional_invitations where id=p_id for update;
  if not found or v_invitation.flow_version<>3 or v_invitation.provisioned_auth_user_id is null
    or v_invitation.bound_auth_user_id is not null or v_invitation.consumed_at is not null
    or v_invitation.status not in ('queued','sent','expired') then
    raise exception using errcode='40001',message='Invitation cannot be renewed';
  end if;
  v_token=translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_');
  update public.professional_invitations set token_hash=encode(extensions.digest(v_token,'sha256'),'hex'),
    status='queued',expires_at=clock_timestamp()+interval '14 days' where id=p_id;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'professional.invitation.renewed','professional_invitation',p_id,
      jsonb_build_object('to_status','queued'));
  return private.invitation_document_v2(p_id)||jsonb_build_object(
    'token',v_token,'provisionedAuthUserId',v_invitation.provisioned_auth_user_id);
end; $$;
revoke all on function private.renew_professional_invitation(uuid) from public,anon,authenticated,service_role;
grant execute on function private.renew_professional_invitation(uuid) to authenticated;
create or replace function public.renew_professional_invitation(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.renew_professional_invitation(p_id); $$;
revoke all on function public.renew_professional_invitation(uuid) from public,anon,service_role;
grant execute on function public.renew_professional_invitation(uuid) to authenticated;

create or replace function private.copy_invitation_name_on_accept() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.flow_version in (2,3) and old.bound_auth_user_id is null and new.bound_auth_user_id is not null
    and new.status='opened' then
    update public.profiles set first_name=new.first_name,last_name=new.last_name
      where auth_user_id=new.bound_auth_user_id and role='professional';
  end if;
  return new;
end; $$;

create or replace function private.accept_professional_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user auth.users%rowtype;v_invitation public.professional_invitations%rowtype;v_profile public.profiles%rowtype;v_pro public.professional_profiles%rowtype;
begin
  if not private.current_session_active(false) then raise exception using errcode='42501',message='Verified active identity required'; end if;
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then raise exception using errcode='P0002',message='Invitation unavailable'; end if;
  select * into v_user from auth.users where id=auth.uid() for update;
  perform 1 from auth.sessions where id=private.current_session_id() and user_id=v_user.id for share;
  if not found or not private.current_session_active(false) then raise exception using errcode='42501',message='Verified active identity required'; end if;
  select * into v_invitation from public.professional_invitations
    where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and email=v_user.email::public.citext for update;
  if not found then raise exception using errcode='P0002',message='Invitation unavailable'; end if;
  if v_invitation.flow_version=3 and v_invitation.provisioned_auth_user_id is distinct from v_user.id then
    raise exception using errcode='42501',message='Invitation belongs to another identity';
  end if;
  if v_invitation.consumed_at is not null then
    if v_invitation.flow_version=3 and v_invitation.bound_auth_user_id=v_user.id
      and v_invitation.status in ('opened','completed') then
      select * into v_pro from public.professional_profiles
        where invitation_id=v_invitation.id and profile_id=(select id from public.profiles where auth_user_id=v_user.id);
      if found then return jsonb_build_object('professionalId',v_pro.id,'status',v_pro.status); end if;
    end if;
    raise exception using errcode='40001',message='Invitation already consumed';
  end if;
  if v_invitation.status not in ('queued','sent') or v_invitation.expires_at<=now() then raise exception using errcode='P0002',message='Invitation unavailable'; end if;
  select * into v_profile from public.profiles where auth_user_id=v_user.id for update;
  if found then
    if v_profile.role<>'professional' or v_user.raw_app_meta_data->>'app_role'<>'professional' then raise exception using errcode='40001',message='Identity already belongs to another account role'; end if;
    select * into v_pro from public.professional_profiles where profile_id=v_profile.id for update;
    if not found or v_pro.status<>'invited' or v_pro.invitation_id is not null then raise exception using errcode='40001',message='Professional already has an application'; end if;
  else
    if v_user.raw_app_meta_data->>'app_role' not in ('customer','professional')
      or exists(select 1 from private.customer_registration_acceptances where auth_user_id=v_user.id) then
      raise exception using errcode='40001',message='Identity already belongs to another account role'; end if;
    insert into public.profiles(auth_user_id,role,email) values(v_user.id,'professional',v_user.email) returning * into v_profile;
    insert into public.professional_profiles(profile_id,status) values(v_profile.id,'invited') returning * into v_pro;
    update auth.users set raw_app_meta_data=raw_app_meta_data||'{"app_role":"professional","signup_source":"professional_invitation"}'::jsonb where id=v_user.id;
  end if;
  update public.professional_invitations set status='opened',consumed_at=now(),bound_auth_user_id=v_user.id where id=v_invitation.id;
  update public.professional_profiles set invitation_id=v_invitation.id,status='form_started' where id=v_pro.id;
  insert into public.professional_service_categories(professional_id,category_id,approved)
    select v_pro.id,id,false from public.service_categories where slug=v_invitation.specialty_slug and active on conflict do nothing;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_profile.id,'professional.invitation.accepted','professional',v_pro.id,jsonb_build_object('from_status','invited','to_status','form_started'));
  return jsonb_build_object('professionalId',v_pro.id,'status','form_started');
end;
$$;
create or replace function public.accept_professional_invitation(p_token text) returns jsonb
language sql security invoker set search_path='' as $$ select private.accept_professional_invitation(p_token); $$;
revoke all on function private.accept_professional_invitation(text),public.accept_professional_invitation(text) from public,anon,authenticated,service_role;
grant execute on function public.accept_professional_invitation(text) to authenticated;
