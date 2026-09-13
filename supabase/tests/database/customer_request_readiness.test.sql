begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(9);
select ok(not has_function_privilege('authenticated', 'private.assert_customer_request_ready()', 'execute'), 'Readiness helper is not exposed to client sessions');

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values ('c3140000-0000-4000-8000-000000000001','readiness@example.test',now(),'{"app_role":"customer"}','{"first_name":"Ana","last_name":"Pérez"}');
insert into public.customer_addresses(customer_id,street,number,city,province,property_type)
select cp.id,'San Martín','932','Vicente López','Buenos Aires','office' from public.customer_profiles cp join public.profiles p on p.id=cp.profile_id where p.auth_user_id='c3140000-0000-4000-8000-000000000001';
insert into public.service_categories(slug,name) values('aire_acondicionado','Aire acondicionado') on conflict(slug) do nothing;
insert into public.service_issue_types(category_id,slug,name) select id,'mantenimiento','Mantenimiento' from public.service_categories where slug='aire_acondicionado' on conflict(category_id,slug) do nothing;
insert into public.service_quotes(id,customer_id,address,input,quote,preferred_date,time_window,status,expires_at)
select 'c3140000-0000-4000-8000-000000000002',cp.id,
 '{"street":"San Martín","number":"932","city":"Vicente López","province":"Buenos Aires"}',
 '{"issue":"mantenimiento","timeSince":"days","urgency":"flexible","propertyType":"office","access":{},"materialsConfirmed":true}',
 '{"total":130000,"calculatorSubtotal":100000,"safetyRate":0.3,"professionalAmount":106600,"platformFee":23400,"platformContribution":15600,"coverage":"covered","scope":"Mantenimiento","route":{"source":"manual","tollsVerified":true}}',
 current_date+1,'10:00 – 12:00','ready',now()+interval '30 minutes'
from public.customer_profiles cp join public.profiles p on p.id=cp.profile_id where p.auth_user_id='c3140000-0000-4000-8000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"c3140000-0000-4000-8000-000000000001","app_metadata":{"app_role":"customer"}}',true);
select throws_ok($$select public.submit_service_quote('c3140000-0000-4000-8000-000000000002')$$,'P0001','customer_profile_incomplete','Direct RPC cannot bypass a missing phone');
select is((select count(*) from public.jobs),0::bigint,'Incomplete signup creates no job');
reset role;
update public.profiles set phone='abcdefgh' where auth_user_id='c3140000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.submit_service_quote('c3140000-0000-4000-8000-000000000002')$$,'P0001','customer_profile_incomplete','A non-phone string cannot bypass readiness');
reset role;
update public.profiles set phone='+54 9 11 2233 4455' where auth_user_id='c3140000-0000-4000-8000-000000000001';
update auth.users set email_confirmed_at=null where id='c3140000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.submit_service_quote('c3140000-0000-4000-8000-000000000002')$$,'P0001','customer_email_unverified','A complete profile still requires confirmed email');
reset role;
update auth.users set email_confirmed_at=now() where id='c3140000-0000-4000-8000-000000000001';
delete from public.customer_addresses where customer_id=(select cp.id from public.customer_profiles cp join public.profiles p on p.id=cp.profile_id where p.auth_user_id='c3140000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok($$select public.submit_service_quote('c3140000-0000-4000-8000-000000000002')$$,'P0001','customer_profile_incomplete','The quote address does not bypass missing onboarding address');
reset role;
insert into public.customer_addresses(customer_id,street,number,city,province,property_type)
select cp.id,'San Martín','932','Vicente López','Buenos Aires','office' from public.customer_profiles cp join public.profiles p on p.id=cp.profile_id where p.auth_user_id='c3140000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select public.submit_service_quote('c3140000-0000-4000-8000-000000000002')$$,'Complete verified customers may submit');
select is((public.submit_service_quote('c3140000-0000-4000-8000-000000000002')->>'duplicate')::boolean,true,'Accepted quote retries remain idempotent');
select is((select count(*) from public.jobs),1::bigint,'Exactly one job exists after successful submission');
reset role;
select * from finish();
rollback;
