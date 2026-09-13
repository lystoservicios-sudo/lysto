begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(17);

select has_function('private','enqueue_visit_confirmation',array['uuid'],'visit confirmation enqueue helper exists');
select has_function('private','enqueue_review_request',array[]::text[],'review reminder trigger function exists');
select has_trigger('public','jobs','job_visit_confirmation','job confirmation evaluates visit delivery');
select has_trigger('public','job_schedule_reservations','schedule_visit_confirmation','schedule confirmation evaluates visit delivery');
select has_trigger('public','job_customer_decisions','customer_review_request','customer conformity schedules review request');
select ok(not has_function_privilege('authenticated','private.enqueue_visit_confirmation(uuid)','execute'),'authenticated cannot enqueue visit email directly');
select ok(not has_function_privilege('service_role','private.enqueue_visit_confirmation(uuid)','execute'),'service role cannot bypass visit eligibility helper');
select has_function('public','get_job_visit',array['uuid'],'authenticated visit projection exists');
select ok(has_function_privilege('authenticated','public.get_job_visit(uuid)','execute'),'authenticated participants can read the visit projection');
select ok(not has_function_privilege('anon','public.get_job_visit(uuid)','execute'),'anonymous callers cannot read a visit projection');

do $$
declare
  v_category uuid;
  v_issue uuid;
begin
  select id into v_category from public.service_categories where slug='aire_acondicionado';
  select id into v_issue from public.service_issue_types where category_id=v_category order by sort_order,id limit 1;
  insert into public.profiles(id,role,first_name,last_name,email) values
    ('75000000-0000-4000-8000-000000000001','customer','Cliente','Prueba','visit-customer@lysto.test'),
    ('75000000-0000-4000-8000-000000000002','professional','Martín','Técnico','visit-professional@lysto.test');
  insert into public.customer_profiles(id,profile_id) values
    ('75100000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001');
  insert into public.professional_profiles(id,profile_id,status) values
    ('75200000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000002','approved');
  insert into public.customer_addresses(id,customer_id,street,number,city,province) values
    ('75300000-0000-4000-8000-000000000001','75100000-0000-4000-8000-000000000001','Av. Siempre Viva','742','Buenos Aires','Buenos Aires');
  insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,address_id) values
    ('75400000-0000-4000-8000-000000000001','75100000-0000-4000-8000-000000000001',v_category,v_issue,'pending_professional_acceptance','75300000-0000-4000-8000-000000000001');
  insert into public.jobs(id,request_id,customer_id,professional_id,status) values
    ('75500000-0000-4000-8000-000000000001','75400000-0000-4000-8000-000000000001','75100000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001','pending_professional_acceptance');
  insert into public.job_schedule_reservations(id,job_id,professional_id,version,starts_at,ends_at,local_visit_date,timezone,duration_minutes,travel_buffer_minutes,state,created_by)
    values('75600000-0000-4000-8000-000000000001','75500000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001',1,
      '2030-09-18 13:00:00+00','2030-09-18 15:00:00+00','2030-09-18','America/Argentina/Buenos_Aires',120,30,'confirmed','75000000-0000-4000-8000-000000000002');
end $$;

select is((select count(*)::integer from private.outbox_events where aggregate_id='75500000-0000-4000-8000-000000000001' and event_type='visit.confirmed'),0,'schedule alone does not confirm a visit');

update public.jobs set status='confirmed' where id='75500000-0000-4000-8000-000000000001';
select is((select count(*)::integer from private.outbox_events where aggregate_id='75500000-0000-4000-8000-000000000001' and event_type='visit.confirmed'),1,'second satisfied condition enqueues one visit confirmation');

update public.jobs set status='confirmed' where id='75500000-0000-4000-8000-000000000001';
select is((select count(*)::integer from private.outbox_events where aggregate_id='75500000-0000-4000-8000-000000000001' and event_type='visit.confirmed'),1,'replayed status cannot duplicate a visit confirmation');

update public.job_schedule_reservations set state='released',released_at=clock_timestamp(),released_reason='customer approved change' where job_id='75500000-0000-4000-8000-000000000001' and version=1;
update public.jobs set schedule_version=2 where id='75500000-0000-4000-8000-000000000001';
insert into public.job_schedule_reservations(id,job_id,professional_id,version,starts_at,ends_at,local_visit_date,timezone,duration_minutes,travel_buffer_minutes,state,created_by)
values('75600000-0000-4000-8000-000000000002','75500000-0000-4000-8000-000000000001','75200000-0000-4000-8000-000000000001',2,
  '2030-09-19 15:00:00+00','2030-09-19 17:00:00+00','2030-09-19','America/Argentina/Buenos_Aires',120,30,'confirmed','75000000-0000-4000-8000-000000000002');
select is((select count(*)::integer from private.outbox_events where aggregate_id='75500000-0000-4000-8000-000000000001' and event_type='visit.confirmed'),2,'a new confirmed schedule version creates one new confirmation');

update public.jobs set status='completed' where id='75500000-0000-4000-8000-000000000001';
insert into public.job_customer_decisions(id,job_id,customer_id,decision,idempotency_key,created_by)
values('75700000-0000-4000-8000-000000000001','75500000-0000-4000-8000-000000000001','75100000-0000-4000-8000-000000000001','confirmed','75800000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001');
select is((select count(*)::integer from private.outbox_events where aggregate_id='75500000-0000-4000-8000-000000000001' and event_type='review.requested'),1,'customer conformity creates one review request');
select ok((select available_at between clock_timestamp()+interval '119 minutes' and clock_timestamp()+interval '121 minutes' from private.outbox_events where aggregate_id='75500000-0000-4000-8000-000000000001' and event_type='review.requested'),'review request is due two hours later');

select is((select count(*)::integer from public.claim_outbox_events('visit-review-test',5,120,array['email']) where event_type='review.requested'),0,'review request cannot be claimed before its due time');

select * from finish();
rollback;
