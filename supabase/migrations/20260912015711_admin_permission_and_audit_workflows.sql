alter table public.admin_profiles add column permissions_version integer not null default 1;
create index admin_audit_page on public.admin_audit_logs(created_at desc,id desc);

create function private.advance_admin_permission_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.admin_profiles set permissions_version=permissions_version+1 where id=coalesce(new.admin_profile_id,old.admin_profile_id);
  return coalesce(new,old);
end;
$$;
revoke all on function private.advance_admin_permission_version() from public,anon,authenticated,service_role;
create trigger admin_permission_version after insert or update or delete on private.admin_profile_permissions
for each row execute function private.advance_admin_permission_version();

create function private.admin_permission_document(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',a.id,'firstName',p.first_name,'lastName',p.last_name,'version',a.permissions_version,
    'createdAt',a.created_at,'permissions',coalesce((select jsonb_agg(g.permission order by g.permission) from private.admin_profile_permissions g where g.admin_profile_id=a.id),'[]'::jsonb))
  from public.admin_profiles a join public.profiles p on p.id=a.profile_id where a.id=p_id;
$$;
revoke all on function private.admin_permission_document(uuid) from public,anon,authenticated,service_role;

create function private.change_admin_permissions(p_admin_profile_id uuid,p_expected_version integer,p_permissions public.admin_permission[],p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_actor_admin uuid; v_target public.admin_profiles%rowtype; v_before public.admin_permission[]; v_after public.admin_permission[];
begin
  -- Recheck authority after waiting: a captured token must not outlive a grant.
  perform pg_advisory_xact_lock(537975841827451329::bigint);
  perform 1 from auth.sessions s join auth.users u on u.id=s.user_id join auth.mfa_factors f on f.id=s.factor_id and f.user_id=u.id
    where s.id=private.current_session_id() and u.id=auth.uid() for share of s,u,f;
  if not found or not private.has_admin_permission('owner') then raise exception using errcode='42501',message='Current owner with MFA required'; end if;
  v_actor=private.current_profile_id(); v_actor_admin=private.current_admin_profile_id();
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
create function public.change_admin_permissions(p_admin_profile_id uuid,p_expected_version integer,p_permissions public.admin_permission[],p_reason text) returns jsonb
language sql security invoker set search_path='' as $$ select private.change_admin_permissions(p_admin_profile_id,p_expected_version,p_permissions,p_reason); $$;
revoke all on function private.change_admin_permissions(uuid,integer,public.admin_permission[],text),public.change_admin_permissions(uuid,integer,public.admin_permission[],text) from public,anon,authenticated,service_role;
grant execute on function private.change_admin_permissions(uuid,integer,public.admin_permission[],text),public.change_admin_permissions(uuid,integer,public.admin_permission[],text) to authenticated;

-- Keep infrastructure bootstrap compatibility, but retire the unaudited public
-- application entrypoint. The service role gets an explicitly attributed record.
alter function private.set_admin_permissions(uuid,public.admin_permission[]) rename to set_admin_permissions_bootstrap_core;
revoke all on function private.set_admin_permissions_bootstrap_core(uuid,public.admin_permission[]) from public,anon,authenticated,service_role;
create function private.set_admin_permissions(p_admin_profile_id uuid,p_permissions public.admin_permission[]) returns void
language plpgsql security definer set search_path='' as $$
declare v_before jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='Infrastructure permission provisioning only'; end if;
  perform pg_advisory_xact_lock(537975841827451329::bigint);
  v_before=private.admin_permission_document(p_admin_profile_id)->'permissions';
  perform private.set_admin_permissions_bootstrap_core(p_admin_profile_id,p_permissions);
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(null,'admin.permissions.provisioned','admin_profile',p_admin_profile_id,jsonb_build_object('before',v_before,'after',private.admin_permission_document(p_admin_profile_id)->'permissions','reason','Trusted infrastructure permission provisioning'));
end;
$$;
revoke all on function private.set_admin_permissions(uuid,public.admin_permission[]),public.set_admin_permissions(uuid,public.admin_permission[]) from public,anon,authenticated,service_role;
grant execute on function private.set_admin_permissions(uuid,public.admin_permission[]),public.set_admin_permissions(uuid,public.admin_permission[]) to service_role;

create function private.audit_scope(p_action text) returns public.admin_permission language sql immutable set search_path='' as $$
  select case when p_action like 'payment.%' or p_action like 'payment\_%' escape '\' then 'finance'
    when p_action like 'quality.%' or p_action like 'warranty.%' or p_action like 'quality\_%' escape '\' then 'quality'
    when p_action like 'professional.%' or p_action like 'job.%' or p_action like 'request.%' or p_action like 'pricing.%'
      or p_action like 'professional\_%' escape '\' or p_action like 'request\_%' escape '\' or p_action like 'job\_%' escape '\' or p_action like 'price\_%' escape '\' then 'operations'
    else 'owner' end::public.admin_permission;
$$;
create function private.can_read_admin_audit(p_action text) returns boolean language sql stable security definer set search_path='' as $$
  select private.has_admin_permission(private.audit_scope(p_action));
$$;
revoke all on function private.audit_scope(text),private.can_read_admin_audit(text) from public,anon,authenticated,service_role;
grant execute on function private.can_read_admin_audit(text) to authenticated;
drop policy admin_audit_logs_admin_read on public.admin_audit_logs;
create policy admin_audit_logs_scoped_read on public.admin_audit_logs for select to authenticated using(private.can_read_admin_audit(action));
revoke all on public.admin_audit_logs from authenticated;
grant select(id,actor_profile_id,action,entity_type,entity_id,created_at) on public.admin_audit_logs to authenticated;
revoke update,delete on public.admin_audit_logs from service_role;

create function private.safe_admin_audit_metadata(p_metadata jsonb) returns jsonb language sql immutable set search_path='' as $$
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from jsonb_each(case when jsonb_typeof(p_metadata)='object' then p_metadata else '{}'::jsonb end)
    where (key in ('amount','status','payment_id','job_id','professional_id','request_id','from_status','to_status','reason','decision','definitive','attempt_count','retry_seconds')
      and jsonb_typeof(value) in ('string','number','boolean','null') and length(value::text)<=1200)
      or (key in ('before','after','permissions') and jsonb_typeof(value)='array' and jsonb_array_length(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end)<=4
        and not exists(select 1 from jsonb_array_elements(case when jsonb_typeof(value)='array' then value else '[]'::jsonb end) item where item #>> '{}' not in ('operations','finance','quality','owner')));
$$;
revoke all on function private.safe_admin_audit_metadata(jsonb) from public,anon,authenticated,service_role;

create function private.list_admin_workflow(p_resource text,p_limit integer,p_cursor_at timestamptz,p_cursor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_items jsonb; v_total bigint;
begin
  if p_resource not in ('permissions','audit') or p_resource is null or p_limit is null or p_limit not between 1 and 100
    or ((p_cursor_at is null)<>(p_cursor_id is null)) then raise exception using errcode='22023',message='Invalid administrative page'; end if;
  if not private.has_any_admin_permission() or (p_resource='permissions' and not private.has_admin_permission('owner')) then
    raise exception using errcode='42501',message='Administrative access denied';
  end if;
  if p_resource='permissions' then
    select count(*) into v_total from public.admin_profiles;
    select coalesce(jsonb_agg(private.admin_permission_document(a.id) order by a.created_at desc,a.id desc),'[]'::jsonb) into v_items
      from (select id,created_at from public.admin_profiles where p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id) order by created_at desc,id desc limit p_limit+1) a;
  else
    select count(*) into v_total from public.admin_audit_logs a where private.can_read_admin_audit(a.action);
    select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'actorProfileId',a.actor_profile_id,'action',a.action,'entityType',a.entity_type,'entityId',a.entity_id,'createdAt',a.created_at,'metadata',private.safe_admin_audit_metadata(a.metadata)) order by a.created_at desc,a.id desc),'[]'::jsonb) into v_items
      from (select * from public.admin_audit_logs where private.can_read_admin_audit(action) and (p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id)) order by created_at desc,id desc limit p_limit+1) a;
  end if;
  return jsonb_build_object('items',v_items,'total',v_total);
end;
$$;
create function public.list_admin_workflow(p_resource text,p_limit integer,p_cursor_at timestamptz,p_cursor_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.list_admin_workflow(p_resource,p_limit,p_cursor_at,p_cursor_id); $$;
revoke all on function private.list_admin_workflow(text,integer,timestamptz,uuid),public.list_admin_workflow(text,integer,timestamptz,uuid) from public,anon,authenticated,service_role;
grant execute on function private.list_admin_workflow(text,integer,timestamptz,uuid),public.list_admin_workflow(text,integer,timestamptz,uuid) to authenticated;
