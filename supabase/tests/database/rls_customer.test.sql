begin;

\ir ../fixtures/session.sql.inc


select plan(29);

create function pg_temp.set_jwt(p_uid uuid, p_app_role text, p_user_metadata jsonb default '{}'::jsonb)
returns void
language sql
as $$
  select pg_temp.fixture_set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_uid::text,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('app_role', p_app_role),
      'user_metadata', p_user_metadata
    )::text,
    true
  )::text;
$$;

create function pg_temp.receipt_count(p_token uuid)
returns bigint
language plpgsql
as $$
declare
  v_count bigint;
begin
  execute 'select count(*) from public.lookup_public_receipt($1)' into v_count using p_token;
  return v_count;
exception
  when undefined_function or insufficient_privilege then return -1;
end;
$$;

create function pg_temp.receipt_keys(p_token uuid)
returns text[]
language plpgsql
as $$
declare
  v_keys text[];
begin
  execute $sql$
    select array_agg(key order by key)
    from public.lookup_public_receipt($1) receipt
    cross join lateral jsonb_object_keys(to_jsonb(receipt)) as keys(key)
  $sql$ into v_keys using p_token;
  return v_keys;
exception
  when undefined_function or insufficient_privilege then return array['missing_lookup'];
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'customer-a@lysto.test', '', now(), '{"app_role":"customer"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'customer-b@lysto.test', '', now(), '{"app_role":"customer"}', '{}', now(), now());

