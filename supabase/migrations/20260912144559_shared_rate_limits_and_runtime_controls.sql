create table private.rate_limit_buckets(
  key text primary key check(length(key) between 10 and 100),
  window_started_at timestamptz not null,
  request_count integer not null check(request_count>0),
  updated_at timestamptz not null default clock_timestamp()
);
alter table private.rate_limit_buckets enable row level security;
alter table private.rate_limit_buckets force row level security;
revoke all on private.rate_limit_buckets from public,anon,authenticated,service_role;

create function public.consume_rate_limit(p_key text,p_limit integer,p_window_seconds integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=clock_timestamp();v_start timestamptz;v private.rate_limit_buckets%rowtype;v_retry integer;
begin
  if auth.role()<>'service_role' then raise exception using errcode='42501',message='service_role_required'; end if;
  if p_key is null or length(p_key) not between 10 and 100 or p_limit not between 1 and 10000 or p_window_seconds not between 1 and 86400 then
    raise exception using errcode='22023',message='invalid_rate_limit'; end if;
  v_start=to_timestamp(floor(extract(epoch from v_now)/p_window_seconds)*p_window_seconds);
  insert into private.rate_limit_buckets(key,window_started_at,request_count,updated_at) values(p_key,v_start,1,v_now)
  on conflict(key) do update set window_started_at=case when private.rate_limit_buckets.window_started_at=excluded.window_started_at then private.rate_limit_buckets.window_started_at else excluded.window_started_at end,
    request_count=case when private.rate_limit_buckets.window_started_at=excluded.window_started_at then least(p_limit+1,private.rate_limit_buckets.request_count+1) else 1 end,updated_at=v_now
  returning * into v;
  v_retry=greatest(0,ceil(extract(epoch from v.window_started_at+make_interval(secs=>p_window_seconds)-v_now))::integer);
  return jsonb_build_object('allowed',v.request_count<=p_limit,'remaining',greatest(0,p_limit-v.request_count),'retryAfter',case when v.request_count<=p_limit then 0 else v_retry end);
end; $$;

create function public.prune_rate_limits(p_limit integer default 1000)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if auth.role()<>'service_role' then raise exception using errcode='42501',message='service_role_required'; end if;
  if p_limit not between 1 and 10000 then raise exception using errcode='22023',message='invalid_limit'; end if;
  with doomed as(select key from private.rate_limit_buckets where updated_at<clock_timestamp()-interval '2 days' order by updated_at limit p_limit for update skip locked),removed as(delete from private.rate_limit_buckets r using doomed d where r.key=d.key returning 1)
  select count(*) into v_count from removed;return v_count;
end; $$;

create function public.production_readiness_probe()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' then raise exception using errcode='42501',message='service_role_required'; end if;
  return jsonb_build_object('databaseTime',clock_timestamp(),'outboxOldestPendingAt',(select min(created_at) from private.outbox_events where status in('pending','processing')),
    'refundOldestPendingAt',(select min(requested_at) from private.payment_refund_requests where status in('requested','processing')),
    'paymentReviewCount',(select count(*) from public.marketplace_checkouts where status='review'));
end; $$;

revoke all on function public.consume_rate_limit(text,integer,integer),public.prune_rate_limits(integer),public.production_readiness_probe() from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer),public.prune_rate_limits(integer),public.production_readiness_probe() to service_role;
