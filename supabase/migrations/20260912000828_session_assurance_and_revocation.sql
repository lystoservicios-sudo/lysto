-- A valid JWT signature is necessary but does not prove that its session still
-- exists or that its original authority is current. Helpers stay unexposed.
create function private.current_session_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select case when auth.jwt()->>'session_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (auth.jwt()->>'session_id')::uuid else null end;
$$;

create function private.session_is_active(p_user_id uuid,p_session_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=p_session_id and s.user_id=p_user_id
      and (s.not_after is null or s.not_after>now())
      and u.email_confirmed_at is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=now())
      and u.raw_app_meta_data->>'app_role' in ('customer','professional','admin')
  );
$$;

create function private.current_session_has_mfa() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal'='aal2',false) and exists (
    select 1 from auth.sessions s join auth.mfa_factors f on f.id=s.factor_id and f.user_id=s.user_id
    where s.id=private.current_session_id() and s.user_id=auth.uid()
      and s.aal='aal2' and f.status='verified'
  );
$$;

create function private.current_session_active(p_require_admin_mfa boolean default true) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.session_is_active(auth.uid(),private.current_session_id())
    and exists (select 1 from auth.users u where u.id=auth.uid()
      and u.raw_app_meta_data->>'app_role'=auth.jwt()->'app_metadata'->>'app_role')
    and (not p_require_admin_mfa or auth.jwt()->'app_metadata'->>'app_role'<>'admin'
      or private.current_session_has_mfa());
$$;

create or replace function private.current_profile_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.profiles p where p.auth_user_id=auth.uid()
    and p.role::text=auth.jwt()->'app_metadata'->>'app_role'
    and private.current_session_active(true) limit 1;
$$;
create or replace function private.current_app_role() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id=private.current_profile_id();
$$;
create or replace function private.current_customer_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.customer_profiles where profile_id=private.current_profile_id()
    and auth.jwt()->'app_metadata'->>'app_role'='customer' limit 1;
$$;
create or replace function private.current_professional_id(p_require_approved boolean default false) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.professional_profiles where profile_id=private.current_profile_id()
    and auth.jwt()->'app_metadata'->>'app_role'='professional'
    and (not p_require_approved or status='approved') limit 1;
$$;
create or replace function private.current_admin_profile_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.admin_profiles where profile_id=private.current_profile_id()
    and auth.jwt()->'app_metadata'->>'app_role'='admin' limit 1;
$$;

-- The own-account context is available at aal1 so enrollment can happen.
-- It grants no table access; administrative RLS above still requires aal2.
create or replace function private.get_session_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile_id',p.id,'role',p.role,'customer_id',cp.id,
    'professional_id',pp.id,'professional_status',pp.status,'admin_profile_id',ap.id,
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

revoke all on function private.current_session_id(),private.session_is_active(uuid,uuid),
  private.current_session_has_mfa(),private.current_session_active(boolean) from public,anon,authenticated,service_role;
grant execute on function private.current_session_id(),private.current_session_has_mfa(),
  private.current_session_active(boolean) to authenticated;

-- Bind server inspection to the exact session that initiated it. A logout
-- cannot race the acknowledgement: the session/user locks last until commit.
create function private.finalize_verified_upload(p_intent_id uuid,p_actor_auth_user_id uuid,p_actual_mime_type text,p_actual_size_bytes bigint,p_actual_sha256 text,p_output_size_bytes bigint,p_output_sha256 text,p_actor_session_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=p_actor_session_id and s.user_id=p_actor_auth_user_id for share of s,u;
  if not found or not private.session_is_active(p_actor_auth_user_id,p_actor_session_id) then
    raise exception using errcode='42501',message='Upload session is no longer active';
  end if;
  return private.finalize_verified_upload(p_intent_id,p_actor_auth_user_id,p_actual_mime_type,p_actual_size_bytes,p_actual_sha256,p_output_size_bytes,p_output_sha256);
end;
$$;
create function public.finalize_verified_upload(p_intent_id uuid,p_actor_auth_user_id uuid,p_actual_mime_type text,p_actual_size_bytes bigint,p_actual_sha256 text,p_output_size_bytes bigint,p_output_sha256 text,p_actor_session_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$
  select private.finalize_verified_upload(p_intent_id,p_actor_auth_user_id,p_actual_mime_type,p_actual_size_bytes,p_actual_sha256,p_output_size_bytes,p_output_sha256,p_actor_session_id);
$$;
revoke all on function private.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text),public.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text) from public,anon,authenticated,service_role;
revoke all on function private.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text,uuid),public.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text,uuid) from public,anon,authenticated,service_role;
grant execute on function private.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text,uuid),public.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text,uuid) to service_role;

