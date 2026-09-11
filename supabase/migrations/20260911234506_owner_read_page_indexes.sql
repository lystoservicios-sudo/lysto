-- T12: authenticated queries with explicit ownership and stable date/id ordering.
-- EXPLAIN on >10,000 disposable rows showed full owner scans and top-N sorts
-- with the previous single-column indexes. No permissions or data are changed.
create index idx_read_equipment_customer_created
  on public.customer_equipment(customer_id,created_at desc,id desc);
create index idx_read_requests_customer_created
  on public.service_requests(customer_id,created_at desc,id desc);
create index idx_read_jobs_customer_created
  on public.jobs(customer_id,created_at desc,id desc);
