-- Focused resolver regression on the isolated restored PostgreSQL fixture.
-- This is not a workflow/E2E test: job/schedule triggers are disabled only to
-- place the restored fixtures in each required state. Everything is rolled back.
begin;
do $target$
begin
  if inet_server_addr() is distinct from '127.0.0.1'::inet
    or inet_server_port() is distinct from 56497
    or exists(select 1 from pg_extension where extname in ('http','pg_net')) then
    raise exception using errcode='55000',message='email_matrix_target_not_isolated';
  end if;
end;
$target$;

alter table public.jobs disable trigger user;
alter table public.job_schedule_reservations disable trigger user;
do $matrix$
declare
  v_event private.outbox_events%rowtype;
  v_visit private.outbox_events%rowtype;
  v_receipt private.outbox_events%rowtype;
  v_case record;
  v_job_original public.job_status;
  v_visit_original public.job_status;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_reservation_id uuid;
  v_test_starts_at timestamptz;
  v_rejected boolean;
  v_checks integer := 0;
  v_receipts integer := 0;
begin
  select e.* into v_event from private.outbox_events e
    join public.jobs j on j.id=e.aggregate_id and e.aggregate_type='job'
    where e.channel='email' and e.event_type='job.assigned'
      and j.status='completed'
    order by e.created_at limit 1;
  if not found then
    raise exception using errcode='55000',message='email_matrix_job_fixture_unavailable';
  end if;
  select status into v_job_original from public.jobs where id=v_event.aggregate_id;
  for v_case in select * from (values
    ('job.assigned','pending_professional_acceptance'),
    ('job.confirmed','confirmed'),
    ('job.technician_on_way','technician_on_way'),
    ('job.arrived','arrived'),
    ('job.completed_pending_customer_confirmation','completed_pending_customer_confirmation'),
    ('job.completed','completed')
  ) as cases(event_type,expected_status)
  loop
    v_event.event_type := v_case.event_type;
    v_event.channel := 'email';
    update public.jobs set status=v_case.expected_status::public.job_status where id=v_event.aggregate_id;
    perform private.outbox_recipient(v_event);
    v_checks := v_checks+1;

    update public.jobs set status=(case when v_case.expected_status='completed'
      then 'pending_professional_acceptance' else 'completed' end)::public.job_status
      where id=v_event.aggregate_id;
    v_rejected := false;
    begin
      perform private.outbox_recipient(v_event);
    exception when sqlstate '22023' then
      v_rejected := true;
    end;
    if not v_rejected then
      raise exception using errcode='P0001',message='stale_job_email_was_accepted';
    end if;
    v_checks := v_checks+1;

    v_event.channel := 'in_app';
    perform private.outbox_recipient(v_event);
    v_checks := v_checks+1;
  end loop;
  update public.jobs set status=v_job_original where id=v_event.aggregate_id;

  select e.* into v_visit from private.outbox_events e
    where e.channel='email' and e.event_type='visit.confirmed'
    order by e.created_at limit 1;
  if not found then
    raise exception using errcode='55000',message='email_matrix_visit_fixture_unavailable';
  end if;
  select status into v_visit_original from public.jobs where id=v_visit.aggregate_id;
  select id,starts_at,ends_at into v_reservation_id,v_starts_at,v_ends_at
    from public.job_schedule_reservations
    where job_id=v_visit.aggregate_id and state='confirmed'
      and version::text=split_part(v_visit.dedupe_key,':',3);
  if not found then
    raise exception using errcode='55000',message='email_matrix_schedule_fixture_unavailable';
  end if;
  update public.jobs set status='confirmed' where id=v_visit.aggregate_id;
  v_test_starts_at := date_trunc('day',clock_timestamp())+interval '365 days 14 hours';
  update public.job_schedule_reservations
    set starts_at=v_test_starts_at,
      ends_at=v_test_starts_at+duration_minutes*interval '1 minute'
    where id=v_reservation_id;
  perform private.outbox_recipient(v_visit);
  v_checks := v_checks+1;

  v_test_starts_at := date_trunc('day',clock_timestamp())-interval '2 days'+interval '14 hours';
  update public.job_schedule_reservations
    set starts_at=v_test_starts_at,
      ends_at=v_test_starts_at+duration_minutes*interval '1 minute'
    where id=v_reservation_id;
  v_rejected := false;
  begin
    perform private.outbox_recipient(v_visit);
  exception when sqlstate '22023' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception using errcode='P0001',message='past_visit_email_was_accepted';
  end if;
  v_checks := v_checks+1;
  update public.job_schedule_reservations set starts_at=v_starts_at,ends_at=v_ends_at where id=v_reservation_id;
  update public.jobs set status=v_visit_original where id=v_visit.aggregate_id;

  for v_receipt in select e.* from private.outbox_events e
    where e.channel='email' and e.processed_at is null and e.dead_lettered_at is null
      and e.event_type in ('request.created','payment.approved','review.requested')
  loop
    perform private.outbox_recipient(v_receipt);
    v_receipts := v_receipts+1;
    v_checks := v_checks+1;
  end loop;
  if v_receipts<>6 or v_checks<>26 then
    raise exception using errcode='55000',message='email_matrix_receipt_fixture_incomplete';
  end if;
  raise notice 'OUTBOX_EMAIL_CURRENT_STATE_MATRIX_PASS checks=%',v_checks;
end;
$matrix$;
rollback;
