-- Private immutable content, current-recipient authorization and fenced delivery.
alter table private.outbox_events add column delivery_revision integer not null default 1;
alter table private.outbox_events add column delivery_outcome text
  check(delivery_outcome in ('in_app','provider_accepted','suppressed'));
create function private.advance_delivery_revision() returns trigger
language plpgsql security definer set search_path='' as $$
begin new.delivery_revision=old.delivery_revision+1; return new; end; $$;
revoke all on function private.advance_delivery_revision() from public,anon,authenticated,service_role;
create trigger outbox_delivery_revision before update on private.outbox_events
  for each row execute function private.advance_delivery_revision();

create table private.outbox_delivery_snapshots (
  outbox_id uuid primary key references private.outbox_events(id) on delete cascade,
  recipient_email text not null,
  context jsonb not null check(jsonb_typeof(context)='object'),
  content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=65536),
  first_attempt_at timestamptz not null default clock_timestamp(),
  idempotency_key text not null unique,
  check(length(recipient_email) between 3 and 320)
);
alter table private.outbox_delivery_snapshots enable row level security;
alter table private.outbox_delivery_snapshots force row level security;
revoke all on private.outbox_delivery_snapshots from public,anon,authenticated,service_role;
alter table public.notifications add column outbox_id uuid unique;
alter table public.notifications add column action_url text;

-- Deliberately not callable by application or worker roles. Only the controlled
-- wrappers below can resolve private data. Recheck at every delivery attempt.
create function private.outbox_recipient(p_event private.outbox_events) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_email text; v_role text; v_audience text; v_permission public.admin_permission;
  v_inv public.professional_invitations%rowtype; v_customer uuid; v_professional uuid;
  v_context jsonb; v_allowed boolean=false;
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
  select u.email,p.role::text into v_email,v_role from public.profiles p join auth.users u on u.id=p.auth_user_id
    where p.id=p_event.recipient_profile_id and u.deleted_at is null and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until<=now())
      and coalesce(u.raw_app_meta_data->>'app_role','customer')=p.role::text for share of p,u;
  if not found then raise exception using errcode='22023',message='recipient_unavailable'; end if;
  if p_event.aggregate_type='professional' and p_event.event_type in ('professional.application.submitted','professional.approved','professional.rejected','professional.suspended') then
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
end; $$;
revoke all on function private.outbox_recipient(private.outbox_events) from public,anon,authenticated,service_role;

