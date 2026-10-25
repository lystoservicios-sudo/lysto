-- Run in a transaction with the migration, then ROLLBACK. No customer data is
-- modified: trigger behavior is exercised against a temporary fixture table.
do $test$
declare v_case record;
begin
  for v_case in select * from (values
    ('2026-10-25T15:00:00Z'::timestamptz,'2026-10-28'::date),
    ('2026-10-26T15:00:00Z'::timestamptz,'2026-10-29'::date),
    ('2026-10-30T15:00:00Z'::timestamptz,'2026-11-04'::date),
    ('2026-10-31T15:00:00Z'::timestamptz,'2026-11-04'::date),
    ('2026-10-14T01:00:00Z'::timestamptz,'2026-10-16'::date),
    ('2026-12-31T20:00:00Z'::timestamptz,'2027-01-05'::date)
  ) x(requested,expected) loop
    if private.minimum_customer_visit_date(v_case.requested) <> v_case.expected then
      raise exception 'Incorrect business-day calculation for %',v_case.requested;
    end if;
  end loop;
  perform private.assert_customer_booking_date('2026-10-28','2026-10-28');
  perform private.assert_customer_booking_date('2026-10-31','2026-10-28');
  perform private.assert_customer_booking_date('2026-10-26',null);
  begin
    perform private.assert_customer_booking_date('2026-10-27','2026-10-28');
    raise exception 'Accepted visit before its original deadline';
  exception when sqlstate '22023' then
    if sqlerrm <> 'booking_notice_required' then raise; end if;
  end;
end; $test$;

create temporary table booking_notice_fixture(id integer primary key,preferred_date date,booking_not_before date) on commit drop;
insert into booking_notice_fixture values(1,current_date,null);
create trigger booking_notice_fixture_guard before insert or update on booking_notice_fixture
  for each row execute function private.guard_customer_booking_notice();

do $test$
declare v_minimum date := private.minimum_customer_visit_date(clock_timestamp());
begin
  -- Existing rows remain exempt when unrelated fields are updated.
  update booking_notice_fixture set id=10 where id=1;
  -- A caller cannot lower the deadline supplied at insertion.
  begin
    insert into booking_notice_fixture values(2,v_minimum-1,v_minimum-10);
    raise exception 'Accepted too-early new request';
  exception when sqlstate '22023' then
    if sqlerrm <> 'booking_notice_required' then raise; end if;
  end;
  insert into booking_notice_fixture values(3,v_minimum,v_minimum-10);
  if (select booking_not_before from booking_notice_fixture where id=3) <> v_minimum then
    raise exception 'Did not use server timestamp';
  end if;
  begin
    update booking_notice_fixture set booking_not_before=null where id=3;
    raise exception 'Allowed deadline removal';
  exception when sqlstate '22023' then
    if sqlerrm <> 'booking_notice_immutable' then raise; end if;
  end;
  begin
    update booking_notice_fixture set preferred_date=v_minimum-1 where id=3;
    raise exception 'Allowed earlier date';
  exception when sqlstate '22023' then
    if sqlerrm <> 'booking_notice_required' then raise; end if;
  end;
  update booking_notice_fixture set preferred_date=v_minimum+1 where id=3;
  if position('booking_notice_required' in pg_get_functiondef('private.read_customer_request_context(uuid,uuid,uuid,jsonb)'::regprocedure))=0 then
    raise exception 'Request context lacks notice validation';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.service_requests'::regclass and tgname='customer_booking_notice_guard' and tgenabled='O')
    or not exists(select 1 from pg_trigger where tgrelid='public.job_schedule_reservations'::regclass and tgname='customer_reservation_notice_guard' and tgenabled='O') then
    raise exception 'Persistence guard not installed';
  end if;
  if has_function_privilege('authenticated','private.guard_customer_booking_notice()','execute')
    or has_function_privilege('service_role','private.guard_customer_reservation_notice()','execute') then
    raise exception 'Unexpected trigger function access';
  end if;
  if exists(select 1 from pg_class where oid in('public.service_requests'::regclass,'public.job_schedule_reservations'::regclass) and not relrowsecurity) then
    raise exception 'RLS must remain enabled';
  end if;
end; $test$;
select 'customer_booking_notice_verified' as verification;
