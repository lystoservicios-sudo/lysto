begin;
\ir ../fixtures/session.sql.inc
select no_plan();

select has_function('public','read_professional_job_context',array['uuid'],'Assigned context RPC exists');
select ok(not (select prosecdef from pg_proc where oid='public.read_professional_job_context(uuid)'::regprocedure),'Exposed wrapper is invoker');
select ok((select prosecdef from pg_proc where oid='private.read_professional_job_context(uuid)'::regprocedure),'Privileged reader stays private');
select ok(not has_function_privilege('anon','public.read_professional_job_context(uuid)','execute'),'Anonymous cannot read a job');
select ok(not has_function_privilege('service_role','public.read_professional_job_context(uuid)','execute'),'Service role cannot impersonate a technician');

insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data)
select ('97100000-0000-4000-8000-00000000000'||n)::uuid,'tech-context-'||n||'@lysto.test',now(),
  jsonb_build_object('app_role',case when n in(2,3) then 'professional' else 'customer' end) from generate_series(1,4) n;
insert into public.profiles(id,auth_user_id,role,first_name,last_name,email)
select id,id,(raw_app_meta_data->>'app_role')::public.user_role,'Context','Fixture',email
  from auth.users where email like 'tech-context-%@lysto.test';
insert into public.customer_profiles(id,profile_id) values
('97100000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000001'),
('97100000-0000-4000-8000-000000000004','97100000-0000-4000-8000-000000000004');
insert into public.professional_profiles(id,profile_id,status) values
('97100000-0000-4000-8000-000000000002','97100000-0000-4000-8000-000000000002','approved'),
('97100000-0000-4000-8000-000000000003','97100000-0000-4000-8000-000000000003','approved');
insert into public.customer_addresses(id,customer_id,street,number,city,province,property_type,reference) values
('97200000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000001','Historical street','1','CABA','Buenos Aires','house','OLD access'),
('97200000-0000-4000-8000-000000000002','97100000-0000-4000-8000-000000000001','Contracted street','2','CABA','Buenos Aires','house','Current mutable access'),
('97200000-0000-4000-8000-000000000003','97100000-0000-4000-8000-000000000001','Other private home','3','CABA','Buenos Aires','house',null);
insert into public.customer_equipment(id,customer_id,address_id,nickname,equipment_type,brand,frigorias,category_id) values
('97300000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000001','97200000-0000-4000-8000-000000000001','Assigned air','inverter','Fixture','3500',(select id from public.service_categories where slug='aire_acondicionado')),
('97300000-0000-4000-8000-000000000002','97100000-0000-4000-8000-000000000001','97200000-0000-4000-8000-000000000002','Unrelated air','split','Private fixture','4500',(select id from public.service_categories where slug='aire_acondicionado'));
insert into public.customer_homes(id,customer_id,current_address_id,name,kind,windows) values
('97400000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000001','97200000-0000-4000-8000-000000000002','Contracted home','house','small'),
('97400000-0000-4000-8000-000000000002','97100000-0000-4000-8000-000000000001','97200000-0000-4000-8000-000000000003','Unrelated home','house','small');
insert into public.customer_home_addresses(home_id,customer_id,address_id) values
('97400000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000001','97200000-0000-4000-8000-000000000001'),
('97400000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000001','97200000-0000-4000-8000-000000000002');
insert into public.customer_home_floors(id,home_id,customer_id,name,sort_order) values
('97500000-0000-4000-8000-000000000001','97400000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000001','Garden level',0);
insert into public.customer_home_rooms(id,home_id,floor_id,customer_id,name,kind,variant,x,z,width,depth,rotation,windows) values
('97600000-0000-4000-8000-000000000001','97400000-0000-4000-8000-000000000001','97500000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000001','Living','living','compact',0,0,4,4,0,'small');
insert into public.customer_equipment_placements(equipment_id,home_id,room_id,customer_id,wall,wall_offset,height)
select e.id,'97400000-0000-4000-8000-000000000001','97600000-0000-4000-8000-000000000001',e.customer_id,'north',0.5,2
from public.customer_equipment e where e.customer_id='97100000-0000-4000-8000-000000000001';
insert into public.service_requests(id,customer_id,category_id,issue_type_id,address_id,equipment_id,visit_address_id,visit_address_snapshot,context_snapshot,contract_source)
select '97700000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000001',c.id,i.id,
  '97200000-0000-4000-8000-000000000001','97300000-0000-4000-8000-000000000001','97200000-0000-4000-8000-000000000002',
  '{"reference":"Contracted access snapshot"}','{"home":{"id":"97400000-0000-4000-8000-000000000001"}}','automatic_customer_request'
from public.service_categories c join public.service_issue_types i on i.category_id=c.id where c.slug='aire_acondicionado' order by i.sort_order,i.id limit 1;
insert into public.service_requests(id,customer_id,category_id,issue_type_id,address_id)
select ('97700000-0000-4000-8000-00000000000'||n)::uuid,r.customer_id,r.category_id,r.issue_type_id,r.address_id
from public.service_requests r cross join generate_series(2,3) n where r.id='97700000-0000-4000-8000-000000000001';
insert into public.jobs(id,request_id,customer_id,professional_id)
select ('97800000-0000-4000-8000-00000000000'||n)::uuid,('97700000-0000-4000-8000-00000000000'||n)::uuid,
  '97100000-0000-4000-8000-000000000001',case when n=2 then '97100000-0000-4000-8000-000000000003'::uuid else '97100000-0000-4000-8000-000000000002'::uuid end
