begin;
\ir ../fixtures/session.sql.inc
select no_plan();
select ok(not has_function_privilege('authenticated','private.assert_customer_request_ready()','execute'),'Readiness helper is not exposed');
select ok(not has_function_privilege('authenticated','public.submit_service_quote(uuid)','execute'),'Legacy submission stays revoked');

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
('c3140000-0000-4000-8000-000000000001','readiness@example.test',now(),'{"app_role":"customer"}');
insert into public.profiles(id,auth_user_id,role,email,first_name,last_name,phone) values
('c3140000-0000-4000-8000-000000000010','c3140000-0000-4000-8000-000000000001','customer','readiness@example.test','Ana','Pérez',null);
insert into public.customer_profiles(id,profile_id) values
('c3140000-0000-4000-8000-000000000011','c3140000-0000-4000-8000-000000000010');
insert into public.customer_addresses(id,customer_id,street,number,city,province,property_type) values
('c3140000-0000-4000-8000-000000000012','c3140000-0000-4000-8000-000000000011','San Martín','932','Vicente López','Buenos Aires','office');
insert into public.service_quotes(id,customer_id,address,input,quote,preferred_date,time_window,status,expires_at) values
('c3140000-0000-4000-8000-000000000002','c3140000-0000-4000-8000-000000000011',
'{"street":"San Martín","number":"932","city":"Vicente López","province":"Buenos Aires"}',
'{"issue":"mantenimiento","timeSince":"days","urgency":"flexible","propertyType":"office","access":{},"materialsConfirmed":true}',
'{"total":130000,"calculatorSubtotal":100000,"safetyRate":0.3,"professionalAmount":106600,"platformFee":23400,"platformContribution":15600,"coverage":"covered","scope":"Mantenimiento","route":{"source":"manual","tollsVerified":true}}',
current_date+1,'10:00 – 12:00','ready',now()+interval '30 minutes');
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"c3140000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);

set local role authenticated;
select throws_ok($$select public.submit_service_quote_v2('c3140000-0000-4000-8000-000000000002',1)$$,'42501','customer_profile_incomplete','Versioned RPC cannot bypass a missing phone');
reset role;
update public.profiles set phone='abcdefgh' where id='c3140000-0000-4000-8000-000000000010';
set local role authenticated;
select throws_ok($$select public.submit_service_quote_v2('c3140000-0000-4000-8000-000000000002',1)$$,'42501','customer_profile_incomplete','Non-phone input is rejected');
reset role;
update public.profiles set phone='+54 9 11 2233 4455' where id='c3140000-0000-4000-8000-000000000010';
update public.customer_addresses set archived_at=now() where id='c3140000-0000-4000-8000-000000000012';
set local role authenticated;
select throws_ok($$select public.submit_service_quote_v2('c3140000-0000-4000-8000-000000000002',1)$$,'42501','customer_profile_incomplete','Archived addresses never satisfy onboarding');
reset role;
update public.customer_addresses set archived_at=null where id='c3140000-0000-4000-8000-000000000012';
select lives_ok($$select private.assert_customer_request_ready()$$,'Valid profile and active office address satisfy onboarding');
update auth.users set email_confirmed_at=null where id='c3140000-0000-4000-8000-000000000001';
select throws_ok($$select private.assert_customer_request_ready()$$,'42501','Current customer session required','Removing email confirmation invalidates the active customer session before readiness');
update auth.users set email_confirmed_at=now() where id='c3140000-0000-4000-8000-000000000001';
select is((select count(*)::int from public.jobs where customer_id='c3140000-0000-4000-8000-000000000011'),0,'Rejected calls create no jobs');
-- Existing quote lifecycle tests cover reviewed offer validation, tariff freshness,
-- photo integrity, version conflicts and accepted-call replay on this same v2 RPC.
select * from finish();
rollback;