-- Revocation guards on original entry points. Preserve their existing domain checks.

create or replace function private.bootstrap_customer_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user auth.users%rowtype; v_profile public.profiles%rowtype; v_customer uuid; v_acceptance private.customer_registration_acceptances%rowtype;
begin
  if not private.current_session_active(true) then raise exception using errcode='42501',message='Confirmed customer session required'; end if;
  select * into v_user from auth.users where id=(select auth.uid()) for update;
  if not found or v_user.email_confirmed_at is null or v_user.raw_app_meta_data->>'app_role' is distinct from 'customer'
    or (select auth.jwt()->'app_metadata'->>'app_role') is distinct from 'customer' then
    raise exception using errcode='42501',message='Confirmed customer session required';
  end if;
  select * into v_profile from public.profiles where auth_user_id=v_user.id;
  if found and v_profile.role <> 'customer' then raise exception using errcode='42501',message='Account role mismatch'; end if;
  if v_profile.id is not null then
    select id into v_customer from public.customer_profiles where profile_id=v_profile.id;
    if v_customer is not null then return jsonb_build_object('status','ready','profile_id',v_profile.id,'customer_id',v_customer); end if;
  end if;
  select * into v_acceptance from private.customer_registration_acceptances where auth_user_id=v_user.id;
  if not found then return jsonb_build_object('status','incomplete'); end if;
  if v_profile.id is null then
    insert into public.profiles(auth_user_id,role,first_name,last_name,email,phone)
    values(v_user.id,'customer',v_acceptance.first_name,v_acceptance.last_name,v_user.email,v_acceptance.phone)
    returning * into v_profile;
  end if;
  insert into public.customer_profiles(profile_id) values(v_profile.id) on conflict(profile_id) do nothing;
  select id into v_customer from public.customer_profiles where profile_id=v_profile.id;
  return jsonb_build_object('status','ready','profile_id',v_profile.id,'customer_id',v_customer);
end;
$$;

