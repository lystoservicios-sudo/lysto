begin;

-- Preserve the current automatic/legacy recipient resolver and its ownership
-- checks; suppress only obsolete email state announcements before delivery.
CREATE OR REPLACE FUNCTION private.outbox_recipient(p_event private.outbox_events)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_email text; v_role text; v_expected_schedule_version integer; v_context jsonb; v_required_job_status text;
begin
  -- Only current email state announcements are actionable. Preserve in-app
  -- history and all payment/request receipts, review requests and invitations.
  if p_event.channel='email' and p_event.aggregate_type='job' then
    v_required_job_status := case p_event.event_type
      when 'job.assigned' then 'pending_professional_acceptance'
      when 'job.confirmed' then 'confirmed'
      when 'job.technician_on_way' then 'technician_on_way'
      when 'job.arrived' then 'arrived'
      when 'job.completed_pending_customer_confirmation' then 'completed_pending_customer_confirmation'
      when 'job.completed' then 'completed'
      else null end;
    if v_required_job_status is not null and not exists(
      select 1 from public.jobs j where j.id=p_event.aggregate_id
        and j.status::text=v_required_job_status
    ) then
      raise exception using errcode='22023',message='recipient_unavailable';
    end if;
    if p_event.event_type='visit.confirmed' and not exists(
      select 1 from public.job_schedule_reservations s
        where s.job_id=p_event.aggregate_id and s.state='confirmed'
          and s.version::text=split_part(p_event.dedupe_key,':',3)
          and s.starts_at>clock_timestamp()
    ) then
      raise exception using errcode='22023',message='recipient_unavailable';
    end if;
  end if;

  if (p_event.aggregate_type='job' and p_event.event_type='visit.confirmed' and exists(
    select 1 from public.jobs j join public.service_requests r on r.id=j.request_id
      where j.id=p_event.aggregate_id and r.contract_source='automatic_customer_request')) is not true then
    return private.outbox_recipient_before_automatic_request(p_event);
  end if;
  if p_event.channel is distinct from 'email' or (p_event.dedupe_key
    ~ ('^visit-confirmed:'||p_event.aggregate_id::text||':[1-9][0-9]*$')) is not true then
    raise exception using errcode='22023',message='recipient_unavailable'; end if;
  v_expected_schedule_version:=split_part(p_event.dedupe_key,':',3)::integer;
  select u.email,p.role::text into v_email,v_role
    from public.profiles p join auth.users u on u.id=p.auth_user_id
    where p.id=p_event.recipient_profile_id and u.deleted_at is null and u.email_confirmed_at is not null
      and u.email is not null and length(u.email::text) between 3 and 320
      and (u.banned_until is null or u.banned_until<=now())
      and coalesce(u.raw_app_meta_data->>'app_role','customer')=p.role::text
    for share of p,u;
  if not found or v_role is distinct from 'customer' then
    raise exception using errcode='22023',message='recipient_unavailable'; end if;
  select jsonb_build_object('eventType','visit.confirmed','aggregateId',p_event.aggregate_id,'audience','customer',
    'scheduleVersion',s.version,'startsAt',s.starts_at,'endsAt',s.ends_at,'timezone',s.timezone,
    'serviceName',left(sc.name,160),
    'professionalName',left(coalesce(nullif(btrim(concat_ws(' ',nullif(btrim(pp.first_name),''),
      case when nullif(btrim(pp.last_name),'') is null then null else left(btrim(pp.last_name),1)||'.' end)),''),'Profesional Lysto'),160),
    'addressLabel',private.customer_request_visit_address_label(r)) into v_context
    from public.jobs j
    join public.service_requests r on r.id=j.request_id and r.customer_id=j.customer_id
    join public.customer_profiles cp on cp.id=j.customer_id and cp.profile_id=p_event.recipient_profile_id
    join public.job_schedule_reservations s on s.job_id=j.id and s.professional_id=j.professional_id and s.state='confirmed'
    join public.service_categories sc on sc.id=r.category_id
    join public.professional_profiles pro on pro.id=j.professional_id
    join public.profiles pp on pp.id=pro.profile_id
    join private.customer_request_contracts k on k.job_id=j.id and k.professional_id=j.professional_id and k.state='paid' and k.paid_at is not null
    where j.id=p_event.aggregate_id and j.status='confirmed' and s.version=v_expected_schedule_version
      and private.customer_request_visit_address_label(r) is not null
      and exists(select 1 from public.marketplace_checkouts c where c.job_id=j.id
        and c.extra_id is null and c.status='approved' and c.customer_id=j.customer_id and c.professional_id=j.professional_id);
  if not found then raise exception using errcode='22023',message='recipient_unavailable'; end if;
  return jsonb_build_object('recipientEmail',v_email,'context',v_context);
end; $function$;

revoke all on function private.outbox_recipient(private.outbox_events)
  from public,anon,authenticated,service_role;

commit;
