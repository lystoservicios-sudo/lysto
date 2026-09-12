-- Keep privileged reads outside the exposed schema, including anonymous token checks.
create function private.professional_invitation_matches(p_token text,p_email text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(p_token ~ '^[A-Za-z0-9_-]{43}$' and length(p_email)<=254 and exists(
    select 1 from public.professional_invitations i
    where i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
      and lower(i.email)=lower(trim(p_email)) and i.status in ('queued','sent')
      and i.consumed_at is null and i.expires_at>now()),false);
$$;
create or replace function public.professional_invitation_matches(p_token text,p_email text) returns boolean
language sql stable security invoker set search_path='' as $$ select private.professional_invitation_matches(p_token,p_email); $$;
revoke all on function private.professional_invitation_matches(text,text),public.professional_invitation_matches(text,text) from public,service_role;
grant execute on function private.professional_invitation_matches(text,text),public.professional_invitation_matches(text,text) to anon,authenticated;
