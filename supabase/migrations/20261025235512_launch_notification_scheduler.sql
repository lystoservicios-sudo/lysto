begin;

-- The current Vercel Hobby plan cannot trigger a per-minute job. Install the
-- hosted Supabase scheduler, but leave its job paused until operational review.
create extension if not exists pg_cron with schema pg_catalog;

-- Managed pg_net queues expose their decrypted request headers to login roles,
-- and their system-owned ACLs cannot be tightened by the project postgres role.
-- Use synchronous HTTP in a schema whose USAGE we can actually revoke instead.
create schema if not exists private_outbox_http;
revoke all on schema private_outbox_http
  from public, anon, authenticated, service_role;
create extension if not exists http with schema private_outbox_http;
do $extension_guard$
begin
  if exists (
    select 1 from pg_catalog.pg_extension e
      where e.extname = 'http'
        and e.extnamespace <> 'private_outbox_http'::regnamespace
  ) or exists (
    select 1 from pg_catalog.pg_namespace n
      where n.nspname = 'private_outbox_http'
        and n.nspowner <> current_user::regrole
  ) then
    raise exception using errcode = '55000',
      message = 'outbox_http_extension_must_be_private';
  end if;
end;
$extension_guard$;

-- No arguments: neither callers nor cron metadata can redirect the request or
-- change its channel. Provision this production-only Vault entry separately.
create or replace function private.invoke_production_outbox_worker()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_secret text;
  v_status integer;
begin
  select s.decrypted_secret into v_secret
    from vault.decrypted_secrets s
    where s.name = 'lysto_production_outbox_worker_secret';
  if v_secret is null or v_secret !~ '^[A-Za-z0-9_-]{32,128}$' then
    raise exception using errcode = '55000',
      message = 'outbox_scheduler_secret_not_provisioned';
  end if;

  begin
    -- Supabase restricts SET of the http GUCs. The extension's supported API
    -- configures these options without changing database/role configuration.
    perform private_outbox_http.http_reset_curlopt();
    if not private_outbox_http.http_set_curlopt('CURLOPT_TIMEOUT_MS', '55000')
      or not private_outbox_http.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS', '10000')
      or not private_outbox_http.http_set_curlopt('CURLOPT_SSL_VERIFYPEER', '1')
      or not private_outbox_http.http_set_curlopt('CURLOPT_SSL_VERIFYHOST', '2') then
      raise exception using errcode = '58000',
        message = 'outbox_scheduler_transport_not_configured';
    end if;
    select r.status into v_status
      from private_outbox_http.http((
        'POST',
        'https://lystohogar.com/api/internal/outbox',
        array[private_outbox_http.http_header('Authorization', 'Bearer ' || v_secret)],
        'application/json',
        jsonb_build_object('batchSize', 5, 'inAppOnly', true)::text
      )::private_outbox_http.http_request) r;
    perform private_outbox_http.http_reset_curlopt();
  exception when others then
    perform private_outbox_http.http_reset_curlopt();
    raise exception using errcode = '58000',
      message = 'outbox_scheduler_transport_failed';
  end;
  if v_status is distinct from 200 then
    raise exception using errcode = '58000',
      message = 'outbox_scheduler_http_failed';
  end if;
  return v_status;
end;
$function$;

revoke all on function private.invoke_production_outbox_worker()
  from public, anon, authenticated, service_role;

-- Extension functions retain system-owned PUBLIC EXECUTE grants. The enclosing
-- postgres-owned schema blocks their resolution/invocation by application roles.
do $permissions$
declare
  v_role text;
begin
  for v_role in
    select rolname from pg_catalog.pg_roles where rolname like 'lysto\_%' escape '\'
  loop
    execute pg_catalog.format(
      'revoke all on function private.invoke_production_outbox_worker() from %I', v_role
    );
    execute pg_catalog.format(
      'revoke all on schema private_outbox_http from %I', v_role
    );
  end loop;
end;
$permissions$;

-- A named schedule is updated on replay rather than duplicated. Creation and
-- deactivation commit together: no request is sent by applying this migration.
do $scheduler$
declare
  v_job_id bigint;
begin
  v_job_id := cron.schedule(
    'lysto-production-outbox-v1',
    '* * * * *',
    'select private.invoke_production_outbox_worker();'
  );
  perform cron.alter_job(v_job_id, active := false);
end;
$scheduler$;

commit;
