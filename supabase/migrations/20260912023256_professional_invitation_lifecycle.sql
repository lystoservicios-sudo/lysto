alter table public.professional_invitations drop constraint professional_invitations_status_check;
alter table public.professional_invitations add constraint professional_invitations_status_check
  check(status in ('queued','sent','opened','completed','expired','cancelled'));
alter table public.professional_invitations add column version integer not null default 1;
alter table public.professional_invitations add column consumed_at timestamptz;
alter table public.professional_invitations add column bound_auth_user_id uuid references auth.users(id);
alter table public.professional_profiles add column version integer not null default 1;
create trigger professional_invitations_version before update on public.professional_invitations
  for each row execute function private.advance_asset_version();
create trigger professional_profiles_version before update on public.professional_profiles
  for each row execute function private.advance_asset_version();
create index professional_invitation_email_lifecycle on public.professional_invitations(email,status,expires_at);
revoke all on public.professional_invitations from authenticated;
grant select(id,email,phone,specialty_slug,status,expires_at,created_by,created_at,updated_at,version,consumed_at) on public.professional_invitations to authenticated;

-- Serialize with permission changes and retain the authority used by the mutation.
create function private.lock_admin_mutation(p_permission public.admin_permission) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_admin uuid;
begin
  perform pg_advisory_xact_lock(537975841827451329::bigint);
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id join auth.mfa_factors f on f.id=s.factor_id and f.user_id=u.id
    where s.id=private.current_session_id() and u.id=auth.uid() for share of s,u,f;
  if not found or not private.has_admin_permission(p_permission) then raise exception using errcode='42501',message='Current administrative permission and MFA required'; end if;
  v_actor=private.current_profile_id();v_admin=private.current_admin_profile_id();
  perform 1 from private.admin_profile_permissions where admin_profile_id=v_admin and permission in (p_permission,'owner') for share;
  if not found then raise exception using errcode='42501',message='Current administrative grant required'; end if;
  return v_actor;
end;
$$;
revoke all on function private.lock_admin_mutation(public.admin_permission) from public,anon,authenticated,service_role;

create function private.invitation_document(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',id,'email',email,'specialtySlug',specialty_slug,'status',status,'expiresAt',expires_at,'createdAt',created_at,'version',version)
  from public.professional_invitations where id=p_id;
$$;
revoke all on function private.invitation_document(uuid) from public,anon,authenticated,service_role;

create function private.create_professional_invitation(p_email text,p_specialty_slug text,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_id uuid;v_token text;v_email text:=lower(btrim(p_email));
begin
  v_actor=private.lock_admin_mutation('operations');
  if v_email is null or length(v_email)>254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    or length(btrim(coalesce(p_reason,''))) not between 10 and 1000 then raise exception using errcode='22023',message='Valid recipient and reason required'; end if;
  perform 1 from public.service_categories where slug=p_specialty_slug and active for share;
  if not found then raise exception using errcode='22023',message='Active specialty required'; end if;
  if exists(select 1 from public.professional_invitations where email=v_email::public.citext and status in ('queued','sent','opened') and expires_at>now()) then
    raise exception using errcode='40001',message='A current invitation already exists'; end if;
  v_token=translate(rtrim(encode(extensions.gen_random_bytes(32),'base64'),'='),'+/','-_');
  insert into public.professional_invitations(email,specialty_slug,token_hash,status,created_by)
    values(v_email,p_specialty_slug,encode(extensions.digest(v_token,'sha256'),'hex'),'queued',v_actor) returning id into v_id;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'professional.invited','professional_invitation',v_id,jsonb_build_object('reason',btrim(p_reason),'to_status','queued'));
  insert into private.outbox_events(event_type,aggregate_type,aggregate_id,channel,recipient_key,dedupe_key,payload)
    values('professional.invited','professional_invitation',v_id,'email',v_email,v_id::text,jsonb_build_object('invitation_id',v_id,'invitation_token',v_token,'recipient_email',v_email));
  return private.invitation_document(v_id);
end;
$$;
create function public.create_professional_invitation(p_email text,p_specialty_slug text,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$ select private.create_professional_invitation(p_email,p_specialty_slug,p_reason); $$;
revoke all on function private.create_professional_invitation(text,text,text),public.create_professional_invitation(text,text,text) from public,anon,authenticated,service_role;
grant execute on function private.create_professional_invitation(text,text,text),public.create_professional_invitation(text,text,text) to authenticated;

create function private.accept_professional_invitation(p_token text) returns jsonb
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
  if v_invitation.consumed_at is not null then raise exception using errcode='40001',message='Invitation already consumed'; end if;
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
create function public.accept_professional_invitation(p_token text) returns jsonb
language sql security invoker set search_path='' as $$ select private.accept_professional_invitation(p_token); $$;
revoke all on function private.accept_professional_invitation(text),public.accept_professional_invitation(text) from public,anon,authenticated,service_role;
grant execute on function private.accept_professional_invitation(text),public.accept_professional_invitation(text) to authenticated;

create function private.read_professional_onboarding() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_pro public.professional_profiles%rowtype;v_profile public.profiles%rowtype;
begin
  select * into v_pro from public.professional_profiles where id=private.current_professional_id(false);
  if not found or v_pro.invitation_id is null or v_pro.status not in ('form_started','form_submitted','under_review','rejected','approved') then
    raise exception using errcode='42501',message='Bound professional application required'; end if;
  select * into v_profile from public.profiles where id=v_pro.profile_id;
  return jsonb_build_object('professionalId',v_pro.id,'version',v_pro.version,'status',v_pro.status,'firstName',v_profile.first_name,'lastName',v_profile.last_name);
end;
$$;
create function public.read_professional_onboarding() returns jsonb
language sql security invoker set search_path='' as $$ select private.read_professional_onboarding(); $$;
revoke all on function private.read_professional_onboarding(),public.read_professional_onboarding() from public,anon,authenticated,service_role;
grant execute on function private.read_professional_onboarding(),public.read_professional_onboarding() to authenticated;
