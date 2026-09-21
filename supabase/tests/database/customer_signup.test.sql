begin;
\ir ../fixtures/session.sql.inc
select no_plan();

select ok(not exists(select 1 from pg_trigger where tgname='lysto_signup_customer_profile'), 'Public web never provisions profiles on Auth insert');
select ok(not has_function_privilege('anon','public.bootstrap_customer_account()','execute'), 'Anonymous users cannot bootstrap');
select ok(not has_function_privilege('service_role','public.bootstrap_customer_account()','execute'), 'Service role cannot bootstrap another user');
update private.account_registration_policy set enabled=false where singleton;
select is(private.get_registration_policy(),null::jsonb,'disabled-policy behavior remains covered after release activation');

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values
('c3130000-0000-4000-8000-000000000001','oauth-customer@example.test',now(),'{"provider":"google","providers":["google"]}','{"given_name":"Ana","family_name":"Pérez","app_role":"admin"}'),
('c3130000-0000-4000-8000-000000000002','oauth-pending@example.test',null,'{"provider":"google","providers":["google"]}','{}'),
('c3130000-0000-4000-8000-000000000003','staff-isolation@example.test',now(),'{"app_role":"admin"}','{}');

select is((select raw_app_meta_data->>'app_role' from auth.users where id='c3130000-0000-4000-8000-000000000001'),'customer','Google identity receives trusted customer role');
select is((select count(*)::int from public.profiles where auth_user_id in ('c3130000-0000-4000-8000-000000000001','c3130000-0000-4000-8000-000000000002')),0,'OAuth identities have no domain profiles before explicit completion');
select is((select count(*)::int from private.customer_registration_acceptances where auth_user_id='c3130000-0000-4000-8000-000000000001'),0,'Google metadata never implies legal acceptance');

select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"c3130000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select is(public.bootstrap_customer_account()->>'status','incomplete','Confirmed OAuth identity must complete account');
select throws_ok($$select public.complete_customer_registration('Ana','Pérez','12345678','unapproved','unapproved',true)$$,'P0001','Registration is unavailable','Disabled policy cannot be bypassed through OAuth');
reset role;

insert into private.account_legal_documents(kind,version,document_url,content_sha256,test_only) values
('terms','oauth-test-terms','http://127.0.0.1:3100/test/terms',repeat('a',64),true),
('privacy','oauth-test-privacy','http://127.0.0.1:3100/test/privacy',repeat('b',64),true);
update private.account_registration_policy set enabled=true,terms_version='oauth-test-terms',privacy_version='oauth-test-privacy';
set local role authenticated;
select throws_ok($$select public.complete_customer_registration('Ana','Pérez','12345678','oauth-test-terms','oauth-test-privacy',false)$$,'P0001','Current legal acceptance is required','An unchecked form cannot create a profile');
select is(public.complete_customer_registration('Ana','Pérez','12345678','oauth-test-terms','oauth-test-privacy',true)->>'status','ready','Explicit acceptance provisions the existing OAuth account');
select is(public.bootstrap_customer_account()->>'status','ready','Bootstrap remains idempotent');
reset role;
select is((select count(*)::int from public.profiles where auth_user_id='c3130000-0000-4000-8000-000000000001'),1,'Only one customer profile is created');
select is((select role::text from public.profiles where auth_user_id='c3130000-0000-4000-8000-000000000001'),'customer','Editable metadata cannot elevate privileges');

select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"c3130000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select throws_ok($$select public.bootstrap_customer_account()$$,'42501','Confirmed customer session required','Unconfirmed OAuth/email identity cannot bootstrap');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"c3130000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"app_role":"admin"}}',true);
set local role authenticated;
select throws_ok($$select public.complete_customer_registration('Staff','Person','12345678','oauth-test-terms','oauth-test-privacy',true)$$,'42501','Confirmed customer session required','Staff keeps separate authority');
reset role;
select * from finish();
rollback;
