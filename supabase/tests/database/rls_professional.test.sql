begin;

\ir ../fixtures/session.sql.inc


select plan(21);

create function pg_temp.set_jwt(p_uid uuid, p_app_role text)
returns void
language sql
as $$
  select pg_temp.fixture_set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_uid::text,
      'role', 'authenticated',
      'app_metadata', jsonb_build_object('app_role', p_app_role),
      'user_metadata', '{}'::jsonb
    )::text,
    true
  )::text;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'professional-a@lysto.test', '', now(), '{"app_role":"professional"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'professional-b@lysto.test', '', now(), '{"app_role":"professional"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'professional-suspended@lysto.test', '', now(), '{"app_role":"professional"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'professional-customer@lysto.test', '', now(), '{"app_role":"customer"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'other-customer@lysto.test', '', now(), '{"app_role":"customer"}', '{}', now(), now());

insert into public.profiles (id, auth_user_id, role, first_name, last_name, email)
values
  ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'professional', 'Professional', 'A', 'professional-a@lysto.test'),
  ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'professional', 'Professional', 'B', 'professional-b@lysto.test'),
  ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'professional', 'Professional', 'Suspended', 'professional-suspended@lysto.test'),
  ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'customer', 'Customer', 'For jobs', 'professional-customer@lysto.test'),
  ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'customer', 'Other', 'Customer', 'other-customer@lysto.test');

