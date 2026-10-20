-- Read-only regression: no insert, enqueue, retry or delivery is performed.
-- All fields below are synthetic; the serializer receives a composite value.
do $test$
declare
  event private.outbox_events;
  document jsonb;
begin
  event := jsonb_populate_record(null::private.outbox_events, jsonb_build_object(
    'id', '11111111-1111-4111-8111-111111111111',
    'event_type', 'job.assigned', 'channel', 'email',
    'created_at', '2026-10-20T12:00:00Z', 'available_at', '2026-10-20T12:00:00Z',
    'attempt_count', 0, 'max_attempts', 8, 'delivery_revision', 1
  ));
  document := private.outbox_delivery_document(event);
  if document->'providerAccepted' is distinct from 'false'::jsonb then
    raise exception 'queued delivery providerAccepted must be false, never null';
  end if;
  event.delivery_outcome := 'provider_accepted';
  if private.outbox_delivery_document(event)->'providerAccepted' is distinct from 'true'::jsonb then
    raise exception 'accepted delivery providerAccepted must remain true';
  end if;
  event.delivery_outcome := 'suppressed';
  if private.outbox_delivery_document(event)->'providerAccepted' is distinct from 'false'::jsonb then
    raise exception 'suppressed delivery providerAccepted must be false';
  end if;
end;
$test$;
select 'notification_delivery_boolean: passed' as result;
