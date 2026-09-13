create or replace function public.production_readiness_probe()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.role()<>'service_role' then
    raise exception using errcode='42501',message='service_role_required';
  end if;

  return jsonb_build_object(
    'databaseTime',clock_timestamp(),
    'outboxOldestPendingAt',(
      select min(created_at)
      from private.outbox_events
      where processed_at is null and dead_lettered_at is null
    ),
    'refundOldestPendingAt',(
      select min(requested_at)
      from private.payment_refund_requests
      where status in ('requested','processing')
    ),
    'paymentReviewCount',(
      select count(*)
      from public.marketplace_checkouts
      where status='review'
    )
  );
end;
$$;
