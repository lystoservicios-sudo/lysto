-- Only the current verified JWT may resolve a context. No caller-supplied actor ID.
create function private.get_session_context()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile_id', p.id,
    'role', p.role,
    'customer_id', cp.id,
    'professional_id', pp.id,
    'professional_status', pp.status,
    'admin_profile_id', ap.id,
    'permissions', coalesce((
      select jsonb_agg(grant_row.permission order by grant_row.permission)
      from private.admin_profile_permissions grant_row
      where grant_row.admin_profile_id = ap.id
    ), '[]'::jsonb)
  )
  from public.profiles p
  left join public.customer_profiles cp on cp.profile_id = p.id and p.role = 'customer'
  left join public.professional_profiles pp on pp.profile_id = p.id and p.role = 'professional'
  left join public.admin_profiles ap on ap.profile_id = p.id and p.role = 'admin'
  where p.auth_user_id = (select auth.uid())
    and p.role::text = (select auth.jwt() -> 'app_metadata' ->> 'app_role')
  limit 1;
$$;

create function public.get_session_context()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.get_session_context(); $$;

revoke all on function private.get_session_context(), public.get_session_context() from public, anon, authenticated, service_role;
grant execute on function private.get_session_context(), public.get_session_context() to authenticated;