from generate_series(1,3) n;
insert into public.request_answers(request_id,question_code,answer_value) values
('97700000-0000-4000-8000-000000000001','customer_description','Drips while cooling');
insert into public.equipment_service_records(id,equipment_id,reported_problem,real_diagnosis,work_done,notes) values
('97900000-0000-4000-8000-000000000001','97300000-0000-4000-8000-000000000001','Old report','Cleaned drain','Drain maintenance','INTERNAL note must not leak'),
('97900000-0000-4000-8000-000000000002','97300000-0000-4000-8000-000000000002','Private report','Private diagnosis','Private work','Private note');

select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"97100000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"app_role":"professional"}}',true);
set local role authenticated;
select is(public.read_professional_job_context('97800000-0000-4000-8000-000000000001')->>'jobId','97800000-0000-4000-8000-000000000001','Assigned technician can read context at existing assurance level');
select is(public.read_professional_job_context('97800000-0000-4000-8000-000000000001')->>'reportedProblem','Drips while cooling','Includes actual report');
select is(public.read_professional_job_context('97800000-0000-4000-8000-000000000001')->>'accessInstructions','Contracted access snapshot','Access instructions use immutable contracted visit, not mutable or old address');
select is(public.read_professional_job_context('97800000-0000-4000-8000-000000000001')->'equipment'->>'addressId','97200000-0000-4000-8000-000000000001','Equipment retains historical identity');
select is(public.read_professional_job_context('97800000-0000-4000-8000-000000000001')->'home'->>'addressId','97200000-0000-4000-8000-000000000002','3D context uses contracted visit address');
select is(jsonb_array_length(public.read_professional_job_context('97800000-0000-4000-8000-000000000001')->'home'->'placements'),1,'No other equipment placements are exposed');
select is(jsonb_array_length(public.read_professional_job_context('97800000-0000-4000-8000-000000000001')->'history'),1,'History is limited to assigned equipment');
select ok(not (public.read_professional_job_context('97800000-0000-4000-8000-000000000001')->'history'->0 ? 'notes'),'Internal notes are excluded');
select is(public.read_professional_job_context('97800000-0000-4000-8000-000000000001')->>'initialPaymentStatus',null::text,'Missing canonical checkout never implies approved payment');
select is(public.read_professional_job_context('97800000-0000-4000-8000-000000000003')->'home','null'::jsonb,'Legacy job without configured home still loads');
select is(public.read_professional_job_context('97800000-0000-4000-8000-000000000003')->'equipment','null'::jsonb,'Legacy job does not invent equipment');
select is((select count(*) from public.customer_homes),0::bigint,'Direct owner-only home access is unchanged');
select throws_ok($$select public.read_professional_job_context('97800000-0000-4000-8000-000000000002')$$,'P0002','job_not_found','Different technician assignment is inaccessible');
select throws_ok($$select public.read_professional_job_context('ffffffff-ffff-4fff-8fff-ffffffffffff')$$,'P0002','job_not_found','Missing job is indistinguishable from a different assignment');
reset role;
insert into public.job_extras(id,job_id,professional_id,fault,description,amount,idempotency_key,status,decided_by,decided_at) values
('97a00000-0000-4000-8000-000000000001','97800000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000002',
  'Additional fixture fault','Additional fixture scope',1000,'97a00000-0000-4000-8000-000000000002','accepted','97100000-0000-4000-8000-000000000001',now());
insert into public.marketplace_checkouts(id,job_id,extra_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode,status) values
('97b00000-0000-4000-8000-000000000001','97800000-0000-4000-8000-000000000001',null,'97100000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000002','sql-fixture-only',10000,1800,false,'pending'),
('97b00000-0000-4000-8000-000000000002','97800000-0000-4000-8000-000000000001','97a00000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000001','97100000-0000-4000-8000-000000000002','sql-fixture-only',1000,0,false,'creating');
set local role authenticated;
select is(public.read_professional_job_context('97800000-0000-4000-8000-000000000001')->>'initialPaymentStatus','pending','Initial payment reflects canonical checkout without assumed approval');
select is(public.read_professional_job_context('97800000-0000-4000-8000-000000000001')->'extraPayments'->0->>'status','creating','Accepted scope is not treated as an approved extra payment');
reset role;
update public.professional_profiles set status='suspended' where id='97100000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.read_professional_job_context('97800000-0000-4000-8000-000000000001')$$,'42501','Current approved professional required','Suspension applies immediately with the same JWT');
reset role;
update public.professional_profiles set status='approved' where id='97100000-0000-4000-8000-000000000002';
update auth.users set banned_until=now()+interval '1 day' where id='97100000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.read_professional_job_context('97800000-0000-4000-8000-000000000001')$$,'42501','Current approved professional required','Current account ban overrides an otherwise valid issued JWT');
reset role;
update auth.users set banned_until=null where id='97100000-0000-4000-8000-000000000002';
update auth.sessions set not_after=now()-interval '1 minute' where id='97100000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.read_professional_job_context('97800000-0000-4000-8000-000000000001')$$,'42501','Current approved professional required','Expired database session cannot reuse its JWT');
reset role;
update auth.sessions set not_after=null where id='97100000-0000-4000-8000-000000000002';
delete from auth.sessions where id='97100000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.read_professional_job_context('97800000-0000-4000-8000-000000000001')$$,'42501','Current approved professional required','Revoked session cannot read context');
reset role;
select pg_temp.fixture_set_config('request.jwt.claims','{"sub":"97100000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"app_role":"customer"},"user_metadata":{"app_role":"professional"}}',true);
set local role authenticated;
select throws_ok($$select public.read_professional_job_context('97800000-0000-4000-8000-000000000001')$$,'42501','Current approved professional required','Editable metadata cannot acquire professional context access');
reset role;
select * from finish();
rollback;