create function public.resolve_outbox_delivery(p_event_id uuid,p_claim_token uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_event private.outbox_events%rowtype; v_recipient jsonb; v_snapshot private.outbox_delivery_snapshots%rowtype;
begin
  select * into v_event from private.outbox_events where id=p_event_id and claim_token=p_claim_token
    and locked_until>clock_timestamp() and processed_at is null and dead_lettered_at is null for update;
  if not found then raise exception using errcode='40001',message='delivery_claim_lost'; end if;
  v_recipient=private.outbox_recipient(v_event);
  select * into v_snapshot from private.outbox_delivery_snapshots where outbox_id=v_event.id;
  if found and (v_snapshot.recipient_email<>v_recipient->>'recipientEmail' or v_snapshot.context<>v_recipient->'context') then
    raise exception using errcode='22023',message='recipient_unavailable'; end if;
  return v_recipient || jsonb_build_object('snapshot',case when v_snapshot.outbox_id is null then null else jsonb_build_object(
    'content',v_snapshot.content,'idempotencyKey',v_snapshot.idempotency_key,'firstAttemptAt',v_snapshot.first_attempt_at) end);
end; $$;

create function public.seal_outbox_delivery(p_event_id uuid,p_claim_token uuid,p_content jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_recipient jsonb; v_snapshot private.outbox_delivery_snapshots%rowtype;
begin
  v_recipient=public.resolve_outbox_delivery(p_event_id,p_claim_token);
  if v_recipient->'snapshot'<>'null'::jsonb then return v_recipient->'snapshot'; end if;
  if jsonb_typeof(p_content)<>'object' or p_content is null or octet_length(p_content::text)>65536
    or p_content->>'version'<>'transactional-v1' or p_content->>'version' is null
    or p_content->>'to' is distinct from v_recipient->>'recipientEmail'
    or exists(select 1 from jsonb_object_keys(p_content) k where k not in ('version','from','to','subject','text','html','url'))
    or exists(select 1 from unnest(array['from','to','subject','text','html','url']) k where jsonb_typeof(p_content->k) is distinct from 'string' or length(p_content->>k)=0)
    or (p_content->>'subject')~E'[\r\n]' or (p_content->>'from')~E'[\r\n]' then
    raise exception using errcode='22023',message='invalid_delivery_snapshot'; end if;
  insert into private.outbox_delivery_snapshots(outbox_id,recipient_email,context,content,idempotency_key)
    values(p_event_id,v_recipient->>'recipientEmail',v_recipient->'context',p_content,'lysto-outbox-'||p_event_id::text) returning * into v_snapshot;
  return jsonb_build_object('content',v_snapshot.content,'idempotencyKey',v_snapshot.idempotency_key,'firstAttemptAt',v_snapshot.first_attempt_at);
end; $$;

create function public.finish_in_app_delivery(p_event_id uuid,p_claim_token uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_recipient jsonb; v_event private.outbox_events%rowtype; v_content jsonb;
begin
  v_recipient=public.resolve_outbox_delivery(p_event_id,p_claim_token);
  select * into v_event from private.outbox_events where id=p_event_id;
  v_content=v_recipient->'snapshot'->'content';
  if v_event.channel<>'in_app' or v_content is null then raise exception using errcode='22023',message='invalid_delivery_snapshot'; end if;
  insert into public.notifications(profile_id,event_type,title,body,entity_type,entity_id,outbox_id,action_url)
    values(v_event.recipient_profile_id,v_event.event_type,v_content->>'subject',v_content->>'text',v_event.aggregate_type,v_event.aggregate_id,v_event.id,v_content->>'url')
    on conflict(outbox_id) do nothing;
  if not public.ack_outbox_event(p_event_id,p_claim_token,null) then raise exception using errcode='40001',message='delivery_claim_lost'; end if;
  update private.outbox_events set delivery_outcome='in_app' where id=p_event_id;
  return true;
end; $$;

create function public.finish_email_delivery(p_event_id uuid,p_claim_token uuid,p_provider_message_id text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_event private.outbox_events%rowtype;
begin
  select * into v_event from private.outbox_events where id=p_event_id and claim_token=p_claim_token
    and processed_at is null and dead_lettered_at is null for update;
  if not found then return false; end if;
  if v_event.channel<>'email' or p_provider_message_id is null or not exists(select 1 from private.outbox_delivery_snapshots where outbox_id=p_event_id) then
    raise exception using errcode='22023',message='invalid_delivery_snapshot'; end if;
  if not public.ack_outbox_event(p_event_id,p_claim_token,p_provider_message_id) then return false; end if;
  update private.outbox_events set delivery_outcome='provider_accepted' where id=p_event_id;
  -- Provider acceptance is evidence of submission, never proof of inbox delivery.
  if v_event.event_type='professional.invited' then
    update public.professional_invitations set status='sent' where id=v_event.aggregate_id and status='queued' and consumed_at is null;
    insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
      values(null,'notification.provider_accepted','professional_invitation',v_event.aggregate_id,jsonb_build_object('status','provider_accepted'));
  end if;
  return true;
end; $$;

create function public.stop_outbox_delivery(p_event_id uuid,p_claim_token uuid,p_code text,p_suppressed boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if p_code is null or p_code!~'^[a-z_0-9]{1,100}$' then raise exception using errcode='22023',message='invalid_delivery_error'; end if;
  update private.outbox_events set locked_at=null,locked_until=null,locked_by=null,claim_token=null,
    processed_at=case when p_suppressed then clock_timestamp() else null end,
    dead_lettered_at=case when p_suppressed then null else clock_timestamp() end,
    delivery_outcome=case when p_suppressed then 'suppressed' else null end,
    last_error=case when p_suppressed then null else p_code end
    where id=p_event_id and claim_token=p_claim_token and processed_at is null and dead_lettered_at is null;
  return found;
end; $$;

revoke all on function public.resolve_outbox_delivery(uuid,uuid),public.seal_outbox_delivery(uuid,uuid,jsonb),
  public.finish_in_app_delivery(uuid,uuid),public.finish_email_delivery(uuid,uuid,text),public.stop_outbox_delivery(uuid,uuid,text,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.resolve_outbox_delivery(uuid,uuid),public.seal_outbox_delivery(uuid,uuid,jsonb),
  public.finish_in_app_delivery(uuid,uuid),public.finish_email_delivery(uuid,uuid,text),public.stop_outbox_delivery(uuid,uuid,text,boolean) to service_role;

-- Channel-aware overload leaves disabled transports queued without consuming attempts.
create or replace function public.claim_outbox_events(
  p_worker_id text,
  p_batch_size integer,
  p_lease_seconds integer,
  p_channels text[]
)
returns table (
  id uuid,
  event_type text,
  aggregate_type text,
  aggregate_id uuid,
  channel text,
  recipient_profile_id uuid,
  recipient_key text,
  dedupe_key text,
  payload jsonb,
  created_at timestamptz,
  attempt_count integer,
  claim_token uuid,
  locked_until timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_worker_id is null or length(btrim(p_worker_id)) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'worker_id must contain 1 to 200 characters';
  end if;
  if p_batch_size is null or p_batch_size not between 1 and 100 then
    raise exception using errcode = '22023', message = 'batch_size must be between 1 and 100';
  end if;
  if p_lease_seconds is null or p_lease_seconds not between 1 and 3600 then
    raise exception using errcode = '22023', message = 'lease_seconds must be between 1 and 3600';
  end if;

  if p_channels is null or cardinality(p_channels)=0 or not (p_channels <@ array['in_app','email','whatsapp_manual','push']::text[]) then
    raise exception using errcode='22023',message='Invalid notification channels'; end if;
  with expired as (
    select outbox.id
    from private.outbox_events as outbox
    where outbox.channel=any(p_channels) and outbox.processed_at is null
      and outbox.dead_lettered_at is null
      and outbox.attempt_count >= outbox.max_attempts
      and outbox.locked_until <= v_now
    order by outbox.locked_until, outbox.id
    for update skip locked
    limit p_batch_size
  )
  update private.outbox_events as outbox
  set locked_at = null,
      locked_until = null,
      locked_by = null,
      claim_token = null,
      last_error = 'lease expired after maximum attempts',
      dead_lettered_at = v_now
  from expired
  where outbox.id = expired.id;

  return query
  with candidates as (
    select outbox.id
    from private.outbox_events as outbox
    where outbox.channel=any(p_channels) and outbox.processed_at is null
      and outbox.dead_lettered_at is null
      and outbox.attempt_count < outbox.max_attempts
      and outbox.available_at <= v_now
      and (outbox.locked_until is null or outbox.locked_until <= v_now)
    order by outbox.available_at, outbox.created_at, outbox.id
    for update skip locked
    limit p_batch_size
  )
  update private.outbox_events as outbox
  set attempt_count = outbox.attempt_count + 1,
      locked_at = v_now,
      locked_until = v_now + make_interval(secs => p_lease_seconds),
      locked_by = p_worker_id,
      claim_token = gen_random_uuid(),
      last_error = null
  from candidates
  where outbox.id = candidates.id
  returning
    outbox.id,
    outbox.event_type,
    outbox.aggregate_type,
    outbox.aggregate_id,
    outbox.channel,
    outbox.recipient_profile_id,
    outbox.recipient_key,
    outbox.dedupe_key,
    outbox.payload,
    outbox.created_at,
    outbox.attempt_count,
    outbox.claim_token,
    outbox.locked_until;
end;
$$;


revoke all on function public.claim_outbox_events(text,integer,integer,text[]) from public,anon,authenticated,service_role;
grant execute on function public.claim_outbox_events(text,integer,integer,text[]) to service_role;
