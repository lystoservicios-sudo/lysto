begin;

\ir ../fixtures/session.sql.inc

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(27);
select has_table('public', 'service_quotes', 'Immutable service quote snapshots exist');
select has_table('public', 'job_extras', 'Additional faults are stored separately');
select has_function('public', 'submit_service_quote', array['uuid'], 'Customer accepts a saved quote without sending an amount');
select has_function('public', 'propose_job_extra', array['uuid','text','text','numeric','uuid'], 'Professional proposes an additional fault');
select has_function('public', 'decide_job_extra', array['uuid','text'], 'Customer decides on the extra');
select has_function('public', 'review_service_quote', array['uuid','text'], 'Operations reviews a preliminary quote');
select has_function('public', 'get_quote_policy', array[]::text[], 'Calculator policy is versioned in the database');

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) select ('91000000-0000-0000-0000-00000000000'||n)::uuid,'pricing-'||n||'@test.local',now(),jsonb_build_object('app_role',case when n=3 then 'professional' when n=4 then 'admin' else 'customer' end) from generate_series(1,4) n;
insert into public.profiles(id,auth_user_id,role,first_name,last_name,email) select id,id,(raw_app_meta_data->>'app_role')::public.user_role,'Pricing','Test',email from auth.users where email like 'pricing-%@test.local';
insert into public.customer_profiles(id,profile_id) select id,id from public.profiles where email in ('pricing-1@test.local','pricing-2@test.local');
insert into public.professional_profiles(id,profile_id,status) values('91000000-0000-0000-0000-000000000003','91000000-0000-0000-0000-000000000003','approved');
insert into public.service_categories(slug,name) values('aire_acondicionado','Aire acondicionado') on conflict(slug) do nothing;
insert into public.service_issue_types(category_id,slug,name) select id,'mantenimiento','Mantenimiento' from public.service_categories where slug='aire_acondicionado' on conflict(category_id,slug) do nothing;
insert into public.service_quotes(id,customer_id,address,input,quote,preferred_date,time_window,status,expires_at) values(
 '92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001',
 '{"street":"Corrientes","number":"1240","city":"CABA","province":"Buenos Aires"}',
 '{"issue":"mantenimiento","timeSince":"days","urgency":"flexible","propertyType":"apartment","access":{},"materialsConfirmed":true}',
 '{"total":130000,"calculatorSubtotal":100000,"safetyRate":0.3,"professionalAmount":106600,"platformFee":23400,"platformContribution":15600,"coverage":"covered","scope":"Mantenimiento","route":{"source":"manual","tollsVerified":true}}',
 current_date+1,'10:00 – 12:00','ready',now()+interval '30 minutes');

select ok(not has_function_privilege('authenticated','public.create_service_request_from_app(uuid,uuid,text,text,text,date,text,public.urgency_level,jsonb,numeric,numeric,numeric)','execute'),'Legacy pricing cannot bypass the quote');
select ok(not has_table_privilege('authenticated','public.service_quotes','insert'),'Customer cannot forge quotes');
select ok(not has_table_privilege('authenticated','public.job_extras','update'),'Extra amounts cannot be rewritten directly');
set local role authenticated;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000002","app_metadata":{"app_role":"customer"}}',true);
select is((select count(*) from public.service_quotes),0::bigint,'Other customer cannot read quote');
select throws_ok($$select public.submit_service_quote('92000000-0000-0000-0000-000000000001')$$,'P0001','Quote unavailable','Other customer cannot accept quote');
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","app_metadata":{"app_role":"customer"}}',true);
select lives_ok($$select public.submit_service_quote('92000000-0000-0000-0000-000000000001')$$,'Owner accepts saved quote');
select is((public.submit_service_quote('92000000-0000-0000-0000-000000000001')->>'duplicate')::boolean,true,'Duplicate acceptance creates no second job');
select is((select count(*) from public.jobs where customer_id='91000000-0000-0000-0000-000000000001'),1::bigint,'Exactly one job was created');
select throws_ok($$update public.customer_addresses set city='Mar del Plata' where customer_id='91000000-0000-0000-0000-000000000001'$$,'P0001','Accepted quote address is immutable: request a new quote','Quoted address cannot change after acceptance');
reset role;
select throws_ok($$update public.service_quotes set quote=jsonb_set(quote,'{total}','1') where id='92000000-0000-0000-0000-000000000001'$$,'P0001','Quote snapshot is immutable','Accepted monetary snapshot cannot be overwritten even by a privileged writer');
select throws_ok($$update public.service_quotes set status='ready' where id='92000000-0000-0000-0000-000000000001'$$,'P0001','Quote snapshot is immutable','Accepted quote cannot return to editable decision state');
update public.jobs set professional_id='91000000-0000-0000-0000-000000000003',status='confirmed' where customer_id='91000000-0000-0000-0000-000000000001';
insert into public.marketplace_checkouts(job_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode,status)
select id,customer_id,'91000000-0000-0000-0000-000000000003','12345',130000,23400,false,'approved' from public.jobs where customer_id='91000000-0000-0000-0000-000000000001';
update public.jobs set professional_id='91000000-0000-0000-0000-000000000003',status='onsite_diagnosis' where customer_id='91000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000003","app_metadata":{"app_role":"professional"}}',true);
select throws_ok($$select public.advance_service_job((select id from public.jobs where customer_id='91000000-0000-0000-0000-000000000001'),'arrived')$$,'P0001','Job status changed: refresh before continuing','Repeated transition cannot advance another step');
select lives_ok($$select public.propose_job_extra((select id from public.jobs where customer_id='91000000-0000-0000-0000-000000000001'),'Otra falla detectada','Cambiar capacitor de unidad exterior',50000,'93000000-0000-0000-0000-000000000001')$$,'Assigned professional records additional fault');
select throws_ok($$select public.advance_service_job((select id from public.jobs where customer_id='91000000-0000-0000-0000-000000000001'),'onsite_diagnosis')$$,'P0001','Customer decision pending on additional work','Cannot start work with unresolved extra');
select is((select platform_fee from public.job_extras where idempotency_key='93000000-0000-0000-0000-000000000001'),0::numeric,'Additional fault commission is zero');
select is((select professional_amount from public.job_extras where idempotency_key='93000000-0000-0000-0000-000000000001'),50000::numeric,'Professional receives 100 percent of additional amount');
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","app_metadata":{"app_role":"customer"}}',true);
select lives_ok($$select public.decide_job_extra((select id from public.job_extras where idempotency_key='93000000-0000-0000-0000-000000000001'),'accepted')$$,'Customer accepts the additional scope');
select lives_ok($$select public.decide_job_extra((select id from public.job_extras where idempotency_key='93000000-0000-0000-0000-000000000001'),'accepted')$$,'Retrying customer acceptance is safe');
select is((select amount from public.price_options where request_id=(select request_id from public.service_quotes where id='92000000-0000-0000-0000-000000000001')),130000::numeric,'Initial service amount stays frozen');
select is((select count(*) from public.payments where customer_id='91000000-0000-0000-0000-000000000001'),0::bigint,'Quote and extra acceptance do not invent payments');
reset role;
select * from finish();
rollback;
