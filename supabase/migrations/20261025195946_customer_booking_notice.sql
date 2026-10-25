-- Owner-confirmed rule: three Monday-Friday days after submission, excluding
-- the submission day and without excluding national holidays.
create function private.minimum_customer_visit_date(p_requested_at timestamptz)
returns date language plpgsql immutable strict security invoker set search_path='' as $$
declare v_day date := (p_requested_at at time zone 'America/Argentina/Buenos_Aires')::date;
  v_count integer := 0;
begin
  while v_count < 3 loop
    v_day := v_day + 1;
    if extract(isodow from v_day) between 1 and 5 then v_count := v_count + 1; end if;
  end loop;
  return v_day;
end; $$;
revoke all on function private.minimum_customer_visit_date(timestamptz) from public,anon,authenticated,service_role;

create function private.assert_customer_booking_date(p_visit_date date,p_minimum_date date)
returns void language plpgsql immutable security invoker set search_path='' as $$
begin
  if p_minimum_date is not null and (p_visit_date is null or p_visit_date < p_minimum_date) then
    raise exception using errcode='22023',message='booking_notice_required';
  end if;
end; $$;
revoke all on function private.assert_customer_booking_date(date,date) from public,anon,authenticated,service_role;

-- NULL marks requests created before this rule; existing bookings are untouched.
-- The trusted insert time determines the deadline, never a client timestamp.
alter table public.service_requests add column booking_not_before date;
comment on column public.service_requests.booking_not_before is
  'Immutable earliest visit date: three weekdays after server submission day. NULL for requests predating this policy.';

create function private.guard_customer_booking_notice()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.booking_not_before := private.minimum_customer_visit_date(clock_timestamp());
  elsif new.booking_not_before is distinct from old.booking_not_before then
    raise exception using errcode='22023',message='booking_notice_immutable';
  end if;
  perform private.assert_customer_booking_date(new.preferred_date,new.booking_not_before);
  return new;
end; $$;
revoke all on function private.guard_customer_booking_notice() from public,anon,authenticated,service_role;
create trigger customer_booking_notice_guard before insert or update on public.service_requests
  for each row execute function private.guard_customer_booking_notice();

-- A later reservation/reschedule uses the original request deadline, rather
-- than restarting the three-day clock or allowing an earlier date as a bypass.
create function private.guard_customer_reservation_notice()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_minimum date;
begin
  select r.booking_not_before into v_minimum from public.jobs j
    join public.service_requests r on r.id=j.request_id where j.id=new.job_id;
  perform private.assert_customer_booking_date(
    (new.starts_at at time zone 'America/Argentina/Buenos_Aires')::date,v_minimum);
  return new;
end; $$;
revoke all on function private.guard_customer_reservation_notice() from public,anon,authenticated,service_role;
create trigger customer_reservation_notice_guard before insert or update of starts_at,job_id on public.job_schedule_reservations
  for each row execute function private.guard_customer_reservation_notice();

-- Recheck before routing and before committing an unconsumed preview. Retain
-- the existing actor, coverage, eligibility and payment checks and function ACL.
do $migration$
declare v_source text := pg_get_functiondef('private.read_customer_request_context(uuid,uuid,uuid,jsonb)'::regprocedure);
  v_anchor text := 'if v_quote.id is null or';
begin
  if (length(v_source)-length(replace(v_source,v_anchor,'')))/length(v_anchor) <> 1 then
    raise exception 'Unexpected customer request context definition';
  end if;
  execute replace(v_source,v_anchor,
    'if (p_input->>''preferredDate'')::date < private.minimum_customer_visit_date(clock_timestamp()) then v_reason:=''booking_notice_required'';' ||
    E'\n  elsif v_quote.id is null or');
end; $migration$;
