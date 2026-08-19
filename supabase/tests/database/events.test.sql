begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public;

select plan(113);

select has_schema('private', 'private schema exists');
select has_table('private', 'provider_event_inbox', 'provider inbox is private');
select has_table('private', 'outbox_events', 'outbox is private');

select columns_are(
  'private',
  'provider_event_inbox',
  array[
    'id', 'provider', 'provider_event_id', 'resource_type', 'provider_resource_id',
    'event_type', 'payload', 'provider_occurred_at', 'received_at', 'available_at',
    'attempt_count', 'max_attempts', 'locked_at', 'locked_until', 'locked_by',
    'claim_token', 'last_error', 'processed_at', 'dead_lettered_at'
  ],
  'provider inbox exposes the expected durable-processing columns'
);
select columns_are(
  'private',
  'outbox_events',
  array[
    'id', 'event_type', 'aggregate_type', 'aggregate_id', 'channel',
    'recipient_profile_id', 'recipient_key', 'dedupe_key', 'payload', 'created_at',
    'available_at', 'attempt_count', 'max_attempts', 'locked_at', 'locked_until',
    'locked_by', 'claim_token', 'last_error', 'provider_message_id', 'processed_at',
    'dead_lettered_at'
  ],
  'outbox exposes the expected delivery columns'
);

select col_is_pk('private', 'provider_event_inbox', 'id', 'provider inbox has a primary key');
select col_is_pk('private', 'outbox_events', 'id', 'outbox has a primary key');
select col_is_unique(
  'private', 'provider_event_inbox', array['provider', 'provider_event_id'],
  'provider event identity is unique'
);
select col_is_unique(
  'private', 'outbox_events', array['channel', 'recipient_key', 'dedupe_key'],
  'outbox delivery identity is unique'
);

select has_index('private', 'provider_event_inbox', 'provider_event_inbox_claim_idx', 'inbox has a claim index');
select has_index('private', 'provider_event_inbox', 'provider_event_inbox_resource_idx', 'inbox has a resource lookup index');
select has_index('private', 'outbox_events', 'outbox_events_claim_idx', 'outbox has a claim index');
select has_index('private', 'outbox_events', 'outbox_events_aggregate_idx', 'outbox has an aggregate lookup index');
select has_index('private', 'outbox_events', 'outbox_events_recipient_idx', 'outbox has a recipient lookup index');
select has_index('private', 'outbox_events', 'outbox_events_provider_message_idx', 'outbox has a provider-message index');
select has_index('private', 'provider_event_inbox', 'provider_event_inbox_lease_expiry_idx', 'inbox has an expired-lease index');
select has_index('private', 'outbox_events', 'outbox_events_lease_expiry_idx', 'outbox has an expired-lease index');

select ok(
  coalesce((
    select pg_get_indexdef(indexrelid, 1, true) = 'available_at'
      and pg_get_indexdef(indexrelid, 2, true) = 'received_at'
      and pg_get_indexdef(indexrelid, 3, true) = 'id'
      and position('processed_at is null' in lower(pg_get_expr(indpred, indrelid))) > 0
      and position('dead_lettered_at is null' in lower(pg_get_expr(indpred, indrelid))) > 0
    from pg_catalog.pg_index
    where indexrelid = to_regclass('private.provider_event_inbox_claim_idx')
  ), false)
  and coalesce((
    select pg_get_indexdef(indexrelid, 1, true) = 'available_at'
      and pg_get_indexdef(indexrelid, 2, true) = 'created_at'
      and pg_get_indexdef(indexrelid, 3, true) = 'id'
      and position('processed_at is null' in lower(pg_get_expr(indpred, indrelid))) > 0
      and position('dead_lettered_at is null' in lower(pg_get_expr(indpred, indrelid))) > 0
    from pg_catalog.pg_index
    where indexrelid = to_regclass('private.outbox_events_claim_idx')
  ), false),
  'claim indexes have queue-order columns and terminal predicates'
);
select ok(
  coalesce((
    select pg_get_indexdef(indexrelid, 1, true) = 'locked_until'
      and pg_get_indexdef(indexrelid, 2, true) = 'id'
      and position('processed_at is null' in lower(pg_get_expr(indpred, indrelid))) > 0
      and position('dead_lettered_at is null' in lower(pg_get_expr(indpred, indrelid))) > 0
      and position('locked_until is not null' in lower(pg_get_expr(indpred, indrelid))) > 0
    from pg_catalog.pg_index
    where indexrelid = to_regclass('private.provider_event_inbox_lease_expiry_idx')
  ), false)
  and coalesce((
    select pg_get_indexdef(indexrelid, 1, true) = 'locked_until'
      and pg_get_indexdef(indexrelid, 2, true) = 'id'
      and position('processed_at is null' in lower(pg_get_expr(indpred, indrelid))) > 0
      and position('dead_lettered_at is null' in lower(pg_get_expr(indpred, indrelid))) > 0
      and position('locked_until is not null' in lower(pg_get_expr(indpred, indrelid))) > 0
    from pg_catalog.pg_index
    where indexrelid = to_regclass('private.outbox_events_lease_expiry_idx')
  ), false),
  'lease indexes have expiry-order columns and active-row predicates'
);

