begin;
select plan(23);

select has_table('public','job_schedule_reservations','schedule reservations exist');
select has_table('public','job_reschedule_requests','reschedule requests exist');
select has_table('public','professional_absences','professional absences exist');
select has_column('public','jobs','schedule_version','jobs use an optimistic schedule version');
select col_not_null('public','jobs','schedule_version','schedule version cannot be null');
select has_column('public','professional_profiles','schedule_settings_version','schedule settings are versioned');
select has_function('public','reserve_job_schedule',array['uuid','timestamp with time zone','integer','integer','text','integer','integer'],'reservation RPC exists');
select has_function('public','request_job_reschedule',array['uuid','timestamp with time zone','integer','integer','text','integer'],'reschedule proposal RPC exists');
select has_function('public','respond_job_reschedule',array['uuid','text','integer'],'reschedule response RPC exists');
select has_function('public','get_schedule_availability',array['uuid','date','date'],'availability RPC exists');
select has_function('public','replace_professional_schedule_settings',array['uuid','jsonb','jsonb','integer'],'settings mutation RPC exists');
select has_function('public','expire_schedule_holds',array[]::text[],'hold expiry RPC exists');
select function_privs_are('public','reserve_job_schedule',array['uuid','timestamp with time zone','integer','integer','text','integer','integer'],'authenticated',array['EXECUTE'],'only authenticated can reserve');
select function_privs_are('public','request_job_reschedule',array['uuid','timestamp with time zone','integer','integer','text','integer'],'authenticated',array['EXECUTE'],'only authenticated can propose');
select function_privs_are('public','respond_job_reschedule',array['uuid','text','integer'],'authenticated',array['EXECUTE'],'only authenticated can respond');
select function_privs_are('public','get_schedule_availability',array['uuid','date','date'],'authenticated',array['EXECUTE'],'only authenticated can read');
select function_privs_are('public','replace_professional_schedule_settings',array['uuid','jsonb','jsonb','integer'],'authenticated',array['EXECUTE'],'only authenticated can replace settings');
select row_security_is('public','job_schedule_reservations',true,'reservation RLS enabled');
select row_security_is('public','job_reschedule_requests',true,'reschedule RLS enabled');
select row_security_is('public','professional_absences',true,'absence RLS enabled');
select ok((select count(*)=1 from pg_constraint where conname='job_schedule_no_professional_overlap'),'database owns overlap arbitration');
select has_trigger('public','jobs','job_schedule_release','job cancellation releases reservations');
select unlike((select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_schedule_availability'),'% limit %','availability does not hide reservations behind a row limit');

select * from finish();
rollback;
