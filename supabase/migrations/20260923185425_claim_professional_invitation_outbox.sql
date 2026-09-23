-- Claim one invitation, not whichever unrelated event is oldest in the outbox.
-- The existing fenced resolve/seal/finish/fail RPCs perform the delivery.
create function public.claim_professional_invitation_event(
  p_invitation_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns table (
  id uuid,
  claim_token uuid,
  channel text,
  attempt_count integer,
  locked_until timestamptz
)
language plpgsql security invoker set search_path = '' as $$
declare v_now timestamptz := clock_timestamp();
begin
  if p_invitation_id is null or p_worker_id is null
    or length(btrim(p_worker_id)) not between 1 and 200
    or p_lease_seconds is null or p_lease_seconds not between 1 and 3600 then
    raise exception using errcode='22023',message='Invalid invitation claim';
  end if;
  return query
  with candidate as (
    select e.id from private.outbox_events e
    where e.aggregate_type='professional_invitation'
      and e.aggregate_id=p_invitation_id
      and e.event_type='professional.invited'
      and e.channel='email'
      and e.processed_at is null and e.dead_lettered_at is null
      and e.attempt_count<e.max_attempts and e.available_at<=v_now
      and (e.locked_until is null or e.locked_until<=v_now)
    order by e.created_at,e.id
    for update skip locked limit 1
  )
  update private.outbox_events e
  set attempt_count=e.attempt_count+1,
      locked_at=v_now,
      locked_until=v_now+make_interval(secs=>p_lease_seconds),
      locked_by=p_worker_id,
      claim_token=gen_random_uuid(),
      last_error=null
  from candidate c where e.id=c.id
  returning e.id,e.claim_token,e.channel,e.attempt_count,e.locked_until;
end;
$$;
revoke all on function public.claim_professional_invitation_event(uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.claim_professional_invitation_event(uuid,text,integer) to service_role;
