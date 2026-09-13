insert into auth.users(id,email,raw_app_meta_data) select ('85000000-0000-0000-0000-00000000000'||n)::uuid,'split-'||n||'@test.local',jsonb_build_object('app_role',case when n=3 then 'professional' when n=4 then 'admin' else 'customer' end) from generate_series(1,4) n;
insert into public.profiles(id,auth_user_id,role,first_name,last_name,email) select id,id,(raw_app_meta_data->>'app_role')::public.user_role,'Pricing','Test',email from auth.users where email like 'split-%@test.local';
insert into public.customer_profiles(id,profile_id) select id,id from public.profiles where email in ('split-1@test.local','split-2@test.local');
insert into public.professional_profiles(id,profile_id,status) values('85000000-0000-0000-0000-000000000003','85000000-0000-0000-0000-000000000003','approved');
insert into public.service_categories(slug,name) values('aire_acondicionado','Aire acondicionado') on conflict(slug) do nothing;
insert into public.service_issue_types(category_id,slug,name) select id,'mantenimiento','Mantenimiento' from public.service_categories where slug='aire_acondicionado' on conflict(category_id,slug) do nothing;
insert into public.service_quotes(id,customer_id,address,input,quote,preferred_date,time_window,status,expires_at) values(
 '86000000-0000-0000-0000-000000000001','85000000-0000-0000-0000-000000000001',
 '{"street":"Corrientes","number":"1240","city":"CABA","province":"Buenos Aires"}',
 '{"issue":"mantenimiento","timeSince":"days","urgency":"flexible","propertyType":"apartment","access":{},"materialsConfirmed":true}',
 '{"total":130000,"calculatorSubtotal":100000,"safetyRate":0.3,"professionalAmount":106600,"platformFee":23400,"platformContribution":15600,"coverage":"covered","scope":"Mantenimiento","route":{"source":"manual","tollsVerified":true}}',
 current_date+1,'10:00 – 12:00','ready',now()+interval '30 minutes');

select set_config('request.jwt.claims','{"sub":"85000000-0000-0000-0000-000000000001","app_metadata":{"app_role":"customer"}}',true);
select public.submit_service_quote('86000000-0000-0000-0000-000000000001');
update public.jobs set professional_id='85000000-0000-0000-0000-000000000003',status='confirmed' where customer_id='85000000-0000-0000-0000-000000000001';
insert into public.mp_split_connected_accounts(seller_id,mercado_pago_user_id,encrypted_access_token,access_token_expires_at,created_at,updated_at)
values('85000000-0000-0000-0000-000000000003','456789','fixture-only-not-a-token',now()+interval '1 hour',now(),now());


