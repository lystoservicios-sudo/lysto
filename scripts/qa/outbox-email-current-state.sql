-- Read-only regression against existing obsolete emails, including retained
-- suppressed history after the queue is recovered. No claim, delivery,
-- event update or fixture write is performed. The canonical resolver only reads
-- account/resource data (with its existing shared locks).
begin;
do $regression$
declare
  v_event private.outbox_events%rowtype;
  v_in_app private.outbox_events%rowtype;
  v_checked integer := 0;
  v_accepted integer := 0;
begin
  for v_event in
    select e.* from private.outbox_events e
    join public.jobs j on j.id=e.aggregate_id and e.aggregate_type='job'
    where e.channel='email' and e.dead_lettered_at is null
      and e.event_type in ('job.assigned','job.completed_pending_customer_confirmation')
      and j.status='completed'
  loop
    v_checked := v_checked + 1;
    v_in_app := v_event;
    v_in_app.channel := 'in_app';
    perform private.outbox_recipient(v_in_app);
    begin
      perform private.outbox_recipient(v_event);
      v_accepted := v_accepted + 1;
    exception when sqlstate '22023' then
      null;
    end;
  end loop;
  if v_checked=0 then
    raise exception using errcode='55000',message='stale_email_regression_fixture_unavailable';
  end if;
  if v_accepted<>0 then
    raise exception using errcode='P0001',message='stale_job_email_was_accepted';
  end if;
end;
$regression$;
select 'OUTBOX_EMAIL_CURRENT_STATE_PASS' as result;
rollback;
