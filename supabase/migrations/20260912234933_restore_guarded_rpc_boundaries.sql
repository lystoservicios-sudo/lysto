-- These public RPCs delegate to private functions whose direct execution is
-- intentionally revoked. The public boundary keeps the private schema hidden
-- while the private implementations enforce the authenticated actor guards.
alter function public.close_job_with_final_report(
  uuid, uuid, text, text, text, text, public.maintenance_option, date, integer,
  text, uuid[], uuid
) security definer;

alter function public.submit_customer_review_transaction(
  uuid, integer, integer, boolean, boolean, text, uuid
) security definer;
