-- Keep accepted assignment retries response-compatible with the first acceptance.
create or replace function public.respond_assignment_offer(
  p_offer_id uuid,p_response text,p_reason text,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_offer public.assignment_offers%rowtype;v_job public.jobs%rowtype;v_pro uuid:=private.current_professional_id(true);
begin
  if v_pro is null then raise exception using errcode='42501',message='approved_professional_required'; end if;
  select * into v_offer from public.assignment_offers where id=p_offer_id for update;
  if not found or v_offer.professional_id<>v_pro then raise exception using errcode='P0002',message='offer_not_found'; end if;
  select * into v_job from public.jobs where id=v_offer.job_id for update;
  if v_offer.status='accepted' and p_response='accepted' then
    return jsonb_build_object('id',v_offer.id,'jobId',v_job.id,'status','accepted','assignmentVersion',v_offer.version,
      'paymentAccountConnected',exists(select 1 from public.mp_split_connected_accounts where seller_id=v_pro::text and enabled),
      'paymentStatus',case when exists(select 1 from public.marketplace_checkouts where job_id=v_job.id and extra_id is null and status='approved') then 'approved' else 'pending' end);
  end if;
  if v_offer.status<>'pending' or v_offer.version<>p_expected_version or v_job.assignment_version<>p_expected_version then
    raise exception using errcode='40001',message='assignment_version_conflict'; end if;
  if v_offer.expires_at<=clock_timestamp() then
    perform private.expire_assignment_offer(v_offer.id);
    return jsonb_build_object('id',v_offer.id,'jobId',v_job.id,'status','expired','assignmentVersion',v_offer.version+1);
  end if;
  if p_response='accepted' then
    perform private.professional_respond_to_job(v_job.id,v_pro,'accepted',null);
    update public.assignment_offers set status='accepted',responded_at=clock_timestamp() where id=v_offer.id;
    update public.job_schedule_reservations set state='confirmed',hold_expires_at=null
      where job_id=v_job.id and state='hold';
    return jsonb_build_object('id',v_offer.id,'jobId',v_job.id,'status','accepted','assignmentVersion',v_offer.version,
      'paymentAccountConnected',exists(select 1 from public.mp_split_connected_accounts where seller_id=v_pro::text and enabled),
      'paymentStatus',case when exists(select 1 from public.marketplace_checkouts where job_id=v_job.id and extra_id is null and status='approved') then 'approved' else 'pending' end);
  elsif p_response='rejected' then
    if length(trim(coalesce(p_reason,'')))<10 then raise exception using errcode='22023',message='rejection_reason_required'; end if;
    update public.assignment_offers set status='rejected',responded_at=clock_timestamp(),rejection_reason=trim(p_reason) where id=v_offer.id;
    perform private.professional_respond_to_job(v_job.id,v_pro,'rejected',p_reason);
    update public.jobs set assignment_version=assignment_version+1 where id=v_job.id;
    insert into public.notifications(profile_id,event_type,title,body,entity_type,entity_id,action_url)
      select p.id,'job.assignment_rejected','Propuesta rechazada',
        case when p.role='customer' then 'Continuamos buscando un profesional disponible.' else 'La propuesta fue rechazada y el trabajo volvió a la cola.' end,
        'job',v_job.id,case when p.role='customer' then '/mis-solicitudes/'||v_job.request_id::text else '/admin/servicios' end
      from public.profiles p where
        exists(select 1 from public.customer_profiles c where c.id=v_job.customer_id and c.profile_id=p.id) or
        exists(select 1 from public.admin_profiles a join private.admin_profile_permissions g on g.admin_profile_id=a.id
          where a.profile_id=p.id and g.permission in('operations','owner'));
    return jsonb_build_object('id',v_offer.id,'jobId',v_job.id,'status','rejected','assignmentVersion',v_offer.version+1);
  end if;
  raise exception using errcode='22023',message='invalid_response';
end; $$;

revoke all on function public.respond_assignment_offer(uuid,text,text,integer) from public,anon;
grant execute on function public.respond_assignment_offer(uuid,text,text,integer) to authenticated;