insert into public.profiles (id, auth_user_id, role, first_name, last_name, email)
values
  ('11000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'customer', 'Customer', 'A', 'customer-a@lysto.test'),
  ('11000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'customer', 'Customer', 'B', 'customer-b@lysto.test');

insert into public.customer_profiles (id, profile_id)
values
  ('12000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001'),
  ('12000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002');

insert into public.customer_addresses (id, customer_id, street, number, city, province)
values
  ('13000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'Calle A', '100', 'Hudson', 'Buenos Aires'),
  ('13000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', 'Calle B', '200', 'Berazategui', 'Buenos Aires'),
  ('13000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000001', 'Calle A', '103', 'Berazategui', 'Buenos Aires'),
  ('13000000-0000-0000-0000-000000000004', '12000000-0000-0000-0000-000000000001', 'Calle A', '104', 'Quilmes', 'Buenos Aires'),
  ('13000000-0000-0000-0000-000000000005', '12000000-0000-0000-0000-000000000001', 'Calle A', '105', 'CABA', 'Buenos Aires'),
  ('13000000-0000-0000-0000-000000000006', '12000000-0000-0000-0000-000000000001', 'Calle A', '106', 'Palermo', 'CABA'),
  ('13000000-0000-0000-0000-000000000007', '12000000-0000-0000-0000-000000000001', 'Calle A', '107', 'CABA', 'CABA');

insert into public.service_categories (id, slug, name)
values ('14000000-0000-0000-0000-000000000001', 'rls-customer-category', 'RLS customer category');

insert into public.service_issue_types (id, category_id, slug, name)
values ('14000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001', 'rls-customer-issue', 'RLS customer issue');

insert into public.pricing_rules (
  id, category_id, issue_type_id, zone_slug, base_price, issue_adjustment, priority_multiplier, platform_fee_rate
)
values
  ('14000000-0000-0000-0000-000000000003', '14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', 'hudson', 43000, 210, 1.5, 0.18),
  ('14000000-0000-0000-0000-000000000004', '14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', 'berazategui', 20000, 200, 1.5, 0.18),
  ('14000000-0000-0000-0000-000000000005', '14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', 'gba_sur', 30000, 300, 1.5, 0.18),
  ('14000000-0000-0000-0000-000000000006', '14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', 'caba', 10000, 100, 1.5, 0.18);

insert into public.service_requests (id, customer_id, category_id, issue_type_id, address_id, status)
values
  ('15000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000001', 'draft'),
  ('15000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002', 'pending_payment'),
  ('15000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002', 'pending_payment'),
  ('15000000-0000-0000-0000-000000000004', '12000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002', 'payment_approved'),
  ('15000000-0000-0000-0000-000000000005', '12000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002', 'payment_approved'),
  ('15000000-0000-0000-0000-000000000006', '12000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002', 'assigned');

insert into public.request_media (id, request_id, media_type, storage_bucket, storage_path, uploaded_by)
values
  ('16000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'photo', 'request-media', 'a/photo.jpg', '11000000-0000-0000-0000-000000000001'),
  ('16000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000002', 'photo', 'request-media', 'b/photo.jpg', '11000000-0000-0000-0000-000000000002');

insert into public.jobs (id, request_id, customer_id, status)
values
  ('17000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'completed_pending_customer_confirmation'),
  ('17000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', 'pending_assignment'),
  ('17000000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000002', 'pending_assignment'),
  ('17000000-0000-0000-0000-000000000004', '15000000-0000-0000-0000-000000000004', '12000000-0000-0000-0000-000000000002', 'in_progress'),
  ('17000000-0000-0000-0000-000000000005', '15000000-0000-0000-0000-000000000005', '12000000-0000-0000-0000-000000000002', 'in_progress'),
  ('17000000-0000-0000-0000-000000000006', '15000000-0000-0000-0000-000000000006', '12000000-0000-0000-0000-000000000002', 'completed_pending_customer_confirmation');

insert into public.payments (
  id, job_id, request_id, customer_id, provider_payment_id, amount, marketplace_fee, professional_amount
)
values
  ('18000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'rls-customer-payment-a', 1000, 180, 820),
  ('18000000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', 'rls-customer-payment-b', 2000, 360, 1640);

insert into public.customer_equipment (id, customer_id, address_id, category_id, nickname)
values
  ('19000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'Equipo A'),
  ('19000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000001', 'Equipo B');

insert into public.job_final_reports (
  id, job_id, equipment_id, real_diagnosis, work_done, final_state, warranty_days, after_photo_ids
)
values
  ('1c000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'Diagnóstico válido', 'Trabajo realizado', 'resolved', 30, array['1d000000-0000-0000-0000-000000000001']::uuid[]),
  ('1c000000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000002', 'Diagnóstico expirado', 'Trabajo realizado', 'resolved', 15, array['1d000000-0000-0000-0000-000000000002']::uuid[]),
  ('1c000000-0000-0000-0000-000000000003', '17000000-0000-0000-0000-000000000003', '19000000-0000-0000-0000-000000000002', 'Diagnóstico revocado', 'Trabajo realizado', 'resolved', 15, array['1d000000-0000-0000-0000-000000000003']::uuid[]);

insert into public.receipts (id, job_id, final_report_id, public_token, expires_at)
values
  ('1d000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '1c000000-0000-0000-0000-000000000001', '1e000000-0000-0000-0000-000000000001', now() + interval '1 day'),
  ('1d000000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000002', '1c000000-0000-0000-0000-000000000002', '1e000000-0000-0000-0000-000000000002', now() - interval '1 second'),
  ('1d000000-0000-0000-0000-000000000003', '17000000-0000-0000-0000-000000000003', '1c000000-0000-0000-0000-000000000003', '1e000000-0000-0000-0000-000000000003', now() + interval '1 day');

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'receipts' and column_name = 'revoked_at'
  ) then
    execute $sql$
      update public.receipts
      set revoked_at = now()
      where id = '1d000000-0000-0000-0000-000000000003'
    $sql$;
  end if;
end;
$$;

insert into public.public_receipts (id, job_id, token, service_name, professional_public_name, work_done, warranty_text)
values
  ('1a000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001', 'Servicio A', 'Profesional A', 'Trabajo A', '30 días'),
  ('1a000000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000002', 'Servicio B', 'Profesional B', 'Trabajo B', '30 días');

select pg_temp.set_jwt(
  '10000000-0000-0000-0000-000000000001',
  'customer',
  '{"app_role":"admin","permissions":["owner"]}'::jsonb
);
set local role authenticated;

select pg_temp.set_jwt(
  '10000000-0000-0000-0000-000000000001',
  'professional',
  '{}'::jsonb
);
select is(
  (select count(*) from public.customer_addresses),
  0::bigint,
  'JWT app_role contradicting profiles.role grants no customer access'
);
select pg_temp.set_jwt(
  '10000000-0000-0000-0000-000000000001',
  'customer',
  '{"app_role":"admin","permissions":["owner"]}'::jsonb
);

select is((select count(*) from public.profiles), 1::bigint, 'customer reads only their own profile');
select is((select count(*) from public.customer_addresses), 6::bigint, 'customer reads only their own addresses');
select is((select count(*) from public.service_requests), 1::bigint, 'customer reads only their own request');
select is((select count(*) from public.request_media), 1::bigint, 'customer reads only their own media metadata');
select is((select count(*) from public.jobs), 1::bigint, 'customer reads only their own job');
select is((select count(*) from public.payments), 1::bigint, 'customer reads only their own payment');
select is((select count(*) from public.customer_equipment), 1::bigint, 'customer reads only their own equipment');
select is((select count(*) from public.platform_settings), 0::bigint, 'user_metadata cannot grant admin access');

select throws_ok(
  $$insert into public.customer_equipment(
    customer_id, address_id, category_id, nickname
  ) values (
    '12000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000002',
    '14000000-0000-0000-0000-000000000001',
    'Equipo con dirección ajena'
  )$$,
  '42501',
  null,
  'direct equipment inserts cannot bypass the ownership-checked workflow'
);

select throws_ok(
  $$update public.profiles set role = 'admin' where auth_user_id = '10000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'customer cannot promote themselves'
);

select throws_ok(
  $$update public.service_requests set status = 'payment_approved' where id = '15000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'customer cannot change protected request state directly'
);

-- Legacy direct pricing is retired; complete ownership/coverage and quote tests
-- now live in service_quotes.test.sql and pricing-routes.vitest.test.ts.
select ok(not has_function_privilege('authenticated', 'public.create_service_request_from_app(uuid,uuid,text,text,text,date,text,public.urgency_level,jsonb,numeric,numeric,numeric)', 'execute'), 'customer cannot bypass immutable quotes through the legacy public RPC');
select ok(not has_function_privilege('authenticated', 'private.create_service_request_from_app(uuid,uuid,text,text,text,date,text,public.urgency_level,jsonb,numeric,numeric,numeric)', 'execute'), 'customer cannot bypass immutable quotes through the legacy private RPC');
select ok(has_function_privilege('authenticated', 'public.submit_service_quote_v2(uuid,integer)', 'execute'), 'customer can use the authenticated versioned quote acceptance entrypoint');
select throws_ok(
  $$select public.apply_mercadopago_payment_webhook('customer-forged-event', 'missing-payment', 'approved', '{}'::jsonb)$$,
  '42501',
  null,
  'customer cannot invoke the payment webhook'
);

select throws_ok(
  $$select public.request_payment_refund(
    '18000000-0000-0000-0000-000000000001',
    100,
    'Intento de devolución cliente',
    'customer-refund-attempt-0001'
  )$$,
  'P0001',
  'Finance permission required',
  'customer cannot initiate a refund request'
);

select throws_ok(
  $$select public.close_job_with_final_report(
    '17000000-0000-0000-0000-000000000004',
    '19000000-0000-0000-0000-000000000002',
    'Diagnóstico indebido',
    'Trabajo indebido',
    null,
    'resolved',
    'none',
    null,
    0,
    null,
    array['1d000000-0000-0000-0000-000000000004']::uuid[],
    '1f000000-0000-0000-0000-000000000004'
  )$$,
  '42501',
  'professional_required',
  'customer cannot close a job through the professional RPC'
);

select throws_ok(
  $$select public.submit_customer_review_transaction(
    '17000000-0000-0000-0000-000000000006',
    5,
    5,
    true,
    true,
    'Intento ajeno',
    '1f000000-0000-0000-0000-000000000006'
  )$$,
  'P0002',
  'job_not_found',
  'customer cannot review another customer job'
);

select throws_ok(
  $$select * from public.lookup_public_receipt('1e000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'authenticated customer cannot execute the server-only receipt lookup'
);

reset role;
select pg_temp.fixture_set_config('request.jwt.claims', '{}'::text, true);
set local role anon;

select throws_ok(
  $$select count(*) from public.public_receipts$$,
  '42501',
  null,
  'anon cannot enumerate legacy public receipts'
);

select throws_ok(
  $$select count(*) from public.receipts$$,
  '42501',
  null,
  'anon cannot enumerate canonical receipts'
);

select throws_ok(
  $$select * from public.lookup_public_receipt('1e000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'anon cannot execute the server-only receipt lookup'
);

select throws_ok(
  $$select public.close_job_with_final_report(
    '17000000-0000-0000-0000-000000000005',
    '19000000-0000-0000-0000-000000000002',
    'Diagnóstico anónimo',
    'Trabajo anónimo',
    null,
    'resolved',
    'none',
    null,
    0,
    null,
    array['1d000000-0000-0000-0000-000000000005']::uuid[],
    '1f000000-0000-0000-0000-000000000005'
  )$$,
  '42501',
  null,
  'anonymous callers cannot close jobs'
);

reset role;

set local role service_role;
select is(pg_temp.receipt_count('1e000000-0000-0000-0000-000000000001'), 1::bigint, 'server lookup returns a valid receipt by full token');
select is(pg_temp.receipt_count('1effffff-ffff-ffff-ffff-ffffffffffff'), 0::bigint, 'server lookup returns no row for an invalid token');
select is(pg_temp.receipt_count('1e000000-0000-0000-0000-000000000002'), 0::bigint, 'server lookup returns no row for an expired token');
select is(pg_temp.receipt_count('1e000000-0000-0000-0000-000000000003'), 0::bigint, 'server lookup returns no row for a revoked token');
select is(
  pg_temp.receipt_keys('1e000000-0000-0000-0000-000000000001'),
  array['confirmation_status','final_state','issued_at','next_maintenance_date','professional_name','service_name','warranty_until','work_done']::text[],
  'server lookup exposes only the minimal public receipt projection'
);

reset role;
select * from finish();
rollback;
