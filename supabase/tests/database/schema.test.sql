begin;

select plan(42);

select ok(
  exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'admin_permission'
  ),
  'admin_permission enum exists'
);

select ok(
  to_regclass('private.admin_profile_permissions') is not null,
  'admin permissions live in a private control table'
);

select ok(
  to_regprocedure('private.current_app_role()') is not null,
  'trusted application role helper exists in private schema'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'has_admin_permission'
      and pg_get_function_identity_arguments(p.oid) = 'p_permission admin_permission'
  ),
  'admin permission helper exists in private schema'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_admin_permissions'
      and pg_get_function_identity_arguments(p.oid) = 'p_admin_profile_id uuid, p_permissions admin_permission[]'
  ),
  'owner-only permission management RPC exists'
);

select is(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ),
  0::bigint,
  'every public table has RLS enabled'
);

select is(
  (
    select count(*)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  ),
  0::bigint,
  'no security definer function remains in the exposed public schema'
);

select ok(
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.prosecdef
      and (
        p.proconfig is null
        or array_to_string(p.proconfig, ',') not like '%search_path=""%'
      )
  ),
  'all private security definer functions pin an empty search_path'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.apply_mercadopago_payment_webhook(text,text,text,jsonb)',
    'execute'
  ),
  'anon cannot execute the payment webhook RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_mercadopago_payment_webhook(text,text,text,jsonb)',
    'execute'
  ),
  'authenticated users cannot execute the payment webhook RPC'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.apply_mercadopago_payment_webhook(text,text,text,jsonb)',
    'execute'
  ),
  'legacy payment webhook RPC remains disabled for service_role until canonical verification exists'
);

select ok(
  not has_function_privilege('authenticated', 'public.current_user_role()', 'execute'),
  'legacy mutable-role helper is not executable by authenticated users'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.log_admin_action(text,text,uuid,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.log_admin_action(text,text,uuid,jsonb)',
    'execute'
  ),
  'legacy public admin logging RPC is not executable by API roles'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'update'),
  'authenticated users cannot update profiles.role'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'auth_user_id', 'update'),
  'authenticated users cannot update profiles.auth_user_id'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'email', 'update'),
  'authenticated users cannot update profiles.email directly'
);

select ok(
  not has_column_privilege('authenticated', 'public.job_final_reports', 'public_token', 'select'),
  'authenticated participants cannot read final report public tokens'
);

select ok(
  not has_column_privilege('authenticated', 'public.receipts', 'public_token', 'select'),
  'authenticated participants cannot read canonical receipt public tokens'
);

select ok(
  not has_table_privilege('anon', 'public.public_receipts', 'select')
  and not has_table_privilege('anon', 'public.receipts', 'select'),
  'anon cannot enumerate either receipt table'
);

select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private'
      and c.relname = 'admin_profile_permissions'
      and c.relrowsecurity
  ),
  'the private permission table uses RLS as defense in depth'
);

select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'public_receipt_view'
      and 'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[]))
  ),
  'public receipt view uses caller privileges'
);

select has_column('public', 'receipts', 'revoked_at', 'canonical receipts support revocation');

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'receipts'
      and column_name = 'expires_at'
      and is_nullable = 'NO'
      and column_default like '%90 days%'
  ),
  'canonical receipts expire after 90 days by default'
);

select ok(
  to_regclass('public.idx_job_media_job') is not null
  and to_regclass('public.idx_payments_customer') is not null
  and to_regclass('public.idx_payments_professional') is not null
  and to_regclass('public.idx_reviews_customer') is not null
  and to_regclass('public.idx_reviews_professional') is not null
  and to_regclass('public.idx_service_requests_address_customer') is not null
  and to_regclass('public.idx_service_requests_selected_price_request') is not null
  and to_regclass('public.idx_customer_equipment_address_customer') is not null
  and to_regclass('public.idx_service_requests_equipment_owner') is not null,
  'RLS participant foreign keys are indexed'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'service_requests_address_owner_fk')
  and exists (select 1 from pg_constraint where conname = 'service_requests_selected_price_owner_fk'),
  'service request ownership constraints prevent cross-customer references'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'jobs_request_customer_fk'),
  'job customer must match its service request customer'
);

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_requests'
      and column_name = 'equipment_id'
  )
  and exists (select 1 from pg_constraint where conname = 'service_requests_equipment_owner_fk'),
  'service requests link to an exact customer-owned equipment record'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'customer_equipment_address_owner_fk'),
  'customer equipment address must belong to the same customer'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'pricing_rules_base_price_nonnegative')
  and exists (select 1 from pg_constraint where conname = 'pricing_rules_effective_price_nonnegative')
  and exists (select 1 from pg_constraint where conname = 'pricing_rules_priority_multiplier_bounds')
  and exists (select 1 from pg_constraint where conname = 'pricing_rules_platform_fee_rate_bounds'),
  'pricing rules enforce safe monetary and rate bounds'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'price_options_financials_consistent'),
  'price option splits are nonnegative and consistent with amount'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'payments_financials_consistent'),
  'payment splits are nonnegative and consistent with amount'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'payout_records_amount_nonnegative')
  and exists (select 1 from pg_constraint where conname = 'jobs_final_amount_nonnegative'),
  'payout and final job amounts cannot be negative'
);

