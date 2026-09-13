-- The own-profile SELECT policy predates strict session checks. Route it through
-- the same authority helper as every other identity table, including admin MFA.
alter policy profiles_self_read on public.profiles using (
  id=(select private.current_profile_id())
  or (select private.has_admin_permission('operations'))
);

-- Internal jobs/events without a user session have no user actor. Short-circuit
-- before consulting identity tables for every row of a background/bulk insert.
create or replace function private.current_profile_id() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or private.current_session_id() is null then return null; end if;
  if not private.current_session_active(true) then return null; end if;
  return (select p.id from public.profiles p where p.auth_user_id=v_user
    and p.role::text=auth.jwt()->'app_metadata'->>'app_role' limit 1);
end;
$$;
