-- Flow 3 accounts are provisioned before first login. Their durable identity,
-- not the temporary email URL, is the source of truth for resuming onboarding.
update public.professional_invitations
set expires_at='9999-12-31 23:59:59+00'::timestamptz
where flow_version=3 and status in ('queued','sent','opened');

create or replace function private.invitation_document_v2(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',id,'firstName',first_name,'lastName',last_name,
    'email',email,'specialtySlug',specialty_slug,'status',status,
    'expiresAt',case when flow_version=3 then null else expires_at end,
    'createdAt',created_at,'version',version)
  from public.professional_invitations where id=p_id;
$$;

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
  update public.professional_invitations set first_name=v_first,last_name=v_last,flow_version=3,
    expires_at='9999-12-31 23:59:59+00'::timestamptz where id=v_id;
  select e.payload->>'invitation_token' into v_token from private.outbox_events e
    where e.aggregate_id=v_id and e.event_type='professional.invited' and e.channel='email';
  if v_token is null then raise exception using errcode='P0001',message='Invitation token unavailable'; end if;
  delete from private.outbox_events where aggregate_id=v_id
    and event_type='professional.invited' and channel='email' and processed_at is null;
  return private.invitation_document_v2(v_id)||jsonb_build_object('token',v_token);
end; $$;

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
    status='queued',expires_at='9999-12-31 23:59:59+00'::timestamptz where id=p_id;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'professional.invitation.renewed','professional_invitation',p_id,
      jsonb_build_object('to_status','queued'));
  return private.invitation_document_v2(p_id)||jsonb_build_object(
    'token',v_token,'provisionedAuthUserId',v_invitation.provisioned_auth_user_id);
end; $$;

create or replace function private.accept_professional_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user auth.users%rowtype;v_invitation public.professional_invitations%rowtype;v_profile public.profiles%rowtype;v_pro public.professional_profiles%rowtype;
begin
  if not private.current_session_active(false) then raise exception using errcode='42501',message='Verified active identity required'; end if;
  if p_token is not null and p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception using errcode='P0002',message='Invitation unavailable';
  end if;
  select * into v_user from auth.users where id=auth.uid() for update;
  perform 1 from auth.sessions where id=private.current_session_id() and user_id=v_user.id for share;
  if not found or not private.current_session_active(false) then raise exception using errcode='42501',message='Verified active identity required'; end if;
  select * into v_invitation from public.professional_invitations
    where (p_token is not null
        and token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
        and email=v_user.email::public.citext)
      or (flow_version=3 and provisioned_auth_user_id=v_user.id)
    for update;
  if not found then
    if p_token is null then return null; end if;
    raise exception using errcode='P0002',message='Invitation unavailable';
  end if;
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
  if v_invitation.status not in ('queued','sent')
    or (v_invitation.flow_version<>3 and v_invitation.expires_at<=now()) then
    raise exception using errcode='P0002',message='Invitation unavailable';
  end if;
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
language sql security invoker set search_path='' as $$
  select private.accept_professional_invitation(p_token);
$$;