create or replace function private.complete_customer_registration(p_first_name text,p_last_name text,p_phone text,p_terms_version text,p_privacy_version text,p_accepted boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user auth.users%rowtype;
begin
  if not private.current_session_active(true) then raise exception using errcode='42501',message='Confirmed customer session required'; end if;
  select * into v_user from auth.users where id=(select auth.uid()) for update;
  if not found or v_user.email_confirmed_at is null or v_user.raw_app_meta_data->>'app_role' is distinct from 'customer'
    or (select auth.jwt()->'app_metadata'->>'app_role') is distinct from 'customer' then
    raise exception using errcode='42501',message='Confirmed customer session required';
  end if;
  perform private.record_customer_acceptance(v_user.id,p_first_name,p_last_name,p_phone,p_terms_version,p_privacy_version,p_accepted);
  return private.bootstrap_customer_account();
end;
$$;

create or replace function private.create_upload_intent(p_kind text,p_mime_type text,p_size_bytes bigint,p_sha256 text,p_entity_id uuid,p_draft_id uuid,p_phase text,p_document_type text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_intent private.upload_intents; v_id uuid:=gen_random_uuid(); v_customer uuid; v_bucket text; v_path text; v_output_mime text;
begin
  if not private.current_session_active(true) then raise exception using errcode='42501',message='Upload access denied'; end if;
  v_actor:=private.upload_actor((select auth.uid()));
  if v_actor.role::text is distinct from (select auth.jwt()->'app_metadata'->>'app_role') then raise exception using errcode='42501',message='Upload access denied'; end if;
  if p_kind is null or p_kind not in ('request-photo','professional-document','job-photo','job-document')
    or p_mime_type is null or p_mime_type not in ('image/jpeg','image/png','image/webp')
    or p_size_bytes is null or p_size_bytes<=0 or p_size_bytes>(case when p_kind='job-document' then 20971520 else 10485760 end)
    or p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$'
    or (p_entity_id is not null and p_draft_id is not null)
    or (p_kind<>'request-photo' and (p_entity_id is null or p_draft_id is not null))
    or (p_kind='job-photo' and (p_phase is null or p_phase not in ('before','during','after')))
    or (p_kind='job-document' and p_phase is distinct from 'document')
    or (p_kind not in ('job-photo','job-document') and p_phase is not null)
    or (p_kind='professional-document' and (p_document_type is null or p_document_type !~ '^[a-z][a-z0-9_-]{0,63}$'))
    or (p_kind<>'professional-document' and p_document_type is not null)
  then raise exception using errcode='22023',message='Invalid upload declaration'; end if;
  if p_kind='request-photo' and p_entity_id is null and p_draft_id is null then
    select id into v_customer from public.customer_profiles where profile_id=v_actor.id and v_actor.role='customer';
    if not found then raise exception using errcode='42501',message='Upload access denied'; end if;
    insert into private.request_upload_drafts(customer_id,owner_profile_id) values(v_customer,v_actor.id) returning id into p_draft_id;
  end if;
  perform private.authorize_upload_target(v_actor,p_kind,p_entity_id,p_draft_id);
  v_output_mime:=case when p_kind in ('professional-document','job-document') then 'image/jpeg' else 'image/webp' end;
  if p_kind='request-photo' then
    v_bucket:='request-media'; v_path:=v_actor.auth_user_id::text||'/'||coalesce(p_entity_id,p_draft_id)::text||'/photo/'||v_id::text||'.webp';
  elsif p_kind='professional-document' then
    v_bucket:='professional-documents'; v_path:=v_actor.auth_user_id::text||'/'||p_entity_id::text||'/'||v_id::text||'.jpg';
  else
    v_bucket:='job-evidence'; v_path:=p_entity_id::text||'/'||v_actor.auth_user_id::text||'/'||p_phase||'/'||v_id::text||case when p_kind='job-document' then '.jpg' else '.webp' end;
  end if;
  insert into private.upload_intents(id,owner_profile_id,owner_auth_user_id,kind,entity_id,draft_id,mime_type,size_bytes,sha256,phase,document_type,quarantine_path,output_bucket,output_path,output_mime_type)
  values(v_id,v_actor.id,v_actor.auth_user_id,p_kind,p_entity_id,p_draft_id,p_mime_type,p_size_bytes,p_sha256,p_phase,p_document_type,v_actor.id::text||'/'||v_id::text,v_bucket,v_path,v_output_mime) returning * into v_intent;
  return private.upload_intent_json(v_intent);
end;
$$;

create or replace function private.get_upload_intent(p_intent_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_intent private.upload_intents;
begin
  if not private.current_session_active(true) then raise exception using errcode='42501',message='Upload access denied'; end if;
  v_actor:=private.upload_actor((select auth.uid()));
  if v_actor.role::text is distinct from (select auth.jwt()->'app_metadata'->>'app_role') then raise exception using errcode='42501',message='Upload access denied'; end if;
  select * into v_intent from private.upload_intents where id=p_intent_id;
  if not found or not private.can_read_upload(v_intent,v_actor) then raise exception using errcode='42501',message='Upload access denied'; end if;
  return private.upload_intent_json(v_intent);
end;
$$;

create or replace function private.can_sign_upload_quarantine(p_path text,p_owner text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_intent private.upload_intents;
begin
  if not private.current_session_active(true) then raise exception using errcode='42501',message='Upload access denied'; end if;
  v_actor:=private.upload_actor((select auth.uid()));
  if v_actor.role::text is distinct from (select auth.jwt()->'app_metadata'->>'app_role') or p_owner is distinct from v_actor.auth_user_id::text then return false; end if;
  select * into v_intent from private.upload_intents where quarantine_path=p_path and owner_profile_id=v_actor.id and status='pending' and expires_at>now();
  if not found then return false; end if;
  perform private.authorize_upload_target(v_actor,v_intent.kind,v_intent.entity_id,v_intent.draft_id);
  return true;
exception when insufficient_privilege then return false;
end;
$$;
