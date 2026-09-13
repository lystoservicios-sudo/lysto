create or replace function private.change_admin_permissions(p_admin_profile_id uuid,p_expected_version integer,p_permissions public.admin_permission[],p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_actor_admin uuid; v_target public.admin_profiles%rowtype; v_before public.admin_permission[]; v_after public.admin_permission[];
begin
  -- Recheck authority after waiting: a captured token must not outlive a grant.
  perform pg_advisory_xact_lock(537975841827451329::bigint);
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id join auth.mfa_factors f on f.id=s.factor_id and f.user_id=u.id
    where s.id=private.current_session_id() and u.id=auth.uid() for share of s,u,f;
  if not found or not private.has_admin_permission('owner') then raise exception using errcode='42501',message='Current owner with MFA required'; end if;
  v_actor=private.current_profile_id(); v_actor_admin=private.current_admin_profile_id();
  -- Out-of-band grant deletion must either precede this check or wait for commit.
  perform 1 from private.admin_profile_permissions where admin_profile_id=v_actor_admin and permission='owner' for share;
  if not found then raise exception using errcode='42501',message='Current owner grant required'; end if;
  if p_expected_version is null or p_expected_version<1 or p_permissions is null or cardinality(p_permissions)>4
    or array_position(p_permissions,null) is not null or length(btrim(coalesce(p_reason,''))) not between 10 and 1000 then
    raise exception using errcode='22023',message='Valid permissions, version and reason required';
  end if;
  select array_agg(distinct p order by p) into v_after from unnest(p_permissions) p;
  v_after=coalesce(v_after,array[]::public.admin_permission[]);
  select * into v_target from public.admin_profiles where id=p_admin_profile_id for update;
  if not found then raise exception using errcode='P0002',message='Administrative account not found'; end if;
  if v_target.permissions_version<>p_expected_version then raise exception using errcode='40001',message='Permissions changed'; end if;
  select coalesce(array_agg(permission order by permission),array[]::public.admin_permission[]) into v_before
    from private.admin_profile_permissions where admin_profile_id=p_admin_profile_id;
  if v_before=v_after then return private.admin_permission_document(p_admin_profile_id); end if;
  if 'owner'::public.admin_permission=any(v_before) and not ('owner'::public.admin_permission=any(v_after)) then
    perform 1 from public.admin_profiles a join public.profiles p on p.id=a.profile_id join auth.users u on u.id=p.auth_user_id
      join auth.mfa_factors f on f.user_id=u.id and f.status='verified'
      where a.id<>p_admin_profile_id and p.role='admin' and u.raw_app_meta_data->>'app_role'='admin'
        and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
        and exists(select 1 from private.admin_profile_permissions g where g.admin_profile_id=a.id and g.permission='owner')
      order by a.id,f.id limit 1 for share of a,p,u,f;
    if not found then raise exception using errcode='40001',message='Cannot remove the final usable owner'; end if;
  end if;
  delete from private.admin_profile_permissions where admin_profile_id=p_admin_profile_id and not (permission=any(v_after));
  insert into private.admin_profile_permissions(admin_profile_id,permission,granted_by_admin_profile_id)
    select p_admin_profile_id,p,v_actor_admin from unnest(v_after) p on conflict(admin_profile_id,permission) do nothing;
  -- Capture the authorized actor before a permitted self-removal. Audit failure
  -- rolls back grants and version increments along with this insert.
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'admin.permissions.updated','admin_profile',p_admin_profile_id,jsonb_build_object('before',v_before,'after',v_after,'reason',btrim(p_reason)));
  return private.admin_permission_document(p_admin_profile_id);
end;
$$;
