-- Customer payment pages use the existing server-only marketplace connection.
-- Their queries bind the authenticated customer to checkout, job and request.
-- Grant only the columns used in those summaries, never customer contact data
-- or write access. This role is provisioned separately from application roles.
begin;
do $grants$
begin
  if to_regrole('lysto_marketplace') is not null then
    grant select (id, customer_id, issue_type_id, status)
      on public.service_requests to lysto_marketplace;
    grant select (id, name)
      on public.service_issue_types to lysto_marketplace;
    grant select (id, first_name, last_name)
      on public.profiles to lysto_marketplace;
    grant select (id, job_id, public_token, revoked_at, expires_at, created_at)
      on public.receipts to lysto_marketplace;
    grant select (id, payment_id, amount, status, reason, requested_at, updated_at, provider_reference)
      on private.payment_refund_requests to lysto_marketplace;
  end if;
end;
$grants$;
commit;
