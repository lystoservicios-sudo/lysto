-- Preserve the private-schema boundary for anonymous clients. A dedicated,
-- non-REST schema exposes only the token/recipient boolean check.
create schema invitation_gateway;
revoke all on schema invitation_gateway from public,anon,authenticated,service_role;
grant usage on schema invitation_gateway to anon,authenticated;
create function invitation_gateway.matches(p_token text,p_email text) returns boolean
language sql stable security definer set search_path='' as $$
  select private.professional_invitation_matches(p_token,p_email);
$$;
revoke all on function invitation_gateway.matches(text,text) from public,anon,authenticated,service_role;
grant execute on function invitation_gateway.matches(text,text) to anon,authenticated;
create or replace function public.professional_invitation_matches(p_token text,p_email text) returns boolean
language sql stable security invoker set search_path='' as $$ select invitation_gateway.matches(p_token,p_email); $$;
revoke usage on schema private from anon;
revoke all on function private.professional_invitation_matches(text,text) from anon;
