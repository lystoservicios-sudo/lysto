-- A delivery without a lease is queued too. Preserve admin authorization,
-- pagination, delivery states and the existing function privileges.
create or replace function private.list_outbox_deliveries(p_limit integer,p_cursor_at timestamptz,p_cursor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_items jsonb;v_total bigint;v_counts jsonb;v_email_usage jsonb;
begin
  perform private.lock_admin_mutation('operations');
  if p_limit is null or p_limit not between 1 and 100 or ((p_cursor_at is null)<>(p_cursor_id is null)) then
    raise exception using errcode='22023',message='Invalid delivery page'; end if;
  select count(*) into v_total from private.outbox_events;
  select jsonb_build_object(
    'queued',count(*) filter(where processed_at is null and dead_lettered_at is null and delivery_outcome is null and channel<>'whatsapp_manual' and (locked_until is null or locked_until<=clock_timestamp())),
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