insert into public.professional_profiles (id, profile_id, status)
values
  ('22000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'approved'),
  ('22000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'approved'),
  ('22000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000003', 'suspended');

insert into public.customer_profiles (id, profile_id)
values
  ('23000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000004'),
  ('23000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000005');

insert into public.customer_addresses (id, customer_id, street, number)
values
  ('24000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', 'Calle asignada', '999'),
  ('24000000-0000-0000-0000-000000000002', '23000000-0000-0000-0000-000000000002', 'Calle no asignada', '1000'),
  ('24000000-0000-0000-0000-000000000003', '23000000-0000-0000-0000-000000000001', 'Otra dirección del cliente', '1001');

insert into public.service_categories (id, slug, name)
values ('25000000-0000-0000-0000-000000000001', 'rls-professional-category', 'RLS professional category');

insert into public.service_issue_types (id, category_id, slug, name)
values ('25000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-000000000001', 'rls-professional-issue', 'RLS professional issue');

insert into public.customer_equipment (id, customer_id, address_id, category_id, nickname)
values
  ('25000000-0000-0000-0000-000000000003', '23000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', 'Equipo asignado'),
  ('25000000-0000-0000-0000-000000000004', '23000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000003', '25000000-0000-0000-0000-000000000001', 'Otro equipo del mismo cliente');

insert into public.service_requests (id, customer_id, category_id, issue_type_id, address_id, equipment_id, status)
values
  ('26000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000003', 'pending_professional_acceptance'),
  ('26000000-0000-0000-0000-000000000002', '23000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000002', null, 'pending_professional_acceptance'),
  ('26000000-0000-0000-0000-000000000003', '23000000-0000-0000-0000-000000000002', '25000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000002', null, 'pending_professional_acceptance'),
  ('26000000-0000-0000-0000-000000000004', '23000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000003', 'assigned'),
  ('26000000-0000-0000-0000-000000000005', '23000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000003', 'assigned'),
  ('26000000-0000-0000-0000-000000000006', '23000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000001', '25000000-0000-0000-0000-000000000003', 'assigned');

insert into public.jobs (id, request_id, customer_id, professional_id, status)
values
  ('27000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'pending_professional_acceptance'),
  ('27000000-0000-0000-0000-000000000002', '26000000-0000-0000-0000-000000000002', '23000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000002', 'in_progress'),
  ('27000000-0000-0000-0000-000000000003', '26000000-0000-0000-0000-000000000003', '23000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000003', 'in_progress'),
  ('27000000-0000-0000-0000-000000000004', '26000000-0000-0000-0000-000000000004', '23000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'onsite_diagnosis'),
  ('27000000-0000-0000-0000-000000000005', '26000000-0000-0000-0000-000000000005', '23000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'waiting_customer_approval'),
  ('27000000-0000-0000-0000-000000000006', '26000000-0000-0000-0000-000000000006', '23000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'in_progress');

insert into public.professional_documents (id, professional_id, document_type, storage_bucket, storage_path)
values
  ('28000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'dni', 'professional-documents', 'a/dni.pdf'),
  ('28000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000002', 'dni', 'professional-documents', 'b/dni.pdf');

insert into public.payments (
  id, job_id, request_id, customer_id, professional_id, provider_payment_id, amount, marketplace_fee, professional_amount
)
values ('29000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'rls-professional-payment', 1000, 180, 820);

insert into public.payout_records (id, professional_id, payment_id, amount)
values ('2a000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', '29000000-0000-0000-0000-000000000001', 820);

insert into private.upload_intents (
  id, owner_profile_id, owner_auth_user_id, kind, entity_id, mime_type, size_bytes,
  sha256, phase, quarantine_path, output_bucket, output_path, output_mime_type,
  output_size_bytes, output_sha256, status, attachment_id, verified_at
)
values (
  '2b000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', 'job-photo', '27000000-0000-0000-0000-000000000006',
  'image/png', 100, repeat('a', 64), 'after', 'rls-professional/after-source.png',
  'job-evidence', 'rls-professional/after.webp', 'image/webp', 80, repeat('b', 64),
  'verified', '2b000000-0000-0000-0000-000000000001', now()
);

insert into public.job_media (id, job_id, media_type, phase, storage_bucket, storage_path, uploaded_by)
values (
  '2b000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000006',
  'photo', 'after', 'job-evidence', 'rls-professional/after.webp', '21000000-0000-0000-0000-000000000001'
);

insert into public.onsite_diagnoses (
  job_id, professional_id, equipment_id, actual_diagnosis, base_scope, evidence_ids,
  status, submitted_by, decided_by, decided_at
)
values (
  '27000000-0000-0000-0000-000000000006', '22000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000003', 'Diagnóstico aceptado para cierre',
  'Alcance base aceptado para cierre', array['2b000000-0000-0000-0000-000000000001']::uuid[],
  'accepted', '21000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000004', now()
);

select pg_temp.set_jwt('20000000-0000-0000-0000-000000000001', 'professional');
set local role authenticated;

select is((select count(*) from public.jobs), 4::bigint, 'professional reads only their assigned jobs');
select is((select count(*) from public.service_requests), 4::bigint, 'professional reads only requests for their assigned jobs');
select is((select count(*) from public.customer_addresses), 1::bigint, 'assigned professional reads only the address required for their job');
select is((select count(*) from public.customer_equipment), 1::bigint, 'assigned professional reads equipment for their customer and service category');
select is((select count(*) from public.professional_documents), 1::bigint, 'professional reads only their own documents');
select is((select count(*) from public.payout_records), 1::bigint, 'professional reads only their own payout records');

select throws_ok(
  $$update public.jobs set final_amount = 1 where id = '27000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'professional cannot update financial job columns directly'
);

select throws_ok(
  $$update public.professional_profiles set internal_score = 100 where id = '22000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'professional cannot update their protected approval and score fields'
);

select throws_ok(
  $$update public.professional_profiles set status = 'suspended' where id = '22000000-0000-0000-0000-000000000001' returning id$$,
  '42501', null,
  'professional cannot approve, suspend or otherwise change their own status'
);

select throws_ok(
  $$update public.payments set status = 'approved' where id = '29000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'professional cannot alter payment state'
);

select throws_ok(
  $$select public.request_payment_refund(
    '29000000-0000-0000-0000-000000000001',
    100,
    'Intento de devolución profesional',
    'professional-refund-attempt-0001'
  )$$,
  '42501',
  'finance_required',
  'professional cannot initiate a refund request'
);

select throws_ok(
  $$select public.professional_respond_to_job(
    '27000000-0000-0000-0000-000000000002',
    '22000000-0000-0000-0000-000000000002',
    'accepted',
    null
  )$$,
  'P0001',
  null,
  'professional cannot impersonate another professional in an RPC'
);

select lives_ok(
  $$select public.professional_respond_to_job(
    '27000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    'accepted',
    null
  )$$,
  'approved assigned professional can respond to their own job'
);

select throws_ok(
  $$select public.close_job_with_final_report(
    '27000000-0000-0000-0000-000000000004',
    '25000000-0000-0000-0000-000000000003',
    'Diagnóstico prematuro',
    'Trabajo prematuro',
    null,
    'resolved',
    'none',
    null,
    0,
    null,
    array['2b000000-0000-0000-0000-000000000004']::uuid[],
    '2c000000-0000-0000-0000-000000000004'
  )$$,
  '40001',
  'job_not_in_progress',
  'professional cannot close from onsite diagnosis'
);

select throws_ok(
  $$select public.close_job_with_final_report(
    '27000000-0000-0000-0000-000000000005',
    '25000000-0000-0000-0000-000000000003',
    'Diagnóstico prematuro',
    'Trabajo prematuro',
    null,
    'resolved',
    'none',
    null,
    0,
    null,
    array['2b000000-0000-0000-0000-000000000005']::uuid[],
    '2c000000-0000-0000-0000-000000000005'
  )$$,
  '40001',
  'job_not_in_progress',
  'professional cannot close while waiting customer approval'
);

select throws_ok(
  $$select public.close_job_with_final_report(
    '27000000-0000-0000-0000-000000000006',
    '25000000-0000-0000-0000-000000000004',
    'Diagnóstico completo',
    'Trabajo terminado',
    null,
    'resolved',
    'none',
    null,
    30,
    null,
    array['2b000000-0000-0000-0000-000000000006']::uuid[],
    '2c000000-0000-0000-0000-000000000006'
  )$$,
  '40001',
  'accepted_onsite_diagnosis_required',
  'professional cannot close with a different customer equipment record'
);

select lives_ok(
  $$select public.close_job_with_final_report(
    '27000000-0000-0000-0000-000000000006',
    '25000000-0000-0000-0000-000000000003',
    'Diagnóstico completo',
    'Trabajo terminado',
    null,
    'resolved',
    'none',
    null,
    30,
    null,
    array['2b000000-0000-0000-0000-000000000001']::uuid[],
    '2c000000-0000-0000-0000-000000000001'
  )$$,
  'professional can close an in-progress job with its exact linked equipment'
);

select throws_ok(
  $$select public.close_job_with_final_report(
    '27000000-0000-0000-0000-000000000002',
    null,
    'Diagnóstico ajeno',
    'Trabajo indebido',
    null,
    'resolved',
    'none',
    null,
    0,
    null,
    array['2b000000-0000-0000-0000-000000000002']::uuid[],
    '2c000000-0000-0000-0000-000000000002'
  )$$,
  'P0002',
  'job_not_found',
  'professional cannot close another professional job'
);

reset role;
select pg_temp.set_jwt('20000000-0000-0000-0000-000000000002', 'professional');
set local role authenticated;

select is((select count(*) from public.customer_equipment), 0::bigint, 'another professional cannot read equipment outside their assigned customer');

reset role;
select pg_temp.set_jwt('20000000-0000-0000-0000-000000000003', 'professional');
set local role authenticated;

select throws_ok(
  $$select public.professional_respond_to_job(
    '27000000-0000-0000-0000-000000000003',
    '22000000-0000-0000-0000-000000000003',
    'accepted',
    null
  )$$,
  'P0001',
  null,
  'suspended professional cannot operate an assigned job'
);

select throws_ok(
  $$select public.close_job_with_final_report(
    '27000000-0000-0000-0000-000000000003',
    null,
    'Diagnóstico suspendido',
    'Trabajo indebido',
    null,
    'resolved',
    'none',
    null,
    0,
    null,
    array['2b000000-0000-0000-0000-000000000003']::uuid[],
    '2c000000-0000-0000-0000-000000000003'
  )$$,
  '42501',
  'professional_required',
  'suspended professional cannot close an assigned job'
);

reset role;
select * from finish();
rollback;
