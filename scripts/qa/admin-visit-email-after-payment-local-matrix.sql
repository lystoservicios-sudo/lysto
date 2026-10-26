-- LOCAL ONLY: transactional regression for administrative visit email eligibility.
-- Never execute on a hosted database. Target is the isolated PostgreSQL17 restore
-- at 127.0.0.1:56497, database lysto_restore_drill, with no network extensions.
-- Requires migrations 101 (20261026005743), 103 (20261026011519), and 104
-- (20261026020758) on top of the 99-migration restored fixture. In the private
-- harness, apply those three migration bodies in one transaction, strip only
-- this file's outer BEGIN, then let its final ROLLBACK undo DDL and fixtures.
-- Do NOT load scheduler migrations 100/102 or start Auth/Storage/mail workers.
-- Fixtures are selected from restored rows. No provider call, token, payload,
-- recipient address, or personal identifier is emitted. Financial/job triggers
-- are disabled only for fixture setup; the new checkout/acceptance hooks remain
-- active, so both event orders and paid-event idempotency are exercised.
-- This tests the SQL resolver/producers, not a complete user/payment workflow.
begin;
do $local_target$
begin
  if inet_server_addr() is distinct from '127.0.0.1'::inet
    or inet_server_port() is distinct from 56497
    or current_database()<>'lysto_restore_drill'
    or exists(select 1 from pg_extension where extname in('pg_cron','http','pg_net','dblink')) then
    raise exception using errcode='55000',message='TEST_LOCAL_ISOLATION_REQUIRED';
  end if;
  if to_regprocedure('private.outbox_recipient_before_admin_payment(private.outbox_events)') is null
    or to_regprocedure('private.enqueue_visit_confirmation_before_admin_payment(uuid)') is null
    or position('visit-confirmed-paid:' in pg_get_functiondef('private.enqueue_visit_confirmation(uuid)'::regprocedure))=0 then
    raise exception using errcode='55000',message='TEST_MIGRATIONS_101_103_104_REQUIRED';
  end if;
end;
$local_target$;

alter table public.jobs disable trigger user;
alter table public.job_schedule_reservations disable trigger user;
alter table public.marketplace_checkouts disable trigger user;
alter table public.service_quotes disable trigger user;
do $isolated_hooks$ begin
  if exists(select 1 from pg_trigger where tgrelid='public.marketplace_checkouts'::regclass and tgname='admin_visit_confirmation_after_checkout') then
    alter table public.marketplace_checkouts enable trigger admin_visit_confirmation_after_checkout;
  end if;
end;$isolated_hooks$;
do $test$
declare e private.outbox_events%rowtype; j public.jobs%rowtype; q public.service_quotes%rowtype;
  actor uuid; admin_id uuid:=gen_random_uuid(); starts timestamptz;
  pre_rejected boolean:=false; post_allowed boolean:=false; queued_pre integer; queued_post integer; queued_after_delivery integer;
  delivered_id uuid;source_definition text;legacy_id uuid;legacy_key text;legacy_preserved boolean:=false;inverse_renderable boolean:=false;paid_nonadmin_rejected boolean:=false;legacy_nonadmin_allowed boolean:=false;next_version integer;inverse_before integer;inverse_after integer;inverse_after_reenqueue integer;
