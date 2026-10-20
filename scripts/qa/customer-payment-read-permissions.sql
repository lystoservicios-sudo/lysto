-- Inspect the real runtime role's column privileges without impersonating it,
-- reading customer data, changing grants or calling Mercado Pago.
do $test$
declare target record; column_name text;
begin
  if to_regrole('lysto_marketplace') is null then
    raise exception 'Expected payment runtime role is missing';
  end if;
  for target in select * from (values
    ('public.service_requests', 'id,customer_id,issue_type_id,status'),
    ('public.service_issue_types', 'id,name'),
    ('public.profiles', 'id,first_name,last_name'),
    ('public.professional_profiles', 'id,profile_id'),
    ('public.jobs', 'id,customer_id,request_id,professional_id,status,created_at,final_amount,scheduled_date,scheduled_time_window'),
    ('public.service_quotes', 'id,request_id,customer_id,quote,accepted_at'),
    ('public.job_extras', 'id,job_id,fault,amount,status,created_at'),
    ('public.marketplace_checkouts', 'id,job_id,customer_id,extra_id,amount,currency,status,live_mode,created_at,updated_at,expires_at,closed_for_new_payments_at,checkout_protocol,marketplace_fee'),
    ('public.marketplace_payment_observations', 'checkout_id,provider_payment_id,refunded_amount,provider_status,issues'),
    ('private.marketplace_order_observations', 'checkout_id,payment_id,refunded_amount,provider_status,issues'),
    ('public.payments', 'id,customer_id,job_id,provider_payment_id'),
    ('private.payment_refund_requests', 'id,payment_id,amount,status,reason,requested_at,updated_at,provider_reference'),
    ('public.receipts', 'id,job_id,public_token,revoked_at,expires_at,created_at'),
    ('private.financial_exception_cases', 'job_id,status')
  ) as required(relation_name, columns)
  loop
    foreach column_name in array string_to_array(target.columns, ',') loop
      if not has_column_privilege('lysto_marketplace', target.relation_name, column_name, 'SELECT') then
        raise exception 'Missing payment read privilege: %.%', target.relation_name, column_name;
      end if;
    end loop;
  end loop;
end;
$test$;
select 'customer_payment_read_permissions: passed' as result;
