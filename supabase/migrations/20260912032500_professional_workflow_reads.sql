-- A token and recipient are required together. This scanner-safe check returns
-- no identity, token, profile, or domain authority and performs no mutation.
create function public.professional_invitation_matches(p_token text,p_email text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(p_token ~ '^[A-Za-z0-9_-]{43}$' and length(p_email)<=254 and exists(
    select 1 from public.professional_invitations i
    where i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
      and lower(i.email)=lower(trim(p_email)) and i.status in ('queued','sent')
      and i.consumed_at is null and i.expires_at>now()),false);
$$;
revoke all on function public.professional_invitation_matches(text,text) from public,service_role;
grant execute on function public.professional_invitation_matches(text,text) to anon,authenticated;

create function private.list_professional_workflow(p_resource text,p_limit integer default 25,p_before_created_at timestamptz default null,p_before_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_items jsonb; v_total bigint;
begin
  if not private.has_admin_permission('operations') then raise exception 'Operations permission required' using errcode='42501'; end if;
  if p_resource not in ('invitations','professionals') or p_resource is null or p_limit is null or p_limit<1 or p_limit>100
    or (p_before_created_at is null)<>(p_before_id is null) then raise exception 'Invalid page' using errcode='22023'; end if;
  if p_resource='invitations' then
    select count(*) into v_total from public.professional_invitations;
    select coalesce(jsonb_agg(private.invitation_document(id) order by created_at desc,id desc),'[]'::jsonb) into v_items
      from (select id,created_at from public.professional_invitations
        where p_before_id is null or (created_at,id)<(p_before_created_at,p_before_id)
        order by created_at desc,id desc limit p_limit+1) page;
  else
    select count(*) into v_total from public.professional_profiles;
    select coalesce(jsonb_agg(jsonb_build_object('id',pp.id,'createdAt',pp.created_at,'version',pp.version,
      'firstName',p.first_name,'lastName',p.last_name,'email',p.email,'status',pp.status,
      'eligible',private.professional_clearance_valid(pp.id),'invited',pp.invitation_id is not null)
      order by pp.created_at desc,pp.id desc),'[]'::jsonb) into v_items
      from (select * from public.professional_profiles
        where p_before_id is null or (created_at,id)<(p_before_created_at,p_before_id)
        order by created_at desc,id desc limit p_limit+1) pp join public.profiles p on p.id=pp.profile_id;
  end if;
  return jsonb_build_object('items',v_items,'total',v_total);
end;
$$;
create function public.list_professional_workflow(p_resource text,p_limit integer default 25,p_before_created_at timestamptz default null,p_before_id uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$ select private.list_professional_workflow(p_resource,p_limit,p_before_created_at,p_before_id); $$;
revoke all on function private.list_professional_workflow(text,integer,timestamptz,uuid),public.list_professional_workflow(text,integer,timestamptz,uuid) from public,anon,service_role;
grant execute on function private.list_professional_workflow(text,integer,timestamptz,uuid),public.list_professional_workflow(text,integer,timestamptz,uuid) to authenticated;
