begin;

\ir ../fixtures/session.sql.inc

select no_plan();

insert into auth.users (instance_id,id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,email_confirmed_at)
values
('00000000-0000-0000-0000-000000000000','71000000-0000-4000-8000-000000000001','authenticated','authenticated','session-customer@lysto.test','{"app_role":"customer"}','{}',now(),now(),now()),
('00000000-0000-0000-0000-000000000000','71000000-0000-4000-8000-000000000002','authenticated','authenticated','session-admin@lysto.test','{"app_role":"admin"}','{}',now(),now(),now()),
('00000000-0000-0000-0000-000000000000','71000000-0000-4000-8000-000000000003','authenticated','authenticated','session-professional@lysto.test','{"app_role":"professional"}','{}',now(),now(),now());
insert into public.profiles (id,auth_user_id,role,first_name,last_name,email)
values
('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','customer','Session','Customer','session-customer@lysto.test'),
('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','admin','Session','Admin','session-admin@lysto.test'),
('72000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000003','professional','Session','Professional','session-professional@lysto.test');
insert into public.customer_profiles (id,profile_id) values ('73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001');
insert into public.admin_profiles (id,profile_id) values ('73000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002');
insert into public.professional_profiles (id,profile_id,status) values ('73000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000003','approved');
insert into private.admin_profile_permissions (admin_profile_id,permission) values ('73000000-0000-4000-8000-000000000002','operations');

select has_function('public','get_session_context',array[]::text[],'context has no caller identity parameter');
select ok(not has_function_privilege('anon','public.get_session_context()','execute'),'anonymous cannot execute context RPC');
select ok(not has_function_privilege('service_role','public.get_session_context()','execute'),'service role is not a substitute for an authenticated session');
select ok(not (select prosecdef from pg_proc where oid='public.get_session_context()'::regprocedure),'exposed wrapper is security invoker');
select ok((select prosecdef from pg_proc where oid='private.get_session_context()'::regprocedure),'privileged lookup stays private');
select ok(not has_table_privilege('authenticated','private.admin_profile_permissions','select'),'context does not expose private permission table');

select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"app_role":"customer"},"user_metadata":{"app_role":"admin","permissions":["owner"]}}',true);
set local role authenticated;
select is(public.get_session_context()->>'profile_id','72000000-0000-4000-8000-000000000001','returns current profile only');
select is(public.get_session_context()->>'customer_id','73000000-0000-4000-8000-000000000001','returns current customer entity');
select is(public.get_session_context()->>'admin_profile_id',null::text,'metadata cannot create admin identity');
select is(public.get_session_context()->'permissions','[]'::jsonb,'metadata cannot grant permissions');
reset role;

select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"app_role":"admin"}}',true);
set local role authenticated;
select is(public.get_session_context()->'permissions','["operations"]'::jsonb,'returns current database grants');
reset role;
delete from private.admin_profile_permissions where admin_profile_id='73000000-0000-4000-8000-000000000002';
set local role authenticated;
select is(public.get_session_context()->'permissions','[]'::jsonb,'permission removal is visible with the same JWT');
reset role;

select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"app_role":"professional"}}',true);
set local role authenticated;
select is(public.get_session_context()->>'professional_status','approved','returns current professional approval');
reset role;
update public.professional_profiles set status='suspended' where id='73000000-0000-4000-8000-000000000003';
set local role authenticated;
select is(public.get_session_context()->>'professional_status','suspended','suspension is visible with the same JWT');
reset role;

select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"app_role":"admin"}}',true);
set local role authenticated;
select is(public.get_session_context(),null::jsonb,'mismatched trusted claim cannot resolve a context');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select is(public.get_session_context(),null::jsonb,'editable metadata cannot replace the trusted claim');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","app_metadata":{"app_role":"admin"}}',true);
set local role authenticated;
select is(private.current_profile_id(),null::uuid,'aal1 admin has no domain profile authority');
select is(public.get_session_context()->>'aal','aal1','own security context permits enrollment at aal1');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","session_id":"71000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select is(public.get_session_context(),null::jsonb,'another user session cannot authenticate the subject');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","session_id":"invalid","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select is(public.get_session_context(),null::jsonb,'malformed session id fails closed without cast error');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
update auth.sessions set not_after=now()-interval '1 minute' where id='71000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.get_session_context(),null::jsonb,'expired server session is rejected independently of JWT expiry');
reset role;
delete from auth.sessions where id='71000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.get_session_context(),null::jsonb,'removed server session cannot be reconstructed from its JWT');
reset role;
select ok(not has_function_privilege('service_role','public.finalize_verified_upload(uuid,uuid,text,bigint,text,bigint,text)','execute'),'old sessionless finalizer is not executable by server role');
select ok(not has_function_privilege('authenticated','private.session_is_active(uuid,uuid)','execute'),'clients cannot probe arbitrary Auth sessions');
select * from finish();
rollback;