begin
  source_definition:=pg_get_functiondef('private.save_admin_service_request(jsonb)'::regprocedure);
  if position('administrative_direct_assignment' in source_definition)=0 or position('create_assignment_offer' in source_definition)>0 then
    raise exception 'TEST_DIRECT_ASSIGNMENT_FIXTURE_MISSING';
  end if;
  select x.* into e from private.outbox_events x where x.channel='email' and x.event_type='visit.confirmed' order by created_at limit 1;
  if not found then raise exception 'TEST_VISIT_FIXTURE_MISSING';end if;legacy_id:=e.id;legacy_key:=e.dedupe_key;
  select * into j from public.jobs where id=e.aggregate_id;
  select * into q from public.service_quotes where customer_id=j.customer_id order by (request_id=j.request_id) desc nulls last,created_at limit 1;
  if not found then raise exception 'TEST_QUOTE_FIXTURE_MISSING';end if;
  select id into actor from public.profiles where role='admin' order by id limit 1;
  starts:=date_trunc('day',clock_timestamp())+interval '365 days 14 hours';
  update public.jobs set status='confirmed' where id=j.id;
  update public.job_schedule_reservations set starts_at=starts,ends_at=starts+duration_minutes*interval '1 minute'
    where job_id=j.id and state='confirmed' and version::text=split_part(e.dedupe_key,':',3);
  if not found then raise exception 'TEST_RESERVATION_FIXTURE_MISSING';end if;
  update public.service_quotes set status='needs_review',request_id=null,accepted_at=null,quote_origin='admin',quote=quote||jsonb_build_object('manualPricing',true) where id=q.id;
  update public.marketplace_checkouts set status='pending' where job_id=j.id and extra_id is null;
  insert into private.admin_service_requests(id,customer_id,created_by,input,state,quote_id,request_id,job_id)
    values(admin_id,j.customer_id,actor,jsonb_build_object('serviceTitle','Isolated regression','startsAt',starts),
      'sent',q.id,j.request_id,j.id);
  update private.outbox_events set processed_at=null,dead_lettered_at=null,delivery_outcome=null,
    provider_message_id=null,attempt_count=0,last_error=null,locked_at=null,locked_until=null,locked_by=null,claim_token=null
    where id=e.id returning * into e;
  begin perform private.outbox_recipient(e); exception when sqlstate '22023' then pre_rejected:=true;end;
  perform private.enqueue_visit_confirmation(j.id);
  select count(*) into queued_pre from private.outbox_events where aggregate_id=j.id and event_type='visit.confirmed'
    and channel='email' and dedupe_key like 'visit-confirmed-paid:%' and processed_at is null and dead_lettered_at is null;
  raise notice 'TEST_ADMIN_PRECONSENT_UNPAID_REJECTED=%',pre_rejected;
  raise notice 'TEST_ADMIN_PRECONSENT_UNPAID_QUEUED=%',queued_pre;
  -- Represent a premature announcement already terminally suppressed by the worker.
  update private.outbox_events set processed_at=clock_timestamp(),dead_lettered_at=null,delivery_outcome='suppressed',
    provider_message_id=null,attempt_count=1,last_error=null,locked_at=null,locked_until=null,locked_by=null,claim_token=null
    where aggregate_id=j.id and event_type='visit.confirmed' and channel='email';
  update private.admin_service_requests set accepted_at=clock_timestamp(),accepted_professional_id=j.professional_id where id=admin_id;
  update public.service_quotes set status='accepted',request_id=j.request_id,accepted_at=clock_timestamp() where id=q.id;
  update public.marketplace_checkouts set status='approved' where job_id=j.id and extra_id is null;
  perform private.enqueue_visit_confirmation(j.id);
  perform private.enqueue_visit_confirmation(j.id);
  select count(*) into queued_post from private.outbox_events where aggregate_id=j.id and event_type='visit.confirmed'
    and channel='email' and processed_at is null and dead_lettered_at is null;
  select * into e from private.outbox_events where aggregate_id=j.id and event_type='visit.confirmed' and channel='email'
    order by (processed_at is null) desc,created_at desc limit 1;
  begin perform private.outbox_recipient(e);post_allowed:=true;exception when sqlstate '22023' then null;end;
  raise notice 'TEST_ADMIN_POSTCONSENT_PAID_ALLOWED=%',post_allowed;
  raise notice 'TEST_ADMIN_POSTCONSENT_PAID_QUEUED=%',queued_post;
  select id into delivered_id from private.outbox_events where aggregate_id=j.id and event_type='visit.confirmed'
    and channel='email' and processed_at is null and dead_lettered_at is null order by created_at limit 1;
  if delivered_id is not null then
    update private.outbox_events set processed_at=clock_timestamp(),delivery_outcome='provider_accepted',
      provider_message_id='local_regression_no_provider',attempt_count=1,last_error=null where id=delivered_id;
    perform private.enqueue_visit_confirmation(j.id);
    select count(*) into queued_after_delivery from private.outbox_events where aggregate_id=j.id and event_type='visit.confirmed'
      and channel='email' and processed_at is null and dead_lettered_at is null;
    raise notice 'TEST_ADMIN_AFTER_DELIVERY_QUEUED=%',queued_after_delivery;
  else queued_after_delivery:=-1;end if;

  -- A second schedule version exercises payment-before-customer-consent.
  update private.admin_service_requests set accepted_at=null,accepted_professional_id=null where id=admin_id;
  select max(version)+1 into next_version from public.job_schedule_reservations where job_id=j.id;
  update public.job_schedule_reservations set version=next_version where job_id=j.id and state='confirmed';
  update public.jobs set schedule_version=next_version where id=j.id;
  update public.marketplace_checkouts set status='pending' where job_id=j.id and extra_id is null;
  update public.marketplace_checkouts set status='approved' where job_id=j.id and extra_id is null;
  select count(*) into inverse_before from private.outbox_events where aggregate_id=j.id and event_type='visit.confirmed'
    and channel='email' and split_part(dedupe_key,':',3)=next_version::text and processed_at is null and dead_lettered_at is null;
  update private.admin_service_requests set accepted_at=clock_timestamp(),accepted_professional_id=j.professional_id where id=admin_id;
  select count(*) into inverse_after from private.outbox_events where aggregate_id=j.id and event_type='visit.confirmed'
    and channel='email' and dedupe_key='visit-confirmed-paid:'||j.id::text||':'||next_version::text
    and processed_at is null and dead_lettered_at is null;
  perform private.enqueue_visit_confirmation(j.id);perform private.enqueue_visit_confirmation(j.id);
  select count(*) into inverse_after_reenqueue from private.outbox_events where aggregate_id=j.id and event_type='visit.confirmed'
    and channel='email' and dedupe_key='visit-confirmed-paid:'||j.id::text||':'||next_version::text
    and processed_at is null and dead_lettered_at is null;
  raise notice 'TEST_ADMIN_INVERSE_BEFORE_ACCEPTANCE_QUEUED=%',inverse_before;
  raise notice 'TEST_ADMIN_INVERSE_AFTER_ACCEPTANCE_QUEUED=%',inverse_after;
  raise notice 'TEST_ADMIN_INVERSE_AFTER_REENQUEUE_QUEUED=%',inverse_after_reenqueue;

  legacy_preserved:=exists(select 1 from private.outbox_events where id=legacy_id and dedupe_key=legacy_key and processed_at is not null and delivery_outcome='suppressed');
  select * into e from private.outbox_events where aggregate_id=j.id and event_type='visit.confirmed' and channel='email'
    and dedupe_key='visit-confirmed-paid:'||j.id::text||':'||next_version::text;
  if found then begin perform private.outbox_recipient(e);inverse_renderable:=true;exception when sqlstate '22023' then null;end;end if;
  -- Remove only the inserted administrative fixture to verify legacy delegation.
  delete from private.admin_service_requests where id=admin_id;
  begin perform private.outbox_recipient(e);exception when sqlstate '22023' then paid_nonadmin_rejected:=true;end;
  perform private.enqueue_visit_confirmation(j.id);
  select * into e from private.outbox_events where aggregate_id=j.id and event_type='visit.confirmed' and channel='email'
    and dedupe_key='visit-confirmed:'||j.id::text||':'||next_version::text;
  if found then begin perform private.outbox_recipient(e);legacy_nonadmin_allowed:=true;exception when sqlstate '22023' then null;end;end if;
  raise notice 'TEST_ADMIN_LEGACY_SUPPRESSION_PRESERVED=%',legacy_preserved;
  raise notice 'TEST_ADMIN_INVERSE_PAID_RENDERABLE=%',inverse_renderable;
  raise notice 'TEST_PAID_NAMESPACE_NONADMIN_REJECTED=%',paid_nonadmin_rejected;
  raise notice 'TEST_LEGACY_NONADMIN_ALLOWED=%',legacy_nonadmin_allowed;
  if not legacy_preserved or not inverse_renderable or not paid_nonadmin_rejected or not legacy_nonadmin_allowed or not pre_rejected or queued_pre<>0 or not post_allowed or queued_post<>1 or queued_after_delivery<>0 or inverse_before<>0 or inverse_after<>1 or inverse_after_reenqueue<>1 then
    raise exception using errcode='P0001',message='TEST_ADMIN_VISIT_GUARD_RED';
  end if;
  raise notice 'TEST_ADMIN_VISIT_GUARD_PASS';
end;
$test$;
rollback;
