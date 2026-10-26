begin;

-- Email delivery is now explicitly authorized. Install the reviewed scheduler
-- mode paused; operations must verify delivery before reactivating its job.
do $prerequisite$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations
    where version = '20261026005743' and name = 'outbox_email_current_state') then
    raise exception using errcode = '55000', message = 'outbox_email_state_guard_required';
  end if;
end;
$prerequisite$;

do $pause$
declare v_job_id bigint;
begin
  select jobid into strict v_job_id from cron.job
    where jobname = 'lysto-production-outbox-v1'
      and username = current_user
      and command = 'select private.invoke_production_outbox_worker();';
  perform cron.alter_job(v_job_id, active := false);
end;
$pause$;

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
        jsonb_build_object('batchSize', 5, 'inAppOnly', false)::text
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
do $permissions$
declare v_role text;
begin
  for v_role in select rolname from pg_catalog.pg_roles where rolname like 'lysto\_%' escape '\'
  loop
    execute pg_catalog.format('revoke all on function private.invoke_production_outbox_worker() from %I', v_role);
  end loop;
end;
$permissions$;

commit;
