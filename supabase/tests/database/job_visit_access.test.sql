begin;
\ir ../fixtures/session.sql.inc
select no_plan();

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
select ('76000000-0000-4000-8000-00000000000'||n)::uuid,'visit-guard-'||n||'@lysto.test',now(),jsonb_build_object('app_role',case when n=2 then 'professional' when n=3 then 'admin' else 'customer' end)
from generate_series(1,6) n;
insert into public.profiles(id,auth_user_id,role,first_name,last_name,email)
select id,id,(raw_app_meta_data->>'app_role')::public.user_role,'Visit','Guard',email from auth.users
where email like 'visit-guard-%@lysto.test' and id<>'76000000-0000-4000-8000-000000000005';
insert into public.customer_profiles(id,profile_id) values
('76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001'),
('76000000-0000-4000-8000-000000000004','76000000-0000-4000-8000-000000000004');
insert into public.professional_profiles(id,profile_id,status) values
('76000000-0000-4000-8000-000000000002','76000000-0000-4000-8000-000000000002','approved');
insert into public.admin_profiles(id,profile_id) values
('76000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000003');
insert into private.admin_profile_permissions(admin_profile_id,permission) values
('76000000-0000-4000-8000-000000000003','operations');
insert into public.customer_addresses(id,customer_id,street,number,city,province,property_type) values
('76100000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','Dirección de ensayo','123','CABA','Buenos Aires','house');
insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,address_id)
select '76200000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001',c.id,i.id,'pending_professional_acceptance','76100000-0000-4000-8000-000000000001'
from public.service_categories c join public.service_issue_types i on i.category_id=c.id
where c.slug='aire_acondicionado' order by i.sort_order,i.id limit 1;
insert into public.jobs(id,request_id,customer_id,professional_id,status) values
('76300000-0000-4000-8000-000000000001','76200000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002','pending_professional_acceptance');
insert into public.job_schedule_reservations(id,job_id,professional_id,version,starts_at,ends_at,local_visit_date,timezone,duration_minutes,travel_buffer_minutes,state,created_by) values
('76400000-0000-4000-8000-000000000001','76300000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000002',1,'2031-09-18 13:00:00+00','2031-09-18 15:00:00+00','2031-09-18','America/Argentina/Buenos_Aires',120,30,'confirmed','76000000-0000-4000-8000-000000000002');
update public.jobs set status='confirmed' where id='76300000-0000-4000-8000-000000000001';

select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"76000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select is(public.get_job_visit('76300000-0000-4000-8000-000000000001')->>'addressLabel','Dirección de ensayo 123, CABA','Current customer can read their confirmed visit');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"76000000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"app_role":"professional"}}',true);
set local role authenticated;
select is(public.get_job_visit('76300000-0000-4000-8000-000000000001')->>'confirmed','true','Assigned professional retains visit access');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"76000000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"app_role":"admin"}}',true);
set local role authenticated;
select is(public.get_job_visit('76300000-0000-4000-8000-000000000001')->>'scheduleVersion','1','Operations with current MFA retains visit access');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"76000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","app_metadata":{"app_role":"admin"}}',true);
set local role authenticated;
select throws_ok($$select public.get_job_visit('76300000-0000-4000-8000-000000000001')$$,'P0002','job_not_found','AAL1 administrator cannot use a NULL profile to bypass MFA');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"76000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select throws_ok($$select public.get_job_visit('76300000-0000-4000-8000-000000000001')$$,'P0002','job_not_found','Another customer cannot read the visit');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"76000000-0000-4000-8000-000000000005","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select throws_ok($$select public.get_job_visit('76300000-0000-4000-8000-000000000001')$$,'P0002','job_not_found','Authenticated identity without a domain profile is rejected');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"76000000-0000-4000-8000-000000000006","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
set local role authenticated;
select throws_ok($$select public.get_job_visit('76300000-0000-4000-8000-000000000001')$$,'P0002','job_not_found','Profile without a customer entity cannot authorize through NULL');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"76000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"app_role":"customer"}}',true);
delete from auth.sessions where id='76000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.get_job_visit('76300000-0000-4000-8000-000000000001')$$,'P0002','job_not_found','Revoked customer session cannot read a visit using an old JWT');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$select public.get_job_visit('76300000-0000-4000-8000-000000000001')$$,'P0002','job_not_found','Missing identity is rejected');
reset role;
select ok(not has_function_privilege('anon','public.get_job_visit(uuid)','execute'),'Anonymous execution remains revoked');
select * from finish();
rollback;
