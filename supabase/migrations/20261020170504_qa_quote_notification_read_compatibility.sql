-- Queued deliveries have no outcome yet. The operations API requires an
-- explicit boolean, so SQL's nullable equality must not leak into the document.
-- Preserve the serializer's privileges, fields and sanitization.
create or replace function private.outbox_delivery_document(p_event private.outbox_events)
returns jsonb language sql stable security definer set search_path = '' as $function$
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
    'providerAccepted',coalesce(p_event.delivery_outcome='provider_accepted',false),
    'version',p_event.delivery_revision
  );
$function$;