select has_column('public', 'payments', 'checkout_idempotency_key', 'payments store checkout idempotency');
select has_column('public', 'payments', 'provider_updated_at', 'payments store provider ordering time');
select has_index('public', 'payments', 'payments_provider_checkout_idempotency_idx', 'checkout idempotency is indexed uniquely');
select has_index('public', 'payments', 'payments_provider_preference_idx', 'provider preferences are indexed uniquely');
select has_index('public', 'payment_events', 'payment_events_payment_created_idx', 'payment event history has its FK access index');
select ok(
  coalesce((
    select indisunique
      and pg_get_indexdef(indexrelid, 1, true) = 'provider'
      and pg_get_indexdef(indexrelid, 2, true) = 'checkout_idempotency_key'
      and position('checkout_idempotency_key is not null' in lower(pg_get_expr(indpred, indrelid))) > 0
    from pg_catalog.pg_index
    where indexrelid = to_regclass('public.payments_provider_checkout_idempotency_idx')
  ), false)
  and coalesce((
    select indisunique
      and pg_get_indexdef(indexrelid, 1, true) = 'provider'
      and pg_get_indexdef(indexrelid, 2, true) = 'provider_preference_id'
      and position('provider_preference_id is not null' in lower(pg_get_expr(indpred, indrelid))) > 0
    from pg_catalog.pg_index
    where indexrelid = to_regclass('public.payments_provider_preference_idx')
  ), false),
  'payment idempotency indexes are unique with expected columns and predicates'
);
select ok(
  coalesce((
    select indisunique
      and pg_get_indexdef(indexrelid, 1, true) = 'channel'
      and pg_get_indexdef(indexrelid, 2, true) = 'provider_message_id'
      and position('provider_message_id is not null' in lower(pg_get_expr(indpred, indrelid))) > 0
    from pg_catalog.pg_index
    where indexrelid = to_regclass('private.outbox_events_provider_message_idx')
  ), false),
  'provider-message index is unique with expected columns and predicate'
);

select ok(
  coalesce((select relrowsecurity from pg_catalog.pg_class where oid = to_regclass('private.provider_event_inbox')), false),
  'provider inbox has RLS enabled'
);
select ok(
  coalesce((select relforcerowsecurity from pg_catalog.pg_class where oid = to_regclass('private.provider_event_inbox')), false),
  'provider inbox forces RLS'
);
select ok(
  coalesce((select relrowsecurity from pg_catalog.pg_class where oid = to_regclass('private.outbox_events')), false),
  'outbox has RLS enabled'
);
select ok(
  coalesce((select relforcerowsecurity from pg_catalog.pg_class where oid = to_regclass('private.outbox_events')), false),
  'outbox forces RLS'
);

