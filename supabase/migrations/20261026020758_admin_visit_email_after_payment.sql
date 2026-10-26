begin;

-- Copy, do not rename: existing callers keep the original OIDs, whose bodies
-- are replaced below. Each delegate preserves the installed legacy/automatic
-- resolver, including the current-state email checks.
do $copies$
declare v_original text; v_copy text;
begin
  v_original := pg_get_functiondef('private.enqueue_visit_confirmation(uuid)'::regprocedure);
  v_copy := regexp_replace(v_original,
    '^CREATE OR REPLACE FUNCTION private[.]enqueue_visit_confirmation[(]',
    'CREATE FUNCTION private.enqueue_visit_confirmation_before_admin_payment(');
  if v_copy = v_original then
    raise exception 'unexpected_visit_confirmation_definition';
  end if;
  execute v_copy;

  v_original := pg_get_functiondef('private.outbox_recipient(private.outbox_events)'::regprocedure);
  v_copy := regexp_replace(v_original,
    '^CREATE OR REPLACE FUNCTION private[.]outbox_recipient[(]',
    'CREATE FUNCTION private.outbox_recipient_before_admin_payment(');
  if v_copy = v_original then
    raise exception 'unexpected_outbox_recipient_definition';
  end if;
  execute v_copy;
end;
$copies$;

create or replace function private.enqueue_visit_confirmation(p_job_id uuid) returns void
language plpgsql security definer set search_path='' as $function$
declare v_profile_id uuid; v_email text; v_schedule_version integer;
begin
  if not exists(select 1 from private.admin_service_requests where job_id=p_job_id) then
    perform private.enqueue_visit_confirmation_before_admin_payment(p_job_id);
    return;
  end if;

  select cp.profile_id,p.email::text,s.version
    into v_profile_id,v_email,v_schedule_version
    from private.admin_service_requests d
    join public.jobs j on j.id=d.job_id and j.request_id=d.request_id and j.customer_id=d.customer_id
    join public.customer_profiles cp on cp.id=j.customer_id
    join public.profiles p on p.id=cp.profile_id
    join public.job_schedule_reservations s on s.job_id=j.id and s.professional_id=j.professional_id
      and s.state='confirmed'
    where j.id=p_job_id and j.status='confirmed' and d.state='sent'
      and d.accepted_at is not null and d.accepted_professional_id=j.professional_id
      and s.starts_at>clock_timestamp() and p.email is not null
      and exists(select 1 from public.marketplace_checkouts c
        where c.job_id=j.id and c.extra_id is null and c.status='approved'
          and c.customer_id=j.customer_id and c.professional_id=j.professional_id)
    order by s.version desc limit 1;
  if not found then return; end if;

  -- A distinct namespace cannot collide with an old prematurely suppressed
  -- event. Retries and both ordering triggers still share one canonical key.
  insert into private.outbox_events(event_type,aggregate_type,aggregate_id,channel,
    recipient_profile_id,recipient_key,dedupe_key,payload)
  values('visit.confirmed','job',p_job_id,'email',v_profile_id,lower(v_email),
    'visit-confirmed-paid:'||p_job_id::text||':'||v_schedule_version::text,'{}'::jsonb)
  on conflict(channel,recipient_key,dedupe_key) do nothing;
end;
$function$;

