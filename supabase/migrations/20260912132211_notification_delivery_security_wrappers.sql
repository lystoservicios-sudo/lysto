-- Keep SECURITY DEFINER implementations out of the Data API's public schema.
alter function public.resolve_outbox_delivery(uuid,uuid) set schema private;
alter function public.seal_outbox_delivery(uuid,uuid,jsonb) set schema private;
alter function public.finish_in_app_delivery(uuid,uuid) set schema private;
alter function public.finish_email_delivery(uuid,uuid,text) set schema private;
alter function public.stop_outbox_delivery(uuid,uuid,text,boolean) set schema private;

create function public.resolve_outbox_delivery(p_event_id uuid,p_claim_token uuid) returns jsonb
language sql security invoker set search_path='' as $$
  select private.resolve_outbox_delivery(p_event_id,p_claim_token);
$$;
create function public.seal_outbox_delivery(p_event_id uuid,p_claim_token uuid,p_content jsonb) returns jsonb
language sql security invoker set search_path='' as $$
  select private.seal_outbox_delivery(p_event_id,p_claim_token,p_content);
$$;
create function public.finish_in_app_delivery(p_event_id uuid,p_claim_token uuid) returns boolean
language sql security invoker set search_path='' as $$
  select private.finish_in_app_delivery(p_event_id,p_claim_token);
$$;
create function public.finish_email_delivery(p_event_id uuid,p_claim_token uuid,p_provider_message_id text) returns boolean
language sql security invoker set search_path='' as $$
  select private.finish_email_delivery(p_event_id,p_claim_token,p_provider_message_id);
$$;
create function public.stop_outbox_delivery(p_event_id uuid,p_claim_token uuid,p_code text,p_suppressed boolean default false) returns boolean
language sql security invoker set search_path='' as $$
  select private.stop_outbox_delivery(p_event_id,p_claim_token,p_code,p_suppressed);
$$;

revoke all on function private.resolve_outbox_delivery(uuid,uuid),private.seal_outbox_delivery(uuid,uuid,jsonb),
  private.finish_in_app_delivery(uuid,uuid),private.finish_email_delivery(uuid,uuid,text),private.stop_outbox_delivery(uuid,uuid,text,boolean),
  public.resolve_outbox_delivery(uuid,uuid),public.seal_outbox_delivery(uuid,uuid,jsonb),
  public.finish_in_app_delivery(uuid,uuid),public.finish_email_delivery(uuid,uuid,text),public.stop_outbox_delivery(uuid,uuid,text,boolean)
  from public,anon,authenticated,service_role;
grant execute on function private.resolve_outbox_delivery(uuid,uuid),private.seal_outbox_delivery(uuid,uuid,jsonb),
  private.finish_in_app_delivery(uuid,uuid),private.finish_email_delivery(uuid,uuid,text),private.stop_outbox_delivery(uuid,uuid,text,boolean),
  public.resolve_outbox_delivery(uuid,uuid),public.seal_outbox_delivery(uuid,uuid,jsonb),
  public.finish_in_app_delivery(uuid,uuid),public.finish_email_delivery(uuid,uuid,text),public.stop_outbox_delivery(uuid,uuid,text,boolean)
  to service_role;

create function private.outbox_delivery_document(p_event private.outbox_events) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id',p_event.id,'eventType',p_event.event_type,'channel',p_event.channel,
    'createdAt',p_event.created_at,'availableAt',p_event.available_at,
    'attemptCount',p_event.attempt_count,'maxAttempts',p_event.max_attempts,
    'state',case
      when p_event.delivery_outcome='suppressed' then 'suppressed'
      when p_event.dead_lettered_at is not null then 'dead_letter'
      when p_event.processed_at is not null then 'processed'
      when p_event.channel='whatsapp_manual' then 'manual'
      when p_event.locked_until>clock_timestamp() then 'leased'
      else 'queued' end,
    'lastError',case when p_event.last_error~'^[a-z_0-9 ]{1,200}$' then p_event.last_error else case when p_event.last_error is null then null else 'delivery_error' end end,
    'providerAccepted',p_event.delivery_outcome='provider_accepted',
    'version',p_event.delivery_revision
  );
$$;
revoke all on function private.outbox_delivery_document(private.outbox_events) from public,anon,authenticated,service_role;

create function private.list_outbox_deliveries(p_limit integer,p_cursor_at timestamptz,p_cursor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_items jsonb;v_total bigint;v_counts jsonb;
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
  select coalesce(jsonb_agg(private.outbox_delivery_document(row_value) order by created_at desc,id desc),'[]'::jsonb) into v_items
  from (select * from private.outbox_events where p_cursor_at is null or (created_at,id)<(p_cursor_at,p_cursor_id)
    order by created_at desc,id desc limit p_limit+1) row_value;
  return jsonb_build_object('items',v_items,'total',v_total,'counts',v_counts);
end; $$;

create function public.list_outbox_deliveries(p_limit integer,p_cursor_at timestamptz,p_cursor_id uuid) returns jsonb
language sql security invoker set search_path='' as $$
  select private.list_outbox_deliveries(p_limit,p_cursor_at,p_cursor_id);
$$;

create function private.retry_outbox_delivery(p_event_id uuid,p_expected_revision integer,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_actor uuid;v_event private.outbox_events%rowtype;
begin
  v_actor=private.lock_admin_mutation('operations');
  if p_expected_revision is null or p_expected_revision<1 or length(btrim(coalesce(p_reason,''))) not between 10 and 1000 then
    raise exception using errcode='22023',message='Valid version and reason required'; end if;
  select * into v_event from private.outbox_events where id=p_event_id for update;
  if not found then raise exception using errcode='P0002',message='Delivery not found'; end if;
  if v_event.delivery_revision<>p_expected_revision then raise exception using errcode='40001',message='Delivery changed'; end if;
  if v_event.dead_lettered_at is null or v_event.processed_at is not null or v_event.provider_message_id is not null then
    raise exception using errcode='22023',message='Only unresolved dead letters can retry'; end if;
  if v_event.channel='email' and exists(select 1 from private.outbox_delivery_snapshots s where s.outbox_id=v_event.id and s.first_attempt_at<=clock_timestamp()-interval '23 hours') then
    raise exception using errcode='22023',message='Provider idempotency window expired'; end if;
  update private.outbox_events set available_at=clock_timestamp(),attempt_count=0,locked_at=null,locked_until=null,
    locked_by=null,claim_token=null,last_error=null,dead_lettered_at=null where id=v_event.id returning * into v_event;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(v_actor,'notification.delivery.retried','outbox_event',v_event.id,jsonb_build_object('reason',btrim(p_reason),'status','queued'));
  return private.outbox_delivery_document(v_event);
end; $$;
create function public.retry_outbox_delivery(p_event_id uuid,p_expected_revision integer,p_reason text) returns jsonb
language sql security invoker set search_path='' as $$
  select private.retry_outbox_delivery(p_event_id,p_expected_revision,p_reason);
$$;
revoke all on function private.list_outbox_deliveries(integer,timestamptz,uuid),public.list_outbox_deliveries(integer,timestamptz,uuid),
  private.retry_outbox_delivery(uuid,integer,text),public.retry_outbox_delivery(uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function private.list_outbox_deliveries(integer,timestamptz,uuid),public.list_outbox_deliveries(integer,timestamptz,uuid),
  private.retry_outbox_delivery(uuid,integer,text),public.retry_outbox_delivery(uuid,integer,text) to authenticated;
