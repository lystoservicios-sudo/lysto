-- Read-only assertions and negative authorization checks; safe on the linked project.
begin;
do $$ begin
  if to_regprocedure('public.save_admin_service_request(jsonb)') is null then
    raise exception 'Administrative request command must exist';
  end if;
  if not (select relrowsecurity from pg_class where oid='private.admin_service_requests'::regclass) then
    raise exception 'Administrative drafts must have RLS';
  end if;
  if has_table_privilege('authenticated','private.admin_service_requests','SELECT') then
    raise exception 'Draft financial snapshots must not be directly readable';
  end if;
  if has_function_privilege('anon','public.save_admin_service_request(jsonb)','EXECUTE') then
    raise exception 'Anonymous users must not create administrative requests';
  end if;
end $$;
set local role authenticated;
do $$ begin
  begin
    perform public.save_admin_service_request('{}'::jsonb);
    raise exception 'Creation without a live authorized session must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.accept_admin_service_request('00000000-0000-4000-8000-000000000001',1,1,1);
    raise exception 'Acceptance without the owning customer must fail';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
