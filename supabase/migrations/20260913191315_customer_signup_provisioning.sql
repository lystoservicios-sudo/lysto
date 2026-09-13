-- Public signups always enter as customers. Authorization never reads user metadata.
-- Existing staff creation with trusted app_metadata is deliberately left alone.
create or replace function private.set_signup_customer_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is not null and not coalesce(new.is_anonymous, false)
     and nullif(new.raw_app_meta_data ->> 'app_role', '') is null then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"app_role":"customer"}'::jsonb;
  end if;
  return new;
end;
$$;

create or replace function private.provision_signup_customer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare customer_profile_id uuid;
begin
  if new.email is null or coalesce(new.is_anonymous, false)
     or (new.raw_app_meta_data ->> 'app_role') is distinct from 'customer' then
    return new;
  end if;
  insert into public.profiles(auth_user_id, role, email, first_name, last_name)
  values (new.id, 'customer', new.email,
    left(trim(coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'given_name', '')), 100),
    left(trim(coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data ->> 'family_name', '')), 100))
  on conflict (auth_user_id) do nothing;
  select id into customer_profile_id from public.profiles where auth_user_id = new.id and role = 'customer';
  if customer_profile_id is not null then
    insert into public.customer_profiles(profile_id) values (customer_profile_id) on conflict (profile_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.set_signup_customer_role() from public, anon, authenticated, service_role;
revoke all on function private.provision_signup_customer() from public, anon, authenticated, service_role;
drop trigger if exists lysto_signup_customer_role on auth.users;
create trigger lysto_signup_customer_role before insert on auth.users for each row execute function private.set_signup_customer_role();
drop trigger if exists lysto_signup_customer_profile on auth.users;
create trigger lysto_signup_customer_profile after insert on auth.users for each row execute function private.provision_signup_customer();

-- Repair the missing claim only for existing, trusted customer database records.
update auth.users u set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || '{"app_role":"customer"}'::jsonb
where nullif(u.raw_app_meta_data ->> 'app_role', '') is null
  and exists (select 1 from public.profiles p where p.auth_user_id = u.id and p.role = 'customer');

insert into public.customer_profiles(profile_id)
select p.id from public.profiles p where p.role = 'customer' and p.auth_user_id is not null
on conflict (profile_id) do nothing;
