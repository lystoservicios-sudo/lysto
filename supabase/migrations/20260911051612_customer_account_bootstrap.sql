-- D08 remains closed: this migration intentionally seeds no legal documents.
create table private.account_legal_documents (
  kind text not null check (kind in ('terms','privacy')),
  version text not null check (length(version) between 1 and 100),
  document_url text not null check (document_url ~ '^https?://'),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  approved_at timestamptz,
  test_only boolean not null default false,
  primary key (kind,version),
  check (not test_only or approved_at is null)
);
create table private.account_registration_policy (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  terms_version text,
  privacy_version text
);
insert into private.account_registration_policy (enabled) values (false);
create table private.customer_registration_acceptances (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (length(first_name) between 1 and 100),
  last_name text not null check (length(last_name) between 1 and 100),
  phone text not null check (length(phone) between 6 and 40),
  terms_version text not null,
  privacy_version text not null,
  terms_sha256 text not null,
  privacy_sha256 text not null,
  accepted_at timestamptz not null default now(),
  test_only boolean not null
);
alter table private.account_legal_documents enable row level security;
alter table private.account_registration_policy enable row level security;
alter table private.customer_registration_acceptances enable row level security;
revoke all on private.account_legal_documents, private.account_registration_policy, private.customer_registration_acceptances from public, anon, authenticated, service_role;

create function private.get_registration_policy() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('terms_version', t.version, 'privacy_version', p.version,
    'terms_url', t.document_url, 'privacy_url', p.document_url,
    'terms_sha256',t.content_sha256,'privacy_sha256',p.content_sha256,
    'test_only',t.test_only or p.test_only)
  from private.account_registration_policy config
  join private.account_legal_documents t on t.kind='terms' and t.version=config.terms_version
  join private.account_legal_documents p on p.kind='privacy' and p.version=config.privacy_version
  where config.enabled and (t.approved_at is not null or t.test_only) and (p.approved_at is not null or p.test_only);
$$;
create function public.get_registration_policy() returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.get_registration_policy(); $$;
revoke all on function private.get_registration_policy(), public.get_registration_policy() from public, anon, authenticated, service_role;
grant execute on function private.get_registration_policy(), public.get_registration_policy() to service_role;

create function private.record_customer_acceptance(p_user_id uuid,p_first_name text,p_last_name text,p_phone text,p_terms_version text,p_privacy_version text,p_accepted boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_policy jsonb;
begin
  v_policy := private.get_registration_policy();
  if v_policy is null then raise exception using errcode='P0001',message='Registration is unavailable'; end if;
  if p_accepted is distinct from true or p_terms_version is distinct from v_policy->>'terms_version' or p_privacy_version is distinct from v_policy->>'privacy_version' then
    raise exception using errcode='P0001',message='Current legal acceptance is required';
  end if;
  insert into private.customer_registration_acceptances(auth_user_id,first_name,last_name,phone,terms_version,privacy_version,terms_sha256,privacy_sha256,test_only)
  values(p_user_id,trim(p_first_name),trim(p_last_name),trim(p_phone),p_terms_version,p_privacy_version,v_policy->>'terms_sha256',v_policy->>'privacy_sha256',(v_policy->>'test_only')::boolean)
  on conflict (auth_user_id) do nothing;
end;
$$;
revoke all on function private.record_customer_acceptance(uuid,text,text,text,text,text,boolean) from public,anon,authenticated,service_role;

create function private.customer_registration_defaults() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- app metadata can only be provided by trusted Auth administration. User metadata never chooses a role.
  if not (coalesce(new.raw_app_meta_data,'{}'::jsonb) ? 'app_role') then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data,'{}'::jsonb) || '{"app_role":"customer","signup_source":"customer_public"}'::jsonb;
  end if;
  return new;
end;
$$;
create trigger lysto_customer_registration_defaults before insert on auth.users for each row execute function private.customer_registration_defaults();
create function private.capture_customer_registration() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data->>'app_role' = 'customer' and new.raw_app_meta_data->>'signup_source' = 'customer_public' then
    perform private.record_customer_acceptance(new.id,new.raw_user_meta_data->>'first_name',new.raw_user_meta_data->>'last_name',new.raw_user_meta_data->>'phone',
      new.raw_user_meta_data->>'terms_version',new.raw_user_meta_data->>'privacy_version',new.raw_user_meta_data->'accepted' = 'true'::jsonb);
  end if;
  return new;
end;
$$;
create trigger lysto_capture_customer_registration after insert on auth.users for each row execute function private.capture_customer_registration();
create function private.prevent_customer_acceptance_update() returns trigger
language plpgsql set search_path = '' as $$ begin raise exception 'Registration acceptance is immutable'; end; $$;
create trigger customer_registration_acceptance_immutable before update on private.customer_registration_acceptances for each row execute function private.prevent_customer_acceptance_update();
revoke all on function private.customer_registration_defaults(),private.capture_customer_registration(),private.prevent_customer_acceptance_update() from public,anon,authenticated,service_role;

create function private.bootstrap_customer_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_user auth.users%rowtype; v_profile public.profiles%rowtype; v_customer uuid; v_acceptance private.customer_registration_acceptances%rowtype;
begin
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
create function public.bootstrap_customer_account() returns jsonb
language sql security invoker set search_path = '' as $$ select private.bootstrap_customer_account(); $$;

create function private.complete_customer_registration(p_first_name text,p_last_name text,p_phone text,p_terms_version text,p_privacy_version text,p_accepted boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user auth.users%rowtype;
begin
  select * into v_user from auth.users where id=(select auth.uid()) for update;
  if not found or v_user.email_confirmed_at is null or v_user.raw_app_meta_data->>'app_role' is distinct from 'customer'
    or (select auth.jwt()->'app_metadata'->>'app_role') is distinct from 'customer' then
    raise exception using errcode='42501',message='Confirmed customer session required';
  end if;
  perform private.record_customer_acceptance(v_user.id,p_first_name,p_last_name,p_phone,p_terms_version,p_privacy_version,p_accepted);
  return private.bootstrap_customer_account();
end;
$$;
create function public.complete_customer_registration(p_first_name text,p_last_name text,p_phone text,p_terms_version text,p_privacy_version text,p_accepted boolean)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.complete_customer_registration(p_first_name,p_last_name,p_phone,p_terms_version,p_privacy_version,p_accepted);
$$;
revoke all on function private.bootstrap_customer_account(),public.bootstrap_customer_account(),private.complete_customer_registration(text,text,text,text,text,boolean),public.complete_customer_registration(text,text,text,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function private.bootstrap_customer_account(),public.bootstrap_customer_account(),private.complete_customer_registration(text,text,text,text,text,boolean),public.complete_customer_registration(text,text,text,text,text,boolean) to authenticated;