select ok(
  to_regnamespace('private') is not null
    and not has_schema_privilege('public', to_regnamespace('private'), 'USAGE'),
  'PUBLIC cannot use private schema'
);
select ok(
  to_regnamespace('private') is not null
    and not has_schema_privilege('public', to_regnamespace('private'), 'CREATE'),
  'PUBLIC cannot create in private schema'
);
select ok(
  to_regnamespace('private') is not null
    and not has_schema_privilege('anon', to_regnamespace('private'), 'USAGE'),
  'anon cannot use private schema'
);
select ok(
  to_regnamespace('private') is not null
    and not has_schema_privilege('anon', to_regnamespace('private'), 'CREATE'),
  'anon cannot create in private schema'
);
select ok(
  to_regnamespace('private') is not null
    and has_schema_privilege('authenticated', to_regnamespace('private'), 'USAGE'),
  'authenticated retains private schema usage for shared helpers'
);
select ok(
  to_regnamespace('private') is not null
    and not has_schema_privilege('authenticated', to_regnamespace('private'), 'CREATE'),
  'authenticated cannot create in private schema'
);
select ok(
  to_regnamespace('private') is not null
    and has_schema_privilege('service_role', to_regnamespace('private'), 'USAGE')
    and not has_schema_privilege('service_role', to_regnamespace('private'), 'CREATE'),
  'service_role can use but cannot create in private schema'
);
with table_acl_matrix(table_name, grantee, privilege, table_order, role_order, privilege_order) as (
  select
    tables.table_name,
    roles.grantee,
    privileges.privilege,
    tables.table_order,
    roles.role_order,
    privileges.privilege_order
  from (values
    ('provider_event_inbox', 1),
    ('outbox_events', 2)
  ) tables(table_name, table_order)
  cross join (values
    ('public', 1),
    ('anon', 2),
    ('authenticated', 3)
  ) roles(grantee, role_order)
  cross join (values
    ('SELECT', 1),
    ('INSERT', 2),
    ('UPDATE', 3),
    ('DELETE', 4),
    ('TRUNCATE', 5),
    ('REFERENCES', 6),
    ('TRIGGER', 7)
  ) privileges(privilege, privilege_order)
)
select ok(
  to_regclass(format('private.%I', table_name)) is not null
    and not has_table_privilege(
      grantee,
      to_regclass(format('private.%I', table_name)),
      privilege
    ),
  format('%s has no %s privilege on private.%s', upper(grantee), privilege, table_name)
)
from table_acl_matrix
order by table_order, role_order, privilege_order;

select ok(
  to_regclass('private.provider_event_inbox') is not null
    and has_table_privilege('service_role', to_regclass('private.provider_event_inbox'), 'SELECT')
    and has_table_privilege('service_role', to_regclass('private.provider_event_inbox'), 'INSERT')
    and has_table_privilege('service_role', to_regclass('private.provider_event_inbox'), 'UPDATE')
    and not has_table_privilege('service_role', to_regclass('private.provider_event_inbox'), 'DELETE')
    and not has_table_privilege('service_role', to_regclass('private.provider_event_inbox'), 'TRUNCATE')
    and not has_table_privilege('service_role', to_regclass('private.provider_event_inbox'), 'REFERENCES')
    and not has_table_privilege('service_role', to_regclass('private.provider_event_inbox'), 'TRIGGER'),
  'service_role has only operational inbox privileges'
);
select ok(
  to_regclass('private.outbox_events') is not null
    and has_table_privilege('service_role', to_regclass('private.outbox_events'), 'SELECT')
    and has_table_privilege('service_role', to_regclass('private.outbox_events'), 'INSERT')
    and has_table_privilege('service_role', to_regclass('private.outbox_events'), 'UPDATE')
    and not has_table_privilege('service_role', to_regclass('private.outbox_events'), 'DELETE')
    and not has_table_privilege('service_role', to_regclass('private.outbox_events'), 'TRUNCATE')
    and not has_table_privilege('service_role', to_regclass('private.outbox_events'), 'REFERENCES')
    and not has_table_privilege('service_role', to_regclass('private.outbox_events'), 'TRIGGER'),
  'service_role has only operational outbox privileges'
);

select ok(
  not has_function_privilege('public', 'public.apply_mercadopago_payment_webhook(text,text,text,jsonb)', 'EXECUTE'),
  'PUBLIC cannot execute the legacy Mercado Pago webhook RPC'
);
select ok(
  not has_function_privilege('anon', 'public.apply_mercadopago_payment_webhook(text,text,text,jsonb)', 'EXECUTE'),
  'anon cannot execute the legacy Mercado Pago webhook RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.apply_mercadopago_payment_webhook(text,text,text,jsonb)', 'EXECUTE'),
  'authenticated cannot execute the legacy Mercado Pago webhook RPC'
);
select ok(
  not has_function_privilege('service_role', 'public.apply_mercadopago_payment_webhook(text,text,text,jsonb)', 'EXECUTE'),
  'service_role cannot execute the legacy Mercado Pago webhook RPC'
);

