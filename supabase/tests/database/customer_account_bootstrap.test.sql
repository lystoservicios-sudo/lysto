begin;

\ir ../fixtures/session.sql.inc

select no_plan();
select has_function('public','get_registration_policy',array[]::text[],'public can discover current registration policy');
select has_function('public','bootstrap_customer_account',array[]::text[],'bootstrap cannot accept another identity');
select has_function('public','complete_customer_registration',array['text','text','text','text','text','boolean'],'existing users can complete their own account');
select has_table('private','customer_registration_acceptances','registration acceptance is stored outside the exposed schema');
select has_table('private','account_legal_documents','legal versions have a trusted catalogue');
select has_trigger('auth','users','lysto_customer_registration_defaults','public Auth registration assigns a trusted role');
update private.account_registration_policy set enabled=false where singleton;
select is(private.get_registration_policy(),null::jsonb,'registration can be disabled without changing approved documents');
select ok(not has_schema_privilege('anon','private','usage'),'anonymous private-schema boundary is unchanged');
select ok(not has_function_privilege('anon','public.get_registration_policy()','execute'),'anonymous clients cannot call the service reader');
select ok(has_function_privilege('service_role','public.get_registration_policy()','execute'),'server can read only the public-facing policy');
select ok(not has_function_privilege('service_role','public.bootstrap_customer_account()','execute'),'service role cannot stand in for a customer');
select ok(not has_table_privilege('authenticated','private.customer_registration_acceptances','select'),'acceptance snapshots are private');
select ok(not (select prosecdef from pg_proc where oid='public.bootstrap_customer_account()'::regprocedure),'exposed bootstrap is an invoker wrapper');

insert into private.account_legal_documents(kind,version,document_url,content_sha256,test_only) values
('terms','test-only-terms-t07','http://127.0.0.1:3100/test/terms',repeat('a',64),true),
('privacy','test-only-privacy-t07','http://127.0.0.1:3100/test/privacy',repeat('b',64),true);
update private.account_registration_policy set enabled=true,terms_version='test-only-terms-t07',privacy_version='test-only-privacy-t07';
select is(private.get_registration_policy()->>'test_only','true','test documents are explicitly unapproved fixtures');

select throws_ok($$insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values('74000000-0000-4000-8000-000000000009','invalid-legal@lysto.test','{}','{"first_name":"Test","last_name":"User","phone":"12345678","accepted":true,"terms_version":"arbitrary","privacy_version":"test-only-privacy-t07","app_role":"admin"}')$$,'P0001','Current legal acceptance is required','arbitrary terms metadata cannot bypass policy');
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
('74000000-0000-4000-8000-000000000001','public-customer@lysto.test',now(),'{}','{"first_name":"Snapshot","last_name":"Customer","phone":"12345678","accepted":true,"terms_version":"test-only-terms-t07","privacy_version":"test-only-privacy-t07","app_role":"admin"}'),
('74000000-0000-4000-8000-000000000002','existing-customer@lysto.test',now(),'{"app_role":"customer"}','{}'),
('74000000-0000-4000-8000-000000000003','existing-admin@lysto.test',now(),'{"app_role":"admin"}','{}'),
('74000000-0000-4000-8000-000000000004','existing-pro@lysto.test',now(),'{"app_role":"professional"}','{}'),
('74000000-0000-4000-8000-000000000005','pending-customer@lysto.test',null,'{}','{"first_name":"Pending","last_name":"Customer","phone":"12345678","accepted":true,"terms_version":"test-only-terms-t07","privacy_version":"test-only-privacy-t07"}');
select is((select raw_app_meta_data->>'app_role' from auth.users where id='74000000-0000-4000-8000-000000000001'),'customer','public user cannot select privileged role');
select is((select count(*)::int from public.profiles where auth_user_id between '74000000-0000-4000-8000-000000000001' and '74000000-0000-4000-8000-000000000005'),0,'Auth provisioning never collides with explicit fixture profiles');
select is((select count(*)::int from private.customer_registration_acceptances where auth_user_id in ('74000000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000004')),0,'admin and professional provisioning do not create customer acceptance');
update auth.users set raw_user_meta_data='{"first_name":"Tampered","terms_version":"arbitrary","app_role":"admin"}' where id='74000000-0000-4000-8000-000000000001';
select is((select terms_version from private.customer_registration_acceptances where auth_user_id='74000000-0000-4000-8000-000000000001'),'test-only-terms-t07','later user metadata cannot rewrite original acceptance');
select throws_ok($$update private.customer_registration_acceptances set terms_version='arbitrary' where auth_user_id='74000000-0000-4000-8000-000000000001'$$,'P0001','Registration acceptance is immutable','acceptance cannot be silently edited');

select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"74000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"app_role":"customer"},"user_metadata":{"app_role":"admin"}}',true);
set local role authenticated;
select is(public.bootstrap_customer_account()->>'status','ready','confirmed customer can bootstrap own profile');
select is(public.bootstrap_customer_account()->>'profile_id',public.get_session_context()->>'profile_id','replay returns the original profile');
select is(public.bootstrap_customer_account()->>'customer_id',public.get_session_context()->>'customer_id','replay returns the original customer');
reset role;
select is((select first_name from public.profiles where auth_user_id='74000000-0000-4000-8000-000000000001'),'Snapshot','profile uses immutable validated registration data');
create temp table t07_original_ids as select id from public.profiles where auth_user_id='74000000-0000-4000-8000-000000000001';
delete from public.customer_profiles where profile_id in (select id from t07_original_ids);
set local role authenticated;
select is(public.bootstrap_customer_account()->>'status','ready','repairs a profile missing its customer row');
reset role;
select is((select id from public.profiles where auth_user_id='74000000-0000-4000-8000-000000000001'),(select id from t07_original_ids),'repair preserves the original profile id');
select is((select count(*)::int from public.profiles where auth_user_id='74000000-0000-4000-8000-000000000001'),1,'repeated bootstrap never duplicates profiles');

select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"74000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select is(public.bootstrap_customer_account()->>'status','incomplete','legacy Auth account can complete its missing acceptance');
select throws_ok($$select public.complete_customer_registration('Legacy','Customer','12345678','arbitrary','test-only-privacy-t07',true)$$,'P0001','Current legal acceptance is required','completion rejects arbitrary versions');
select is(public.complete_customer_registration('Legacy','Customer','12345678','test-only-terms-t07','test-only-privacy-t07',true)->>'status','ready','legacy user completes the existing Auth account');
reset role;
select is((select auth_user_id from public.profiles where email='existing-customer@lysto.test'),'74000000-0000-4000-8000-000000000002'::uuid,'completion keeps the same Auth id');

select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"74000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"app_role":"admin"}}',true);
set local role authenticated;
select throws_ok($$select public.bootstrap_customer_account()$$,'42501','Confirmed customer session required','admin cannot become a customer through bootstrap');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"74000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"app_role":"professional"}}',true);
set local role authenticated;
select throws_ok($$select public.complete_customer_registration('Pro','Test','12345678','test-only-terms-t07','test-only-privacy-t07',true)$$,'42501','Confirmed customer session required','professional cannot use customer completion');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"74000000-0000-4000-8000-000000000005","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select throws_ok($$select public.bootstrap_customer_account()$$,'42501','Confirmed customer session required','unconfirmed email cannot bootstrap');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"74000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
update auth.users set raw_app_meta_data='{"app_role":"admin"}' where id='74000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.bootstrap_customer_account()$$,'42501','Confirmed customer session required','current Auth role overrides an old JWT claim');
reset role;
select * from finish();
rollback;
