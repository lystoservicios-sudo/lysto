begin;

\ir ../fixtures/session.sql.inc


select plan(61);

create function pg_temp.set_jwt(p_uid uuid, p_user_metadata jsonb default '{}'::jsonb)
returns void
language sql
as $$
  select pg_temp.fixture_set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_uid::text,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('app_role', 'admin'),
      'user_metadata', p_user_metadata
    )::text,
    true
  )::text;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'operations@lysto.test', '', now(), '{"app_role":"admin"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'finance@lysto.test', '', now(), '{"app_role":"admin"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'quality@lysto.test', '', now(), '{"app_role":"admin"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'owner@lysto.test', '', now(), '{"app_role":"admin"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'no-permission@lysto.test', '', now(), '{"app_role":"admin"}', '{"permissions":["owner"]}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'admin-professional@lysto.test', '', now(), '{"app_role":"professional"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'admin-customer@lysto.test', '', now(), '{"app_role":"customer"}', '{}', now(), now());

insert into public.profiles (id, auth_user_id, role, first_name, last_name, email)
values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'admin', 'Operations', 'Admin', 'operations@lysto.test'),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'admin', 'Finance', 'Admin', 'finance@lysto.test'),
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'admin', 'Quality', 'Admin', 'quality@lysto.test'),
  ('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 'admin', 'Owner', 'Admin', 'owner@lysto.test'),
  ('31000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000005', 'admin', 'No permission', 'Admin', 'no-permission@lysto.test'),
  ('31000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000006', 'professional', 'Candidate', 'Professional', 'admin-professional@lysto.test'),
  ('31000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000007', 'customer', 'Admin', 'Customer', 'admin-customer@lysto.test');

insert into public.admin_profiles (id, profile_id)
values
  ('32000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001'),
  ('32000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002'),
  ('32000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000003'),
  ('32000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000004'),
  ('32000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000005');

insert into public.professional_profiles (id, profile_id, status)
values ('33000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000006', 'approved');

insert into public.professional_payment_accounts (
  id, professional_id, provider_user_id, access_token_encrypted, refresh_token_encrypted, status
)
values (
  '34000000-0000-0000-0000-000000000001',
  '33000000-0000-0000-0000-000000000001',
  'provider-user',
  'encrypted-access-token',
  'encrypted-refresh-token',
  'connected'
);

insert into public.professional_documents (
  id, professional_id, document_type, storage_bucket, storage_path
)
values (
  '34000000-0000-0000-0000-000000000002',
  '33000000-0000-0000-0000-000000000001',
  'dni',
  'professional-documents',
  'review-target/dni.pdf'
);

insert into public.customer_profiles (id, profile_id)
values ('35000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000007');

insert into public.service_categories (id, slug, name)
values ('36000000-0000-0000-0000-000000000001', 'rls-admin-category', 'RLS admin category');

insert into public.service_issue_types (id, category_id, slug, name)
values ('36000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'rls-admin-issue', 'RLS admin issue');

insert into public.pricing_rules (
  id, category_id, issue_type_id, zone_slug, base_price, issue_adjustment,
  priority_multiplier, platform_fee_rate
)
values (
  '36000000-0000-0000-0000-000000000003',
  '36000000-0000-0000-0000-000000000001',
  '36000000-0000-0000-0000-000000000002',
  'caba',
  10000,
  0,
  1.5,
  0.18
);

insert into public.service_requests (id, customer_id, category_id, issue_type_id, status)
values ('37000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000002', 'pending_assignment');

insert into public.jobs (id, request_id, customer_id, status)
values ('38000000-0000-0000-0000-000000000001', '37000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'pending_assignment');

insert into public.payments (
  id, request_id, customer_id, provider, provider_payment_id, status,
  amount, marketplace_fee, professional_amount
)
values
  ('39000000-0000-0000-0000-000000000001', '37000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'mercadopago', 'rls-admin-payment-approved', 'approved', 5000, 900, 4100),
  ('39000000-0000-0000-0000-000000000002', '37000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'mercadopago', 'rls-admin-payment-pending', 'pending', 5000, 900, 4100),
  ('39000000-0000-0000-0000-000000000003', '37000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'mercadopago', 'rls-admin-payment-rejected', 'rejected', 5000, 900, 4100),
  ('39000000-0000-0000-0000-000000000004', '37000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'other-provider', 'rls-admin-payment-other', 'approved', 5000, 900, 4100),
  ('39000000-0000-0000-0000-000000000005', '37000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', 'mercadopago', null, 'approved', 5000, 900, 4100);

insert into public.platform_settings (key, value, description)
values
  ('marketplace', '{"fee_rate":0.18}'::jsonb, 'Finance-owned setting'),
  ('operations.dispatch_sla', '30'::jsonb, 'Operations-owned setting'),
  ('quality.review_threshold', '2'::jsonb, 'Quality-owned setting')
on conflict (key) do update
set value = excluded.value,
    description = excluded.description;

insert into public.complaints (id, job_id, customer_id, professional_id, description)
values ('3a000000-0000-0000-0000-000000000001', '38000000-0000-0000-0000-000000000001', '35000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000001', 'Caso de calidad');

do $$
begin
  if to_regclass('private.admin_profile_permissions') is not null then
    execute $sql$
      insert into private.admin_profile_permissions (admin_profile_id, permission, granted_by_admin_profile_id)
      values
        ('32000000-0000-0000-0000-000000000001', 'operations', '32000000-0000-0000-0000-000000000004'),
        ('32000000-0000-0000-0000-000000000002', 'finance', '32000000-0000-0000-0000-000000000004'),
        ('32000000-0000-0000-0000-000000000003', 'quality', '32000000-0000-0000-0000-000000000004'),
        ('32000000-0000-0000-0000-000000000004', 'owner', '32000000-0000-0000-0000-000000000004')
    $sql$;
  end if;
end;
$$;

select pg_temp.set_jwt('30000000-0000-0000-0000-000000000001');
set local role authenticated;

select is((select count(*) from public.professional_profiles), 1::bigint, 'operations admin can read professional records');

select throws_ok(
  $$update public.professional_profiles set status = 'under_review' where id = '33000000-0000-0000-0000-000000000001' returning id$$,
  '42501', null,
  'operations admin must use the versioned review workflow to change approval state'
);

select throws_ok(
  $$update public.professional_documents set reviewed_by = '31000000-0000-0000-0000-000000000002' where id = '34000000-0000-0000-0000-000000000002'$$,
  '42501',
  null,
  'operations admin cannot forge document reviewer identity'
);

select throws_ok(
  $$update public.professional_documents set status = 'approved' where id = '34000000-0000-0000-0000-000000000002' returning reviewed_by$$,
  '42501', null,
  'document approval must use the attributed review RPC'
);

select ok(
  not has_column_privilege('authenticated', 'public.professional_payment_accounts', 'access_token_encrypted', 'select')
  and not has_column_privilege('authenticated', 'public.professional_payment_accounts', 'refresh_token_encrypted', 'select'),
  'operations admin cannot read provider secrets'
);

select results_eq(
  $$update public.platform_settings set value = '{"fee_rate":0.99}'::jsonb where key = 'marketplace' returning key$$,
  $$select key from public.platform_settings where false$$,
  'operations admin cannot update finance settings'
);

select throws_ok(
  $$select public.assign_professional_to_job(
    '38000000-0000-0000-0000-000000000001',
    '37000000-0000-0000-0000-000000000001',
    '33000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000002'
  )$$,
  'P0001',
  null,
  'admin RPC cannot forge its audit actor'
);

select throws_ok(
  $$select public.request_payment_refund(
    '39000000-0000-0000-0000-000000000001',
    100,
    'Operations cannot refund',
    'operations-refund-attempt-0001'
  )$$,
  'P0001',
  'Finance permission required',
  'operations admin cannot initiate a refund request'
);

reset role;
select pg_temp.set_jwt('30000000-0000-0000-0000-000000000002');
set local role authenticated;

select is((select count(*) from public.payments), 5::bigint, 'finance admin can read payment records');

select throws_ok(
  $$update public.pricing_rules
    set base_price = 'NaN'::numeric
    where id = '36000000-0000-0000-0000-000000000003'$$,
  '23514',
  null,
  'pricing base amount rejects NaN'
);

select throws_ok(
  $$update public.pricing_rules
    set priority_multiplier = 'Infinity'::numeric
    where id = '36000000-0000-0000-0000-000000000003'$$,
  '22003',
  null,
  'pricing multiplier rejects positive infinity'
);
select throws_ok(
  $$update public.professional_profiles set status = 'suspended' where id = '33000000-0000-0000-0000-000000000001' returning id$$,
  '42501', null,
  'finance admin cannot approve or suspend professionals'
);

select results_eq(
  $$update public.platform_settings set value = '10'::jsonb where key = 'operations.dispatch_sla' returning key$$,
  $$select key from public.platform_settings where false$$,
  'finance admin cannot change operations settings'
);

select results_eq(
  $$update public.platform_settings set value = '{"fee_rate":0.19}'::jsonb where key = 'marketplace' returning updated_by$$,
  $$values ('31000000-0000-0000-0000-000000000002'::uuid)$$,
  'finance settings derive updated_by from the authenticated actor'
);

select throws_ok(
  $$update public.platform_settings set updated_by = '31000000-0000-0000-0000-000000000001' where key = 'marketplace'$$,
  '42501',
  null,
  'finance admin cannot forge platform setting actor identity'
);

select throws_ok(
  $$update public.payments set status = 'refunded' where id = '39000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'finance cannot mutate payment state directly before canonical provider confirmation exists'
);

select throws_ok(
  $$select public.request_payment_refund(
    '39000000-0000-0000-0000-000000000002', 100, 'Pago pendiente', 'pending-refund-attempt'
  )$$,
  'P0001',
  'Payment is not eligible for Mercado Pago refund',
  'finance cannot refund a pending payment'
);

select throws_ok(
  $$select public.request_payment_refund(
    '39000000-0000-0000-0000-000000000003', 100, 'Pago rechazado', 'rejected-refund-attempt'
  )$$,
  'P0001',
  'Payment is not eligible for Mercado Pago refund',
  'finance cannot refund a rejected payment'
);

select throws_ok(
  $$select public.request_payment_refund(
    '39000000-0000-0000-0000-000000000004', 100, 'Proveedor incorrecto', 'other-provider-refund-attempt'
  )$$,
  'P0001',
  'Payment is not eligible for Mercado Pago refund',
  'finance cannot refund a payment from another provider'
);

select throws_ok(
  $$select public.request_payment_refund(
    '39000000-0000-0000-0000-000000000005', 100, 'Sin id de proveedor', 'missing-provider-id-refund-attempt'
  )$$,
  'P0001',
  'Payment is not eligible for Mercado Pago refund',
  'finance cannot refund without a canonical provider payment id'
);

select pg_temp.fixture_set_config(
  'test.refund_request',
  public.request_payment_refund(
    '39000000-0000-0000-0000-000000000001',
    1200,
    'Devolución solicitada por conciliación',
    'finance-refund-request-0001'
  )::text,
  true
);

select is(
  current_setting('test.refund_request', true)::jsonb ->> 'status',
  'requested',
  'finance can create a durable refund request without changing payment state'
);

select ok(
  (
    public.request_payment_refund(
      '39000000-0000-0000-0000-000000000001',
      1200,
      'Devolución solicitada por conciliación',
      'finance-refund-request-0001'
    ) ->> 'id'
  ) = (current_setting('test.refund_request', true)::jsonb ->> 'id')
  and (
    public.request_payment_refund(
      '39000000-0000-0000-0000-000000000001',
      1200,
      'Devolución solicitada por conciliación',
      'finance-refund-request-0001'
    ) ->> 'idempotent'
  )::boolean,
  'repeating the same refund idempotency key returns the original request'
);

select pg_temp.fixture_set_config(
  'test.refund_request_two',
  public.request_payment_refund(
    '39000000-0000-0000-0000-000000000001',
    200,
    'Segunda devolución para probar falla del worker',
    'finance-refund-request-0002'
  )::text,
  true
);

select is(
  current_setting('test.refund_request_two', true)::jsonb ->> 'status',
  'requested',
  'finance can queue a second refund within the unrefunded balance'
);

select throws_ok(
  $$select public.request_payment_refund(
    '39000000-0000-0000-0000-000000000001',
    6000,
    'Monto mayor al pago',
    'finance-refund-request-invalid-amount'
  )$$,
  'P0001',
  'Refund amount must be positive and not exceed payment amount',
  'finance cannot request more than the payment amount'
);

select throws_ok(
  $$select public.request_payment_refund(
    '39000000-0000-0000-0000-000000000001',
    0,
    'Monto inválido',
    'finance-refund-request-zero-amount'
  )$$,
  'P0001',
  'Refund amount must be positive and not exceed payment amount',
  'finance cannot request a zero refund amount'
);

select throws_ok(
  $$select public.request_payment_refund(
    '39000000-0000-0000-0000-000000000001',
    1200.001,
    'Escala monetaria inválida',
    'finance-refund-request-invalid-scale'
  )$$,
  'P0001',
  'Refund amount must have at most two decimal places',
  'finance refund amount rejects precision beyond currency scale'
);

select throws_ok(
  $$select public.request_payment_refund(
    '39000000-0000-0000-0000-000000000001',
    100,
    ' ',
    'finance-refund-request-invalid-reason'
  )$$,
  'P0001',
  'Refund reason required',
  'finance refund request requires a reason'
);

select throws_ok(
  $$select count(*) from private.payment_refund_requests$$,
  '42501',
  null,
  'finance cannot query the private refund control table directly'
);

reset role;

select ok(
  exists (
    select 1
    from private.payment_refund_requests prr
    where prr.id = (current_setting('test.refund_request', true)::jsonb ->> 'id')::uuid
      and prr.requested_by = '31000000-0000-0000-0000-000000000002'
      and prr.status = 'requested'
  )
  and (
    select p.status = 'approved'
    from public.payments p
    where p.id = '39000000-0000-0000-0000-000000000001'
  )
  and exists (
    select 1
    from public.admin_audit_logs aal
    where aal.action = 'payment.refund.requested'
      and aal.entity_type = 'payment_refund_request'
      and aal.entity_id = (current_setting('test.refund_request', true)::jsonb ->> 'id')::uuid
      and aal.actor_profile_id = '31000000-0000-0000-0000-000000000002'
      and aal.metadata ->> 'payment_id' = '39000000-0000-0000-0000-000000000001'
  ),
  'refund request derives actor identity and leaves the payment row immutable'
);

insert into private.payment_refund_requests (
  payment_id, amount, reason, idempotency_key, requested_by
)
values
  ('39000000-0000-0000-0000-000000000002', 100, 'Pending fixture', 'worker-ineligible-pending', '31000000-0000-0000-0000-000000000002'),
  ('39000000-0000-0000-0000-000000000003', 100, 'Rejected fixture', 'worker-ineligible-rejected', '31000000-0000-0000-0000-000000000002'),
  ('39000000-0000-0000-0000-000000000004', 100, 'Provider fixture', 'worker-ineligible-provider', '31000000-0000-0000-0000-000000000002'),
  ('39000000-0000-0000-0000-000000000005', 100, 'Provider id fixture', 'worker-ineligible-provider-id', '31000000-0000-0000-0000-000000000002');

select pg_temp.fixture_set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select throws_ok(
  $$update private.payment_refund_requests set status = 'processing' where idempotency_key = 'finance-refund-request-0001'$$,
  '42501',
  null,
  'service_role cannot mutate the private refund queue directly'
);

select pg_temp.fixture_set_config(
  'test.refund_claim_one',
  (
    select to_jsonb(claimed)::text
    from public.claim_payment_refund_requests(1, 300) claimed
  ),
  true
);

select ok(
  (current_setting('test.refund_claim_one', true)::jsonb ->> 'claim_token') is not null
  and (current_setting('test.refund_claim_one', true)::jsonb ->> 'attempt_count')::integer = 1
  and current_setting('test.refund_claim_one', true)::jsonb ->> 'status' = 'processing'
  and current_setting('test.refund_claim_one', true)::jsonb ->> 'provider_idempotency_key'
    = current_setting('test.refund_claim_one', true)::jsonb ->> 'request_id'
  and (current_setting('test.refund_claim_one', true)::jsonb ->> 'locked_until')::timestamptz > now(),
  'service worker claims one eligible refund with a stable provider idempotency key'
);

reset role;
update public.payments
set status = 'rejected'
where id = '39000000-0000-0000-0000-000000000001';
select pg_temp.fixture_set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select throws_ok(
  $$select public.finalize_payment_refund_request(
    (current_setting('test.refund_claim_one', true)::jsonb ->> 'request_id')::uuid,
    (current_setting('test.refund_claim_one', true)::jsonb ->> 'claim_token')::uuid,
    'mp-refund-revalidation'
  )$$,
  'P0001',
  'Payment is no longer eligible for Mercado Pago refund',
  'refund finalization revalidates canonical payment eligibility'
);

reset role;
update public.payments
set status = 'approved'
where id = '39000000-0000-0000-0000-000000000001';
select pg_temp.fixture_set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select throws_ok(
  $$select public.finalize_payment_refund_request(
    (current_setting('test.refund_claim_one', true)::jsonb ->> 'request_id')::uuid,
    (current_setting('test.refund_claim_one', true)::jsonb ->> 'claim_token')::uuid,
    ' '
  )$$,
  'P0001',
  'Provider refund reference required',
  'worker cannot mark a refund succeeded without a provider reference'
);

select pg_temp.fixture_set_config(
  'test.refund_finalized',
  public.finalize_payment_refund_request(
    (current_setting('test.refund_claim_one', true)::jsonb ->> 'request_id')::uuid,
    (current_setting('test.refund_claim_one', true)::jsonb ->> 'claim_token')::uuid,
    'mp-refund-success-0001'
  )::text,
  true
);

select ok(
  current_setting('test.refund_finalized', true)::jsonb ->> 'status' = 'succeeded'
  and not (current_setting('test.refund_finalized', true)::jsonb ->> 'idempotent')::boolean,
  'first provider-confirmed refund finalization reports a non-replay success'
);

select pg_temp.fixture_set_config(
  'test.refund_finalize_replay',
  public.finalize_payment_refund_request(
    (current_setting('test.refund_claim_one', true)::jsonb ->> 'request_id')::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    '  mp-refund-success-0001  '
  )::text,
  true
);

select ok(
  current_setting('test.refund_finalize_replay', true)::jsonb ->> 'id'
    = current_setting('test.refund_finalized', true)::jsonb ->> 'id'
  and current_setting('test.refund_finalize_replay', true)::jsonb ->> 'status' = 'succeeded'
  and (current_setting('test.refund_finalize_replay', true)::jsonb ->> 'idempotent')::boolean,
  'lost finalize response can be replayed without the original active claim'
);

select throws_ok(
  $$select public.finalize_payment_refund_request(
    (current_setting('test.refund_claim_one', true)::jsonb ->> 'request_id')::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'mp-refund-conflicting-reference'
  )$$,
  'P0001',
  'Refund provider reference conflict',
  'finalize replay rejects a different provider refund reference'
);

select throws_ok(
  $$select public.fail_payment_refund_request(
    (current_setting('test.refund_claim_one', true)::jsonb ->> 'request_id')::uuid,
    (current_setting('test.refund_claim_one', true)::jsonb ->> 'claim_token')::uuid,
    'late worker result',
    true,
    0
  )$$,
  'P0001',
  'Refund claim is stale or expired',
  'a finalized claim token cannot overwrite a terminal outcome'
);

select pg_temp.fixture_set_config(
  'test.refund_claim_two',
  (
    select to_jsonb(claimed)::text
    from public.claim_payment_refund_requests(1, 300) claimed
  ),
  true
);

select ok(
  (current_setting('test.refund_claim_two', true)::jsonb ->> 'request_id')::uuid
    <> (current_setting('test.refund_claim_one', true)::jsonb ->> 'request_id')::uuid
  and (current_setting('test.refund_claim_two', true)::jsonb ->> 'attempt_count')::integer = 1
  and current_setting('test.refund_claim_two', true)::jsonb ->> 'provider_idempotency_key'
    = current_setting('test.refund_claim_two', true)::jsonb ->> 'request_id',
  'the next worker claim does not reclaim an active or terminal request'
);

select throws_ok(
  $$select public.fail_payment_refund_request(
    (current_setting('test.refund_claim_two', true)::jsonb ->> 'request_id')::uuid,
    (current_setting('test.refund_claim_two', true)::jsonb ->> 'claim_token')::uuid,
    ' ',
    true,
    0
  )$$,
  'P0001',
  'Refund failure reason required',
  'worker cannot fail a refund without a reason'
);

select throws_ok(
  $$select public.fail_payment_refund_request(
    (current_setting('test.refund_claim_two', true)::jsonb ->> 'request_id')::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'wrong worker token',
    true,
    0
  )$$,
  'P0001',
  'Refund claim is stale or expired',
  'claim fencing rejects a different worker token'
);

select pg_temp.fixture_set_config(
  'test.refund_ambiguous',
  public.fail_payment_refund_request(
    (current_setting('test.refund_claim_two', true)::jsonb ->> 'request_id')::uuid,
    (current_setting('test.refund_claim_two', true)::jsonb ->> 'claim_token')::uuid,
    'Provider timeout with unknown outcome',
    false,
    0
  )::text,
  true
);

select is(
  current_setting('test.refund_ambiguous', true)::jsonb ->> 'status',
  'processing',
  'an ambiguous provider timeout remains non-terminal and retryable'
);

reset role;

select ok(
  exists (
    select 1
    from private.payment_refund_requests prr
    where prr.id = (current_setting('test.refund_claim_two', true)::jsonb ->> 'request_id')::uuid
      and prr.status = 'processing'
      and prr.last_error = 'Provider timeout with unknown outcome'
      and prr.claim_token <> (current_setting('test.refund_claim_two', true)::jsonb ->> 'claim_token')::uuid
      and prr.locked_until <= clock_timestamp()
  )
  and (
    select sum(prr.amount) = 1400
    from private.payment_refund_requests prr
    where prr.payment_id = '39000000-0000-0000-0000-000000000001'
      and prr.status in ('requested', 'processing', 'succeeded')
  ),
  'ambiguous failure invalidates the worker token and keeps the refund amount reserved'
);

select pg_temp.fixture_set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

select throws_ok(
  $$select public.finalize_payment_refund_request(
    (current_setting('test.refund_claim_two', true)::jsonb ->> 'request_id')::uuid,
    (current_setting('test.refund_claim_two', true)::jsonb ->> 'claim_token')::uuid,
    'late-success-from-expired-worker'
  )$$,
  'P0001',
  'Refund claim is stale or expired',
  'ambiguous failure fences the previous worker token immediately'
);

select pg_temp.fixture_set_config(
  'test.refund_claim_two_retry',
  (
    select to_jsonb(claimed)::text
    from public.claim_payment_refund_requests(1, 300) claimed
  ),
  true
);

select ok(
  current_setting('test.refund_claim_two_retry', true)::jsonb ->> 'request_id'
    = current_setting('test.refund_claim_two', true)::jsonb ->> 'request_id'
  and current_setting('test.refund_claim_two_retry', true)::jsonb ->> 'provider_idempotency_key'
    = current_setting('test.refund_claim_two', true)::jsonb ->> 'provider_idempotency_key'
  and current_setting('test.refund_claim_two_retry', true)::jsonb ->> 'claim_token'
    <> current_setting('test.refund_claim_two', true)::jsonb ->> 'claim_token'
  and (current_setting('test.refund_claim_two_retry', true)::jsonb ->> 'attempt_count')::integer = 2,
  'expired lease reclaim rotates the fencing token but preserves provider idempotency'
);

select pg_temp.fixture_set_config(
  'test.refund_failed',
  public.fail_payment_refund_request(
    (current_setting('test.refund_claim_two_retry', true)::jsonb ->> 'request_id')::uuid,
    (current_setting('test.refund_claim_two_retry', true)::jsonb ->> 'claim_token')::uuid,
    'Provider rejected the refund',
    true,
    0
  )::text,
  true
);

select is(
  current_setting('test.refund_failed', true)::jsonb ->> 'status',
  'failed',
  'a definitive provider failure becomes terminal and releases its reservation'
);

select is(
  (select count(*) from public.claim_payment_refund_requests(10, 300)),
  0::bigint,
  'claiming revalidates payment status, provider and provider payment id'
);

reset role;

select throws_ok(
  $$update private.payment_refund_requests
    set status = 'succeeded'
    where idempotency_key = 'worker-ineligible-pending'$$,
  'P0001',
  'Invalid refund request state transition',
  'database transition guard rejects fabricated terminal success'
);

select ok(
  exists (
    select 1
    from private.payment_refund_requests prr
    where prr.id = (current_setting('test.refund_claim_one', true)::jsonb ->> 'request_id')::uuid
      and prr.status = 'succeeded'
      and prr.provider_reference = 'mp-refund-success-0001'
      and prr.processed_at is not null
      and prr.processing_started_at is not null
      and prr.locked_until is null
  )
  and exists (
    select 1
    from private.payment_refund_requests prr
    where prr.id = (current_setting('test.refund_claim_two', true)::jsonb ->> 'request_id')::uuid
      and prr.status = 'failed'
      and prr.failure_reason = 'Provider rejected the refund'
      and prr.processed_at is not null
      and prr.locked_until is null
  )
  and (
    select count(*) = 4
    from private.payment_refund_requests prr
    where prr.idempotency_key like 'worker-ineligible-%'
      and prr.status = 'requested'
  )
  and (
    select p.status = 'approved'
    from public.payments p
    where p.id = '39000000-0000-0000-0000-000000000001'
  )
  and (
    select sum(prr.amount)
    from private.payment_refund_requests prr
    where prr.payment_id = '39000000-0000-0000-0000-000000000001'
      and prr.status in ('requested', 'processing', 'succeeded')
  ) = (
    select prr.amount
    from private.payment_refund_requests prr
    where prr.id = (current_setting('test.refund_claim_one', true)::jsonb ->> 'request_id')::uuid
  )
  and (
    select count(*) = 1
    from public.admin_audit_logs aal
    where aal.action = 'payment.refund.succeeded'
      and aal.entity_id = (current_setting('test.refund_claim_one', true)::jsonb ->> 'request_id')::uuid
  ),
  'terminal states carry evidence, release definitive failures, avoid duplicate audit and never mutate payment'
);

select pg_temp.set_jwt('30000000-0000-0000-0000-000000000003');
set local role authenticated;

select is(
  (select count(*) from public.professional_profiles),
  0::bigint,
  'quality admin cannot read professional identity and approval records'
);

select results_eq(
  $$update public.complaints set status = 'in_review' where id = '3a000000-0000-0000-0000-000000000001' returning id$$,
  $$values ('3a000000-0000-0000-0000-000000000001'::uuid)$$,
  'quality admin can operate quality cases'
);

reset role;
select pg_temp.set_jwt('30000000-0000-0000-0000-000000000005', '{"permissions":["owner"]}'::jsonb);
set local role authenticated;

select is((select count(*) from public.platform_settings), 0::bigint, 'user_metadata cannot grant owner permission');

reset role;
select pg_temp.set_jwt('30000000-0000-0000-0000-000000000004');
set local role authenticated;

select lives_ok(
  $$select public.change_admin_permissions(
    '32000000-0000-0000-0000-000000000001',
    (select permissions_version from public.admin_profiles where id='32000000-0000-0000-0000-000000000001'),
    array['operations','quality']::public.admin_permission[],
    'Responsable de operaciones y calidad'
  )$$,
  'owner can manage admin permissions through the audited RPC'
);

select throws_ok(
  $$select public.change_admin_permissions(
    '32000000-0000-0000-0000-000000000004',
    (select permissions_version from public.admin_profiles where id='32000000-0000-0000-0000-000000000004'),
    array[]::public.admin_permission[],
    'Intento de retirar el último owner'
  )$$,
  '40001',
  'Cannot remove the final usable owner',
  'serialized permission changes cannot remove the last owner'
);

select throws_ok(
  $$select public.set_admin_permissions('32000000-0000-0000-0000-000000000001',array['owner']::public.admin_permission[])$$,
  '42501', null, 'authenticated owner cannot bypass version and reason with legacy provisioning RPC'
);
select throws_ok($$select metadata from public.admin_audit_logs$$,
  '42501', null, 'even owner cannot select unsanitized audit metadata directly');
select ok(
  exists(select 1 from jsonb_array_elements(public.list_admin_workflow('audit',100,null,null)->'items') item
    where item->>'action'='admin.permissions.updated'
      and item->'metadata'->'before'='["operations"]'::jsonb
      and item->'metadata'->'after'='["operations","quality"]'::jsonb
      and item->'metadata'->>'reason'='Responsable de operaciones y calidad'),
  'owner reads complete before and after through the restricted audit projection'
);
select ok(not has_table_privilege('service_role','public.admin_audit_logs','UPDATE'), 'service role cannot rewrite audit history');
select ok(not has_table_privilege('service_role','public.admin_audit_logs','DELETE'), 'service role cannot delete audit history');
select throws_ok(
  $$select public.list_admin_workflow('audit',101,null,null)$$,
  '22023', null, 'direct audit RPC enforces bounded page size'
);

select is(
  public.request_payment_refund(
    '39000000-0000-0000-0000-000000000001',
    100,
    'Devolución solicitada por owner',
    'owner-refund-request-0001'
  ) ->> 'status',
  'requested',
  'owner inherits Finance permission and can initiate a refund request'
);

select throws_ok(
  $$delete from public.admin_audit_logs$$,
  '42501',
  null,
  'owner cannot rewrite or delete audit history directly'
);

reset role;
select * from finish();
rollback;
