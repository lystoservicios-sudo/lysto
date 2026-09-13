-- Transactional customer emails for a confirmed visit and the optional review.
-- The business tables remain authoritative: payloads only identify the schedule
-- version and every delivery attempt rechecks current eligibility.

create function private.enqueue_visit_confirmation(p_job_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare
  v_profile_id uuid;
  v_email text;
  v_schedule_version integer;
begin
  select cp.profile_id,p.email::text,s.version
    into v_profile_id,v_email,v_schedule_version
  from public.jobs j
  join public.customer_profiles cp on cp.id=j.customer_id
  join public.profiles p on p.id=cp.profile_id
  join public.job_schedule_reservations s on s.job_id=j.id and s.state='confirmed'
  where j.id=p_job_id and j.status='confirmed' and j.professional_id is not null
  order by s.version desc
  limit 1;

  if not found then return; end if;

  insert into private.outbox_events(
    event_type,aggregate_type,aggregate_id,channel,recipient_profile_id,
    recipient_key,dedupe_key,payload
  ) values(
    'visit.confirmed','job',p_job_id,'email',v_profile_id,lower(v_email),
    'visit-confirmed:'||p_job_id::text||':'||v_schedule_version::text,
    '{}'::jsonb
  ) on conflict(channel,recipient_key,dedupe_key) do nothing;
end;
$$;

create function private.enqueue_visit_confirmation_from_job() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status='confirmed' and new.status is distinct from old.status then
    perform private.enqueue_visit_confirmation(new.id);
  end if;
  return new;
end;
$$;

create function private.enqueue_visit_confirmation_from_schedule() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.state='confirmed' and (tg_op='INSERT' or new.state is distinct from old.state) then
    perform private.enqueue_visit_confirmation(new.job_id);
  end if;
  return new;
end;
$$;

create trigger job_visit_confirmation
after update of status on public.jobs
for each row execute function private.enqueue_visit_confirmation_from_job();

create trigger schedule_visit_confirmation
after insert or update of state on public.job_schedule_reservations
for each row execute function private.enqueue_visit_confirmation_from_schedule();

create function private.enqueue_review_request() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_profile_id uuid;
  v_email text;
begin
  if new.decision<>'confirmed' then return new; end if;

  select cp.profile_id,p.email::text into v_profile_id,v_email
  from public.customer_profiles cp
  join public.profiles p on p.id=cp.profile_id
  where cp.id=new.customer_id;
  if not found then return new; end if;

  insert into private.outbox_events(
    event_type,aggregate_type,aggregate_id,channel,recipient_profile_id,
    recipient_key,dedupe_key,payload,available_at
  ) values(
    'review.requested','job',new.job_id,'email',v_profile_id,lower(v_email),
    'review-requested:'||new.job_id::text,'{}'::jsonb,
    clock_timestamp()+interval '2 hours'
  ) on conflict(channel,recipient_key,dedupe_key) do nothing;
  return new;
end;
$$;

create trigger customer_review_request
after insert on public.job_customer_decisions
for each row execute function private.enqueue_review_request();

-- Narrow customer-facing projection for the authenticated job screen. It
-- exposes only the public professional name and service-location label.
create function public.get_job_visit(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  v_job public.jobs%rowtype;
  v_role public.user_role:=public.current_user_role();
  v_result jsonb;
begin
  select * into v_job from public.jobs where id=p_job_id;
  if not found or not (
    (v_role='customer' and v_job.customer_id=private.current_customer_id()) or
    (v_role='professional' and v_job.professional_id=private.current_professional_id(false)) or
    (v_role='admin' and private.has_admin_permission('operations'))
  ) then raise exception using errcode='P0002',message='job_not_found'; end if;

  select jsonb_build_object(
    'scheduleVersion',s.version,
    'startsAt',s.starts_at,
    'endsAt',s.ends_at,
    'timezone',s.timezone,
    'addressLabel',left(btrim(concat_ws(', ',btrim(concat_ws(' ',a.street,a.number)),
      nullif(btrim(concat_ws(' ',case when a.floor is not null then 'Piso '||a.floor end,
        case when a.apartment is not null then 'Depto. '||a.apartment end)),''),a.city)),500),
    'professionalName',left(coalesce(nullif(btrim(concat_ws(' ',nullif(btrim(p.first_name),''),
      case when nullif(btrim(p.last_name),'') is null then null else left(btrim(p.last_name),1)||'.' end)),''),'Profesional Lysto'),160),
    'durationMinutes',s.duration_minutes,
    'travelBufferMinutes',s.travel_buffer_minutes,
    'confirmed',true
  ) into v_result
  from public.job_schedule_reservations s
  join public.service_requests r on r.id=v_job.request_id
  join public.customer_addresses a on a.id=r.address_id
  join public.professional_profiles pro on pro.id=v_job.professional_id
  join public.profiles p on p.id=pro.profile_id
  where s.job_id=v_job.id and s.state='confirmed' and v_job.status='confirmed'
  order by s.version desc limit 1;
  return v_result;
end;
$$;

revoke all on function public.get_job_visit(uuid) from public,anon;
grant execute on function public.get_job_visit(uuid) to authenticated;

-- Keep the generic status notification in-app. The richer visit email above is
-- the single email sent when a confirmed schedule exists.
create or replace function private.notify_job_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_customer_profile uuid;v_professional_profile uuid;v_event text;v_key text:=gen_random_uuid()::text;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_event=case new.status
    when 'pending_professional_acceptance' then 'job.assigned'
    when 'confirmed' then 'job.confirmed'
    when 'technician_on_way' then 'job.technician_on_way'
    when 'arrived' then 'job.arrived'
    when 'completed_pending_customer_confirmation' then 'job.completed_pending_customer_confirmation'
    when 'completed' then 'job.completed' else null end;
  if v_event is null then return new; end if;
  select profile_id into v_customer_profile from public.customer_profiles where id=new.customer_id;
  if new.professional_id is not null then
    select profile_id into v_professional_profile from public.professional_profiles where id=new.professional_id;
  end if;
  perform private.enqueue_profile_delivery(v_event,'job',new.id,v_customer_profile,
    case when new.status='completed_pending_customer_confirmation' then array['in_app','email'] else array['in_app'] end,v_key);
  perform private.enqueue_profile_delivery(v_event,'job',new.id,v_professional_profile,
    case when new.status='pending_professional_acceptance' then array['in_app','email'] else array['in_app'] end,v_key);
  perform private.enqueue_admin_delivery(v_event,'job',new.id,'operations',v_key);
  return new;
end;
$$;

create or replace function private.outbox_recipient(p_event private.outbox_events) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_email text; v_role text; v_audience text; v_permission public.admin_permission;
  v_inv public.professional_invitations%rowtype; v_customer uuid; v_professional uuid;
  v_context jsonb; v_allowed boolean=false;
  v_schedule_version integer; v_expected_schedule_version integer;
  v_starts_at timestamptz; v_ends_at timestamptz;
  v_timezone text; v_service_name text; v_professional_name text; v_address_label text;
begin
  if p_event.event_type='professional.invited' then
    if p_event.channel<>'email' or p_event.aggregate_type<>'professional_invitation' then
      raise exception using errcode='22023',message='recipient_unavailable'; end if;
    select * into v_inv from public.professional_invitations where id=p_event.aggregate_id for share;
    if not found or v_inv.status not in ('queued','sent') or v_inv.consumed_at is not null or v_inv.expires_at<=clock_timestamp()
      or p_event.payload->>'invitation_token' is null
      or v_inv.token_hash<>encode(extensions.digest(p_event.payload->>'invitation_token','sha256'),'hex')
      or lower(v_inv.email::text)<>lower(p_event.recipient_key) then
      raise exception using errcode='22023',message='recipient_unavailable'; end if;
    return jsonb_build_object('recipientEmail',v_inv.email,'context',jsonb_build_object(
      'eventType',p_event.event_type,'aggregateId',p_event.aggregate_id,'audience','professional','invitationToken',p_event.payload->>'invitation_token'));
  end if;

  select u.email,p.role::text into v_email,v_role
  from public.profiles p join auth.users u on u.id=p.auth_user_id
  where p.id=p_event.recipient_profile_id and u.deleted_at is null and u.email_confirmed_at is not null
    and u.email is not null and length(u.email::text) between 3 and 320
    and (u.banned_until is null or u.banned_until<=now())
    and coalesce(u.raw_app_meta_data->>'app_role','customer')=p.role::text
  for share of p,u;
  if not found then raise exception using errcode='22023',message='recipient_unavailable'; end if;

  if p_event.aggregate_type='job' and p_event.event_type='visit.confirmed' then
    if p_event.channel<>'email' or p_event.dedupe_key
      !~ ('^visit-confirmed:'||p_event.aggregate_id::text||':[1-9][0-9]*$') then
      raise exception using errcode='22023',message='recipient_unavailable'; end if;
    v_expected_schedule_version=split_part(p_event.dedupe_key,':',3)::integer;
    select j.customer_id,j.professional_id,s.version,s.starts_at,s.ends_at,s.timezone,
      left(sc.name,160),
      left(coalesce(nullif(btrim(concat_ws(' ',nullif(btrim(pp.first_name),''),
        case when nullif(btrim(pp.last_name),'') is null then null else left(btrim(pp.last_name),1)||'.' end)),''),'Profesional Lysto'),160),
      left(btrim(concat_ws(', ',btrim(concat_ws(' ',a.street,a.number)),a.city)),500)
      into v_customer,v_professional,v_schedule_version,v_starts_at,v_ends_at,v_timezone,
        v_service_name,v_professional_name,v_address_label
    from public.jobs j
    join public.job_schedule_reservations s on s.job_id=j.id and s.state='confirmed'
    join public.service_requests r on r.id=j.request_id
    join public.service_categories sc on sc.id=r.category_id
    join public.customer_addresses a on a.id=r.address_id
    join public.professional_profiles pro on pro.id=j.professional_id
    join public.profiles pp on pp.id=pro.profile_id
    where j.id=p_event.aggregate_id and j.status='confirmed'
      and s.version=v_expected_schedule_version;
    v_allowed=found and v_role='customer' and exists(
      select 1 from public.customer_profiles cp
      where cp.id=v_customer and cp.profile_id=p_event.recipient_profile_id);
    if not v_allowed then raise exception using errcode='22023',message='recipient_unavailable'; end if;
    v_context=jsonb_build_object(
      'eventType','visit.confirmed','aggregateId',p_event.aggregate_id,'audience','customer',
      'scheduleVersion',v_schedule_version,'startsAt',v_starts_at,'endsAt',v_ends_at,
      'timezone',v_timezone,'serviceName',v_service_name,
      'professionalName',v_professional_name,'addressLabel',v_address_label);
    return jsonb_build_object('recipientEmail',v_email,'context',v_context);
  elsif p_event.aggregate_type='job' and p_event.event_type='review.requested' then
    if p_event.channel<>'email' then raise exception using errcode='22023',message='recipient_unavailable'; end if;
    select j.customer_id,j.professional_id into v_customer,v_professional
    from public.jobs j
    where j.id=p_event.aggregate_id and j.status='completed'
      and exists(select 1 from public.job_customer_decisions d where d.job_id=j.id and d.decision='confirmed')
      and not exists(select 1 from public.reviews r where r.job_id=j.id);
    v_allowed=found and v_role='customer' and exists(
      select 1 from public.customer_profiles cp
      where cp.id=v_customer and cp.profile_id=p_event.recipient_profile_id);
    if not v_allowed then raise exception using errcode='22023',message='recipient_unavailable'; end if;
    return jsonb_build_object('recipientEmail',v_email,'context',jsonb_build_object(
      'eventType','review.requested','aggregateId',p_event.aggregate_id,'audience','customer'));
  elsif p_event.aggregate_type='professional' and p_event.event_type in ('professional.application.submitted','professional.approved','professional.rejected','professional.suspended') then
    select id into v_professional from public.professional_profiles where id=p_event.aggregate_id;
    v_permission='operations';
    v_allowed=found and (v_role='admin' or (p_event.event_type<>'professional.application.submitted' and exists(
      select 1 from public.professional_profiles where id=v_professional and profile_id=p_event.recipient_profile_id)));
  elsif p_event.aggregate_type='quote' and p_event.event_type='quote.ready' then
    select customer_id into v_customer from public.service_quotes where id=p_event.aggregate_id and status='ready' and expires_at>now();
    v_allowed=found; v_permission='operations';
  elsif p_event.aggregate_type='request' and p_event.event_type in ('request.created','request.cancelled') then
    select customer_id into v_customer from public.service_requests where id=p_event.aggregate_id;
    v_allowed=found; v_permission='operations';
  elsif p_event.aggregate_type='job' and p_event.event_type in ('job.assigned','job.confirmed','job.technician_on_way','job.arrived','job.completed_pending_customer_confirmation','job.completed') then
    select customer_id,professional_id into v_customer,v_professional from public.jobs where id=p_event.aggregate_id;
    v_allowed=found; v_permission='operations';
  elsif p_event.aggregate_type='payment' and p_event.event_type in ('payment.approved','payment.failed','payment.refunded') then
    select customer_id into v_customer from public.payments where id=p_event.aggregate_id;
    v_allowed=found; v_permission='finance';
  elsif p_event.aggregate_type='complaint' and p_event.event_type='support.opened' then
    select customer_id,professional_id into v_customer,v_professional from public.complaints where id=p_event.aggregate_id;
    v_allowed=found; v_permission='quality';
  end if;
  if not v_allowed then raise exception using errcode='22023',message='recipient_unavailable'; end if;
  if v_role='admin' then
    if not exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id
      where a.profile_id=p_event.recipient_profile_id and g.permission in (v_permission,'owner')) then
      raise exception using errcode='22023',message='recipient_unavailable'; end if;
    v_audience=v_permission::text;
  elsif v_role='customer' and exists(select 1 from public.customer_profiles where id=v_customer and profile_id=p_event.recipient_profile_id) then
    v_audience='customer';
  elsif v_role='professional' and exists(select 1 from public.professional_profiles where id=v_professional and profile_id=p_event.recipient_profile_id) then
    v_audience='professional';
  else raise exception using errcode='22023',message='recipient_unavailable'; end if;
  v_context=jsonb_build_object('eventType',p_event.event_type,'aggregateId',p_event.aggregate_id,'audience',v_audience);
  return jsonb_build_object('recipientEmail',v_email,'context',v_context);
end;
$$;

-- v2 is reserved for the richer, immutable customer email snapshots above.
create or replace function private.seal_outbox_delivery(p_event_id uuid,p_claim_token uuid,p_content jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_recipient jsonb; v_snapshot private.outbox_delivery_snapshots%rowtype;
begin
  v_recipient=public.resolve_outbox_delivery(p_event_id,p_claim_token);
  if v_recipient->'snapshot'<>'null'::jsonb then return v_recipient->'snapshot'; end if;
  if jsonb_typeof(p_content)<>'object' or p_content is null or octet_length(p_content::text)>65536
    or p_content->>'version' not in ('transactional-v1','transactional-v2') or p_content->>'version' is null
    or p_content->>'to' is distinct from v_recipient->>'recipientEmail'
    or exists(select 1 from jsonb_object_keys(p_content) k where k not in ('version','from','to','subject','text','html','url'))
    or exists(select 1 from unnest(array['from','to','subject','text','html','url']) k where jsonb_typeof(p_content->k) is distinct from 'string' or length(p_content->>k)=0)
    or (p_content->>'subject')~E'[\r\n]' or (p_content->>'from')~E'[\r\n]' then
    raise exception using errcode='22023',message='invalid_delivery_snapshot'; end if;
  insert into private.outbox_delivery_snapshots(outbox_id,recipient_email,context,content,idempotency_key)
    values(p_event_id,v_recipient->>'recipientEmail',v_recipient->'context',p_content,'lysto-outbox-'||p_event_id::text)
    returning * into v_snapshot;
  return jsonb_build_object('content',v_snapshot.content,'idempotencyKey',v_snapshot.idempotency_key,'firstAttemptAt',v_snapshot.first_attempt_at);
end;
$$;

create or replace function private.list_outbox_deliveries(p_limit integer,p_cursor_at timestamptz,p_cursor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_items jsonb;v_total bigint;v_counts jsonb;v_email_usage jsonb;
begin
  perform private.lock_admin_mutation('operations');
  if p_limit is null or p_limit not between 1 and 100 or ((p_cursor_at is null)<>(p_cursor_id is null)) then
    raise exception using errcode='22023',message='Invalid delivery page'; end if;
  select count(*) into v_total from private.outbox_events;
  select jsonb_build_object(
    'queued',count(*) filter(where processed_at is null and dead_lettered_at is null and delivery_outcome is null and channel<>'whatsapp_manual' and not(locked_until>clock_timestamp())),
    'leased',count(*) filter(where processed_at is null and dead_lettered_at is null and locked_until>clock_timestamp()),
    'processed',count(*) filter(where processed_at is not null and delivery_outcome is distinct from 'suppressed'),
    'deadLetter',count(*) filter(where dead_lettered_at is not null),
    'suppressed',count(*) filter(where delivery_outcome='suppressed'),
    'manual',count(*) filter(where processed_at is null and dead_lettered_at is null and channel='whatsapp_manual')
  ) into v_counts from private.outbox_events;
  select jsonb_build_object(
    'daily',count(*) filter(where processed_at >= (date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')),
    'monthly',count(*) filter(where processed_at >= (date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC'))
  ) into v_email_usage
  from private.outbox_events
  where channel='email' and delivery_outcome='provider_accepted';
  select coalesce(jsonb_agg(private.outbox_delivery_document(row_value) order by created_at desc,id desc),'[]'::jsonb) into v_items
  from (select * from private.outbox_events where p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id)
    order by created_at desc,id desc limit p_limit+1) row_value;
  return jsonb_build_object('items',v_items,'total',v_total,'counts',v_counts,'emailUsage',v_email_usage);
end;
$$;

create or replace function public.production_readiness_probe() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then
    raise exception using errcode='42501',message='service_role_required';
  end if;
  return jsonb_build_object(
    'databaseTime',clock_timestamp(),
    'outboxOldestPendingAt',(
      select min(created_at) from private.outbox_events
      where processed_at is null and dead_lettered_at is null
    ),
    'refundOldestPendingAt',(
      select min(requested_at) from private.payment_refund_requests
      where status in ('requested','processing')
    ),
    'paymentReviewCount',(
      select count(*) from public.marketplace_checkouts where status='review'
    ),
    'emailAcceptedToday',(
      select count(*) from private.outbox_events
      where channel='email' and delivery_outcome='provider_accepted'
        and processed_at >= (date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')
    ),
    'emailAcceptedThisMonth',(
      select count(*) from private.outbox_events
      where channel='email' and delivery_outcome='provider_accepted'
        and processed_at >= (date_trunc('month',clock_timestamp() at time zone 'UTC') at time zone 'UTC')
    )
  );
end;
$$;

revoke all on function private.enqueue_visit_confirmation(uuid),
  private.enqueue_visit_confirmation_from_job(),private.enqueue_visit_confirmation_from_schedule(),
  private.enqueue_review_request(),private.outbox_recipient(private.outbox_events)
  from public,anon,authenticated,service_role;