create temporary table expected_event_functions(signature text primary key) on commit drop;
insert into expected_event_functions(signature) values
  ('public.register_provider_event(text,text,text,text,text,jsonb,timestamp with time zone)'),
  ('public.claim_provider_events(text,integer,integer)'),
  ('public.ack_provider_event(uuid,uuid)'),
  ('public.fail_provider_event(uuid,uuid,text,timestamp with time zone)'),
  ('public.enqueue_outbox_event(text,text,uuid,text,uuid,text,text,jsonb)'),
  ('public.claim_outbox_events(text,integer,integer)'),
  ('public.ack_outbox_event(uuid,uuid,text)'),
  ('public.fail_outbox_event(uuid,uuid,text,timestamp with time zone)');

select ok(
  (select bool_and(to_regprocedure(signature) is not null) from expected_event_functions),
  'all event processing wrappers exist with stable signatures'
);
select ok(
  (select bool_and(
    to_regprocedure(signature) is not null
      and not has_function_privilege('anon', to_regprocedure(signature), 'EXECUTE')
  ) from expected_event_functions),
  'anon cannot execute event processing wrappers'
);
select ok(
  (select bool_and(
    to_regprocedure(signature) is not null
      and not has_function_privilege('authenticated', to_regprocedure(signature), 'EXECUTE')
  ) from expected_event_functions),
  'authenticated cannot execute event processing wrappers'
);
select ok(
  (select bool_and(
    to_regprocedure(signature) is not null
      and has_function_privilege('service_role', to_regprocedure(signature), 'EXECUTE')
  ) from expected_event_functions),
  'service_role can execute event processing wrappers'
);
select ok(
  (select bool_and(p.prosecdef = false)
     from expected_event_functions e
     join pg_catalog.pg_proc p on p.oid = to_regprocedure(e.signature)),
  'event processing wrappers are SECURITY INVOKER'
);
select ok(
  (select bool_and(
      p.proconfig is not null
        and array_to_string(p.proconfig, ',') in ('search_path=', 'search_path=""')
    )
     from expected_event_functions e
     join pg_catalog.pg_proc p on p.oid = to_regprocedure(e.signature)),
  'event processing wrappers use an empty search_path'
);
-- This verifies the locking primitive and bounded sweep in the stored definitions.
-- True multi-session contention remains an integration-test responsibility.
select ok(
  (select count(*) = 2
      and bool_and(
        regexp_count(lower(pg_get_functiondef(to_regprocedure(signature))), 'for\s+update\s+skip\s+locked') >= 2
        and regexp_count(lower(pg_get_functiondef(to_regprocedure(signature))), 'limit\s+p_batch_size') >= 2
      )
   from (values
     ('public.claim_provider_events(text,integer,integer)'),
     ('public.claim_outbox_events(text,integer,integer)')
   ) claim_functions(signature)),
  'both claim functions use SKIP LOCKED for bounded lease expiry and work claims'
);
select ok(
  to_regclass('private.provider_event_inbox') is not null
    and (select count(*) from pg_catalog.pg_constraint
         where conrelid = to_regclass('private.provider_event_inbox')
           and conname in (
             'provider_event_inbox_identity_key', 'provider_event_inbox_payload_object_check',
             'provider_event_inbox_attempts_check', 'provider_event_inbox_lease_check',
             'provider_event_inbox_terminal_check'
           )) = 5,
  'provider inbox has identity, payload, attempt, lease, and terminal constraints'
);
select ok(
  to_regclass('private.outbox_events') is not null
    and (select count(*) from pg_catalog.pg_constraint
         where conrelid = to_regclass('private.outbox_events')
           and conname in (
             'outbox_events_identity_key', 'outbox_events_channel_check',
             'outbox_events_payload_object_check', 'outbox_events_attempts_check',
             'outbox_events_lease_check', 'outbox_events_terminal_check'
           )) = 6,
  'outbox has identity, channel, payload, attempt, lease, and terminal constraints'
);

create temporary table event_behavior_results (
  ordinal integer primary key,
  passed boolean not null,
  description text not null
) on commit drop;

grant select on table expected_event_functions to service_role;
grant insert, select on table event_behavior_results to service_role;