create or replace function private.outbox_recipient(p_event private.outbox_events) returns jsonb
language plpgsql security definer set search_path='' as $function$
declare v_delegate private.outbox_events; v_schedule_version text;
begin
  if p_event.aggregate_type='job' and p_event.event_type='visit.confirmed'
    and exists(select 1 from private.admin_service_requests where job_id=p_event.aggregate_id) then
    if p_event.channel is distinct from 'email' or (p_event.dedupe_key
      ~ ('^visit-confirmed-paid:'||p_event.aggregate_id::text||':[1-9][0-9]*$')) is not true then
      raise exception using errcode='22023',message='recipient_unavailable';
    end if;
    v_schedule_version := split_part(p_event.dedupe_key,':',3);
    if not exists(
      select 1 from private.admin_service_requests d
      join public.jobs j on j.id=d.job_id and j.request_id=d.request_id and j.customer_id=d.customer_id
      join public.job_schedule_reservations s on s.job_id=j.id and s.professional_id=j.professional_id
        and s.state='confirmed'
      where j.id=p_event.aggregate_id and j.status='confirmed' and d.state='sent'
        and d.accepted_at is not null and d.accepted_professional_id=j.professional_id
        and s.version::text=v_schedule_version and s.starts_at>clock_timestamp()
        and exists(select 1 from public.marketplace_checkouts c
          where c.job_id=j.id and c.extra_id is null and c.status='approved'
            and c.customer_id=j.customer_id and c.professional_id=j.professional_id)
    ) then raise exception using errcode='22023',message='recipient_unavailable'; end if;

    -- The preserved resolver requires its legacy prefix. Translate only this
    -- local copy after validating the paid namespace and authoritative state.
    -- The stored event, its ID, snapshot and provider idempotency key stay intact.
    v_delegate := p_event;
    v_delegate.dedupe_key := 'visit-confirmed:'||p_event.aggregate_id::text||':'||v_schedule_version;
    return private.outbox_recipient_before_admin_payment(v_delegate);
  end if;
  return private.outbox_recipient_before_admin_payment(p_event);
end;
$function$;

create function private.enqueue_admin_visit_confirmation_from_checkout() returns trigger
language plpgsql security definer set search_path='' as $function$
begin
  if new.status='approved' and new.extra_id is null
    and (tg_op='INSERT' or new.status is distinct from old.status)
    and exists(select 1 from private.admin_service_requests where job_id=new.job_id) then
    perform private.enqueue_visit_confirmation(new.job_id);
  end if;
  return new;
end;
$function$;

create trigger admin_visit_confirmation_after_checkout
after insert or update of status on public.marketplace_checkouts
for each row execute function private.enqueue_admin_visit_confirmation_from_checkout();

create function private.enqueue_admin_visit_confirmation_from_acceptance() returns trigger
language plpgsql security definer set search_path='' as $function$
begin
  if new.accepted_at is not null and new.accepted_professional_id is not null and new.job_id is not null then
    perform private.enqueue_visit_confirmation(new.job_id);
  end if;
  return new;
end;
$function$;

create trigger admin_visit_confirmation_after_acceptance
after insert or update of accepted_at,accepted_professional_id on private.admin_service_requests
for each row execute function private.enqueue_admin_visit_confirmation_from_acceptance();

revoke all on function private.enqueue_visit_confirmation(uuid),
  private.enqueue_visit_confirmation_before_admin_payment(uuid),
  private.outbox_recipient(private.outbox_events),
  private.outbox_recipient_before_admin_payment(private.outbox_events),
  private.enqueue_admin_visit_confirmation_from_checkout(),
  private.enqueue_admin_visit_confirmation_from_acceptance()
  from public,anon,authenticated,service_role;

do $application_roles$
declare v_role text; v_function text;
begin
  for v_role in select rolname from pg_catalog.pg_roles where rolname like 'lysto\_%' escape '\'
  loop
    foreach v_function in array array[
      'private.enqueue_visit_confirmation(uuid)',
      'private.enqueue_visit_confirmation_before_admin_payment(uuid)',
      'private.outbox_recipient(private.outbox_events)',
      'private.outbox_recipient_before_admin_payment(private.outbox_events)',
      'private.enqueue_admin_visit_confirmation_from_checkout()',
      'private.enqueue_admin_visit_confirmation_from_acceptance()'
    ] loop
      execute pg_catalog.format('revoke all on function %s from %I', v_function, v_role);
    end loop;
  end loop;
end;
$application_roles$;

commit;