select ok(
  to_regclass('private.payment_refund_requests') is not null
  and exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'request_payment_refund'
      and pg_get_function_identity_arguments(p.oid) = 'p_payment_id uuid, p_amount numeric, p_reason text, p_idempotency_key text'
  )
  and to_regprocedure('public.claim_payment_refund_requests(integer,integer)') is not null
  and to_regprocedure('public.finalize_payment_refund_request(uuid,uuid,text)') is not null
  and to_regprocedure('public.fail_payment_refund_request(uuid,uuid,text,boolean,integer)') is not null,
  'durable refund queue and its Finance/provider worker RPCs exist'
);

select ok(
  exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private'
      and c.relname = 'payment_refund_requests'
      and c.relrowsecurity
      and c.relforcerowsecurity
  )
  and not has_table_privilege('authenticated', 'private.payment_refund_requests', 'select')
  and not has_table_privilege('authenticated', 'private.payment_refund_requests', 'insert')
  and not has_table_privilege('authenticated', 'private.payment_refund_requests', 'update')
  and not has_table_privilege('service_role', 'private.payment_refund_requests', 'select')
  and not has_table_privilege('service_role', 'private.payment_refund_requests', 'insert')
  and not has_table_privilege('service_role', 'private.payment_refund_requests', 'update'),
  'refund requests are private and unavailable for direct API table access'
);

select ok(
  exists (select 1 from pg_constraint where conname = 'payment_refund_requests_amount_positive')
  and exists (select 1 from pg_constraint where conname = 'payment_refund_requests_reason_nonempty')
  and exists (select 1 from pg_constraint where conname = 'payment_refund_requests_idempotency_key_unique')
  and exists (select 1 from pg_constraint where conname = 'payment_refund_requests_provider_reference_unique')
  and exists (select 1 from pg_constraint where conname = 'payment_refund_requests_attempt_count_nonnegative')
  and exists (select 1 from pg_constraint where conname = 'payment_refund_requests_state_shape'),
  'refund requests enforce money, idempotency, provider reference and state invariants'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.request_payment_refund(uuid,numeric,text,text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.request_payment_refund(uuid,numeric,text,text)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'public.request_payment_refund(uuid,numeric,text,text)',
    'execute'
  ),
  'refund initiation is exposed only to authenticated actors and validates Finance or Owner internally'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_payment_refund_requests(integer,integer)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.finalize_payment_refund_request(uuid,uuid,text)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.fail_payment_refund_request(uuid,uuid,text,boolean,integer)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.claim_payment_refund_requests(integer,integer)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.finalize_payment_refund_request(uuid,uuid,text)',
    'execute'
  )
  and position(
    'for update of prr, p skip locked' in lower(pg_get_functiondef(
      'private.claim_payment_refund_requests(integer,integer)'::regprocedure
    ))
  ) > 0
  and position(
    'limit p_batch_size' in lower(pg_get_functiondef(
      'private.claim_payment_refund_requests(integer,integer)'::regprocedure
    ))
  ) > 0,
  'only service_role can claim or finalize refund work through public wrappers'
);

select ok(
  exists (
    select 1
    from pg_index i
    where i.indexrelid = 'private.payment_refund_requests_requested_claim_idx'::regclass
      and pg_get_indexdef(i.indexrelid) like '%(requested_at, id)%'
      and pg_get_expr(i.indpred, i.indrelid) = '(status = ''requested''::private.payment_refund_status)'
  )
  and exists (
    select 1
    from pg_index i
    where i.indexrelid = 'private.payment_refund_requests_processing_claim_idx'::regclass
      and pg_get_indexdef(i.indexrelid) like '%(locked_until, requested_at, id)%'
      and pg_get_expr(i.indpred, i.indrelid) = '(status = ''processing''::private.payment_refund_status)'
  ),
  'refund claims have partial indexes for requested work and expired processing leases'
);

select ok(
  not exists (
    select 1
    from pg_constraint c
    where c.conname in (
      'pricing_rules_base_price_nonnegative',
      'pricing_rules_effective_price_nonnegative',
      'pricing_rules_priority_multiplier_bounds',
      'pricing_rules_platform_fee_rate_bounds',
      'price_options_financials_consistent',
      'payments_financials_consistent',
      'payout_records_amount_nonnegative',
      'jobs_final_amount_nonnegative',
      'payment_refund_requests_amount_positive'
    )
      and (
        position('NaN' in pg_get_constraintdef(c.oid)) = 0
        or position('Infinity' in pg_get_constraintdef(c.oid)) = 0
        or position('-Infinity' in pg_get_constraintdef(c.oid)) = 0
      )
  ),
  'all monetary and rate constraints explicitly reject non-finite numeric values'
);

select ok(
  position(
    'pg_advisory_xact_lock' in pg_get_functiondef(
      'private.set_admin_permissions(uuid,public.admin_permission[])'::regprocedure
    )
  ) > 0,
  'admin permission changes serialize the last-owner invariant with a transaction advisory lock'
);

select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'lookup_public_receipt'
      and pg_get_function_identity_arguments(p.oid) = 'p_token uuid'
  ),
  'server-only canonical receipt lookup exists'
);

select ok(
  coalesce(
    (
      select not has_function_privilege('anon', p.oid, 'execute')
        and not has_function_privilege('authenticated', p.oid, 'execute')
        and has_function_privilege('service_role', p.oid, 'execute')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'lookup_public_receipt'
        and pg_get_function_identity_arguments(p.oid) = 'p_token uuid'
    ),
    false
  ),
  'only service_role can execute the canonical receipt lookup'
);

select * from finish();
rollback;