set local role service_role;

do $test$
declare
  v_inbox_id uuid;
  v_duplicate_inbox_id uuid;
  v_outbox_id uuid;
  v_duplicate_outbox_id uuid;
  v_dead_outbox_id uuid;
  v_crashed_outbox_id uuid;
  v_crashed_inbox_id uuid;
  v_claim_token uuid;
  v_reclaim_token uuid;
  v_attempt_count integer;
  v_second_claim_id uuid;
  v_ok boolean;
  v_count bigint;
  v_marker text := 'pgtap-' || gen_random_uuid()::text;
begin
  if (select not bool_and(to_regprocedure(signature) is not null) from expected_event_functions) then
    insert into event_behavior_results
    select ordinal, false, description || ' (event functions are missing)'
    from (values
      (46, 'provider registration is idempotent'),
      (47, 'duplicate provider registration preserves the original payload'),
      (48, 'provider claim issues a token and increments attempts'),
      (49, 'a live provider lease cannot be claimed twice'),
      (50, 'a wrong provider claim token cannot acknowledge work'),
      (51, 'provider failure records error and releases the lease'),
      (52, 'provider retry receives a new token and increments attempts'),
      (53, 'a stale provider token cannot acknowledge reclaimed work'),
      (54, 'the current provider token acknowledges exactly once'),
      (55, 'outbox enqueue is idempotent'),
      (56, 'duplicate enqueue preserves the original payload'),
      (57, 'outbox claim issues a token and increments attempts'),
      (58, 'a live outbox lease cannot be claimed twice'),
      (59, 'a wrong outbox token cannot fail work'),
      (60, 'the current outbox token acknowledges and stores provider id'),
      (61, 'acknowledged outbox work cannot be acknowledged twice'),
      (62, 'exhausted outbox work is dead-lettered'),
      (63, 'an expired final-attempt lease is dead-lettered after a worker crash'),
      (64, 'an expired final-attempt inbox lease is dead-lettered after a worker crash')
    ) missing(ordinal, description);
    return;
  end if;

  execute 'select public.register_provider_event($1,$2,$3,$4,$5,$6,$7)'
    into v_inbox_id
    using 'test-provider', v_marker, 'payment', 'resource-' || v_marker,
      'payment.updated', jsonb_build_object('version', 1), now();
  execute 'select public.register_provider_event($1,$2,$3,$4,$5,$6,$7)'
    into v_duplicate_inbox_id
    using 'test-provider', v_marker, 'payment', 'resource-' || v_marker,
      'payment.updated', jsonb_build_object('version', 2), now();
  execute 'select count(*) from private.provider_event_inbox where provider = $1 and provider_event_id = $2'
    into v_count using 'test-provider', v_marker;
  insert into event_behavior_results values
    (46, v_inbox_id = v_duplicate_inbox_id and v_count = 1, 'provider registration is idempotent');

  execute 'select payload = $3 from private.provider_event_inbox where provider = $1 and provider_event_id = $2'
    into v_ok using 'test-provider', v_marker, jsonb_build_object('version', 1);
  insert into event_behavior_results values
    (47, coalesce(v_ok, false), 'duplicate provider registration preserves the original payload');

  execute 'select id, claim_token, attempt_count from public.claim_provider_events($1,$2,$3) where id = $4'
    into v_second_claim_id, v_claim_token, v_attempt_count
    using 'worker-a', 20, 120, v_inbox_id;
  insert into event_behavior_results values
    (48, v_second_claim_id = v_inbox_id and v_claim_token is not null and v_attempt_count = 1,
      'provider claim issues a token and increments attempts');

  v_second_claim_id := null;
  execute 'select id from public.claim_provider_events($1,$2,$3) where id = $4'
    into v_second_claim_id using 'worker-b', 20, 120, v_inbox_id;
  insert into event_behavior_results values
    (49, v_second_claim_id is null, 'a live provider lease cannot be claimed twice');

  execute 'select public.ack_provider_event($1,$2)' into v_ok using v_inbox_id, gen_random_uuid();
  insert into event_behavior_results values
    (50, not v_ok, 'a wrong provider claim token cannot acknowledge work');

  execute 'select public.fail_provider_event($1,$2,$3,$4)'
    into v_ok using v_inbox_id, v_claim_token, 'temporary failure', now() - interval '1 second';
  execute 'select $1 and claim_token is null and last_error = $2 from private.provider_event_inbox where id = $3'
    into v_ok using v_ok, 'temporary failure', v_inbox_id;
  insert into event_behavior_results values
    (51, coalesce(v_ok, false), 'provider failure records error and releases the lease');

  execute 'select claim_token, attempt_count from public.claim_provider_events($1,$2,$3) where id = $4'
    into v_reclaim_token, v_attempt_count using 'worker-b', 20, 120, v_inbox_id;
  insert into event_behavior_results values
    (52, v_reclaim_token is not null and v_reclaim_token <> v_claim_token and v_attempt_count = 2,
      'provider retry receives a new token and increments attempts');

  execute 'select public.ack_provider_event($1,$2)' into v_ok using v_inbox_id, v_claim_token;
  insert into event_behavior_results values
    (53, not v_ok, 'a stale provider token cannot acknowledge reclaimed work');

  execute 'select public.ack_provider_event($1,$2)' into v_ok using v_inbox_id, v_reclaim_token;
  execute 'select $1 and processed_at is not null and claim_token is null and last_error is null from private.provider_event_inbox where id = $2'
    into v_ok using v_ok, v_inbox_id;
  insert into event_behavior_results values
    (54, coalesce(v_ok, false), 'the current provider token acknowledges exactly once');

  execute 'select public.enqueue_outbox_event($1,$2,$3,$4,$5,$6,$7,$8)'
    into v_outbox_id
    using 'job.assigned', 'job', gen_random_uuid(), 'email', null::uuid,
      'customer@example.test', v_marker, jsonb_build_object('version', 1);
  execute 'select public.enqueue_outbox_event($1,$2,$3,$4,$5,$6,$7,$8)'
    into v_duplicate_outbox_id
    using 'job.assigned', 'job', gen_random_uuid(), 'email', null::uuid,
      'customer@example.test', v_marker, jsonb_build_object('version', 2);
  execute 'select count(*) from private.outbox_events where channel = $1 and recipient_key = $2 and dedupe_key = $3'
    into v_count using 'email', 'customer@example.test', v_marker;
  insert into event_behavior_results values
    (55, v_outbox_id = v_duplicate_outbox_id and v_count = 1, 'outbox enqueue is idempotent');

  execute 'select payload = $2 from private.outbox_events where id = $1'
    into v_ok using v_outbox_id, jsonb_build_object('version', 1);
  insert into event_behavior_results values
    (56, coalesce(v_ok, false), 'duplicate enqueue preserves the original payload');

  execute 'select id, claim_token, attempt_count from public.claim_outbox_events($1,$2,$3) where id = $4'
    into v_second_claim_id, v_claim_token, v_attempt_count
    using 'delivery-a', 20, 120, v_outbox_id;
  insert into event_behavior_results values
    (57, v_second_claim_id = v_outbox_id and v_claim_token is not null and v_attempt_count = 1,
      'outbox claim issues a token and increments attempts');

  v_second_claim_id := null;
  execute 'select id from public.claim_outbox_events($1,$2,$3) where id = $4'
    into v_second_claim_id using 'delivery-b', 20, 120, v_outbox_id;
  insert into event_behavior_results values
    (58, v_second_claim_id is null, 'a live outbox lease cannot be claimed twice');

  execute 'select public.fail_outbox_event($1,$2,$3,$4)'
    into v_ok using v_outbox_id, gen_random_uuid(), 'forged failure', now();
  insert into event_behavior_results values
    (59, not v_ok, 'a wrong outbox token cannot fail work');

  execute 'select public.ack_outbox_event($1,$2,$3)'
    into v_ok using v_outbox_id, v_claim_token, 'provider-message-' || v_marker;
  execute 'select $1 and processed_at is not null and provider_message_id = $2 from private.outbox_events where id = $3'
    into v_ok using v_ok, 'provider-message-' || v_marker, v_outbox_id;
  insert into event_behavior_results values
    (60, coalesce(v_ok, false), 'the current outbox token acknowledges and stores provider id');

  execute 'select public.ack_outbox_event($1,$2,$3)'
    into v_ok using v_outbox_id, v_claim_token, 'provider-message-' || v_marker;
  insert into event_behavior_results values
    (61, not v_ok, 'acknowledged outbox work cannot be acknowledged twice');

  execute 'select public.enqueue_outbox_event($1,$2,$3,$4,$5,$6,$7,$8)'
    into v_dead_outbox_id
    using 'job.dead-letter-test', 'job', gen_random_uuid(), 'in_app', null::uuid,
      'profile:' || v_marker, 'dead-' || v_marker, '{}'::jsonb;
  execute 'update private.outbox_events set max_attempts = 1 where id = $1' using v_dead_outbox_id;
  execute 'select claim_token from public.claim_outbox_events($1,$2,$3) where id = $4'
    into v_claim_token using 'delivery-dead', 20, 120, v_dead_outbox_id;
  execute 'select public.fail_outbox_event($1,$2,$3,$4)'
    into v_ok using v_dead_outbox_id, v_claim_token, 'permanent failure', now();
  execute 'select $1 and dead_lettered_at is not null and processed_at is null and last_error = $2 from private.outbox_events where id = $3'
    into v_ok using v_ok, 'permanent failure', v_dead_outbox_id;
  insert into event_behavior_results values
    (62, coalesce(v_ok, false), 'exhausted outbox work is dead-lettered');

  execute 'select public.enqueue_outbox_event($1,$2,$3,$4,$5,$6,$7,$8)'
    into v_crashed_outbox_id
    using 'job.worker-crash-test', 'job', gen_random_uuid(), 'in_app', null::uuid,
      'profile:' || v_marker, 'crash-' || v_marker, '{}'::jsonb;
  execute 'update private.outbox_events set max_attempts = 1 where id = $1' using v_crashed_outbox_id;
  execute 'select claim_token from public.claim_outbox_events($1,$2,$3) where id = $4'
    into v_claim_token using 'delivery-crashed', 20, 120, v_crashed_outbox_id;
  execute $sql$
    update private.outbox_events
    set locked_at = clock_timestamp() - interval '2 minutes',
        locked_until = clock_timestamp() - interval '1 minute'
    where id = $1
  $sql$ using v_crashed_outbox_id;
  v_second_claim_id := null;
  execute 'select id from public.claim_outbox_events($1,$2,$3) where id = $4'
    into v_second_claim_id using 'delivery-after-crash', 20, 120, v_crashed_outbox_id;
  execute $sql$
    select $1 is null
      and dead_lettered_at is not null
      and claim_token is null
      and last_error = 'lease expired after maximum attempts'
    from private.outbox_events
    where id = $2
  $sql$ into v_ok using v_second_claim_id, v_crashed_outbox_id;
  insert into event_behavior_results values
    (63, coalesce(v_ok, false), 'an expired final-attempt lease is dead-lettered after a worker crash');

  execute 'select public.register_provider_event($1,$2,$3,$4,$5,$6,$7)'
    into v_crashed_inbox_id
    using 'test-provider', 'crash-' || v_marker, 'payment', 'resource-crash-' || v_marker,
      'payment.updated', '{}'::jsonb, now();
  execute 'update private.provider_event_inbox set max_attempts = 1 where id = $1' using v_crashed_inbox_id;
  execute 'select claim_token from public.claim_provider_events($1,$2,$3) where id = $4'
    into v_claim_token using 'worker-crashed', 20, 120, v_crashed_inbox_id;
  execute $sql$
    update private.provider_event_inbox
    set locked_at = clock_timestamp() - interval '2 minutes',
        locked_until = clock_timestamp() - interval '1 minute'
    where id = $1
  $sql$ using v_crashed_inbox_id;
  v_second_claim_id := null;
  execute 'select id from public.claim_provider_events($1,$2,$3) where id = $4'
    into v_second_claim_id using 'worker-after-crash', 20, 120, v_crashed_inbox_id;
  execute $sql$
    select $1 is null
      and dead_lettered_at is not null
      and claim_token is null
      and last_error = 'lease expired after maximum attempts'
    from private.provider_event_inbox
    where id = $2
  $sql$ into v_ok using v_second_claim_id, v_crashed_inbox_id;
  insert into event_behavior_results values
    (64, coalesce(v_ok, false), 'an expired final-attempt inbox lease is dead-lettered after a worker crash');
end
$test$;

reset role;

select ok(passed, description)
from event_behavior_results
order by ordinal;

select * from finish();
rollback;
