-- Existing August business fields: compare before/after; do not require new columns to be absent.
select json_build_object(
  'profiles', (select json_agg(row_to_json(p) order by p.id) from (select id, auth_user_id, role, first_name, last_name, email from public.profiles) p),
  'requests', (select json_agg(row_to_json(r) order by r.id) from (select id, customer_id, category_id, issue_type_id, address_id, status from public.service_requests) r),
  'jobs', (select json_agg(row_to_json(j) order by j.id) from (select id, request_id, customer_id, status from public.jobs) j),
  'payments', (select json_agg(row_to_json(p) order by p.id) from (select id, job_id, request_id, customer_id, provider_payment_id, amount, marketplace_fee, professional_amount from public.payments) p)
);
