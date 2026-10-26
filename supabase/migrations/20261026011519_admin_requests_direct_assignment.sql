-- Dispatch administrative services directly to the assigned technician.
-- Customer review and canonical approved payment remain required before a visit.
-- Existing permissions, ownership, availability, financial and version guards remain.
create or replace function private.save_admin_service_request(p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d private.admin_service_requests%rowtype; v_id uuid; v_customer uuid; v_actor uuid;
  v_address public.customer_addresses%rowtype; v_equipment uuid; v_category uuid; v_issue public.service_issue_types%rowtype;
  v_professional uuid; v_starts timestamptz; v_ends timestamptz; v_duration integer; v_buffer integer;
  v_total numeric; v_commission numeric; v_fee numeric; v_cost numeric; v_title text; v_description text;
  v_expected integer; v_action text; v_payload jsonb; v_address_json jsonb; v_quote jsonb;
  v_request uuid:=gen_random_uuid(); v_job uuid:=gen_random_uuid(); v_quote_id uuid:=gen_random_uuid(); v_price uuid:=gen_random_uuid();
  v_date date; v_window text; v_assigned_job public.jobs%rowtype; v_res public.job_schedule_reservations%rowtype;
begin
  v_actor=private.lock_admin_mutation('operations');
  perform private.lock_admin_mutation('finance');
  if (jsonb_typeof(p_input)='object' and jsonb_typeof(p_input->'total')='number'
    and jsonb_typeof(p_input->'expectedVersion')='number' and jsonb_typeof(p_input->'durationMinutes')='number'
    and jsonb_typeof(p_input->'travelBufferMinutes')='number' and jsonb_typeof(p_input->'commission')='object'
    and jsonb_typeof(p_input->'commission'->'value')='number') is not true
    or (p_input-array['id','expectedVersion','action','customerId','addressId','equipmentId','categoryId','issueTypeId',
      'serviceTitle','description','professionalId','startsAt','durationMinutes','travelBufferMinutes','total','commission'])<>'{}'::jsonb
    or ((p_input->'commission')-array['mode','value'])<>'{}'::jsonb then
    raise exception using errcode='22023',message='invalid_administrative_request';
  end if;
  v_id=(p_input->>'id')::uuid; v_expected=(p_input->>'expectedVersion')::integer;
  v_action=p_input->>'action'; v_customer=(p_input->>'customerId')::uuid;
  v_category=(p_input->>'categoryId')::uuid; v_professional=(p_input->>'professionalId')::uuid;
  v_equipment=(p_input->>'equipmentId')::uuid;
  v_title=btrim(p_input->>'serviceTitle'); v_description=btrim(p_input->>'description');
  v_starts=(p_input->>'startsAt')::timestamptz; v_duration=(p_input->>'durationMinutes')::integer;
  v_buffer=(p_input->>'travelBufferMinutes')::integer; v_total=(p_input->>'total')::numeric;
  v_commission=(p_input->'commission'->>'value')::numeric;
  if (v_id is not null and v_expected>=0 and v_action in ('draft','send') and v_customer is not null
    and v_category is not null and v_professional is not null and length(v_title) between 3 and 120
    and length(v_description) between 15 and 2000 and isfinite(v_starts)
    and v_duration between 30 and 480 and v_buffer between 0 and 180
    and v_total between 0.01 and 100000000 and v_total=round(v_total,2)
    and v_commission between 0 and 100000000 and v_commission=round(v_commission,2)
    and p_input->'commission'->>'mode' in ('percentage','amount')) is not true then
    raise exception using errcode='22023',message='invalid_administrative_request';
  end if;
  if p_input->'commission'->>'mode'='percentage' then
    if v_commission>=100 then raise exception using errcode='22023',message='invalid_commission'; end if;
    v_fee=round(v_total*v_commission/100,2);
  else v_fee=v_commission; end if;
  if v_fee>=v_total then raise exception using errcode='22023',message='invalid_commission'; end if;
  if v_action='send' and v_equipment is null then
    raise exception using errcode='22023',message='equipment_required_before_send';
  end if;
  v_payload=(p_input-array['id','expectedVersion','action'])||jsonb_build_object('serviceTitle',v_title,'description',v_description);
  perform pg_advisory_xact_lock(hashtextextended(v_id::text,77125));
  select * into d from private.admin_service_requests where id=v_id for update;
  if found then
    if d.state='sent' then
      if v_action='send' and d.input=v_payload then return private.admin_request_record(d.id); end if;
      raise exception using errcode='40001',message='sent_request_is_immutable';
    end if;
    if d.version<>v_expected then raise exception using errcode='40001',message='draft_version_conflict'; end if;
  elsif v_expected<>0 then raise exception using errcode='40001',message='draft_version_conflict'; end if;
  perform 1 from public.customer_profiles c join public.profiles p on p.id=c.profile_id join auth.users u on u.id=p.auth_user_id
    where c.id=v_customer and p.role='customer' and u.deleted_at is null and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until<=clock_timestamp()) for share of c,p,u;
  if not found then raise exception using errcode='22023',message='active_customer_required'; end if;
  select * into v_address from public.customer_addresses where id=(p_input->>'addressId')::uuid
    and customer_id=v_customer and archived_at is null for share;
  if not found then raise exception using errcode='22023',message='customer_address_required'; end if;
  perform 1 from public.service_categories where id=v_category and active for share;
  if not found then raise exception using errcode='22023',message='active_category_required'; end if;
  select * into v_issue from public.service_issue_types where id=(p_input->>'issueTypeId')::uuid and category_id=v_category and active for share;
  if not found then raise exception using errcode='22023',message='active_service_required'; end if;
  if v_equipment is not null then
    perform 1 from public.customer_equipment where id=v_equipment and customer_id=v_customer
      and address_id=v_address.id and category_id=v_category and archived_at is null for share;
    if not found then raise exception using errcode='22023',message='customer_equipment_mismatch'; end if;
  end if;
  if v_action='send' then perform pg_advisory_xact_lock(hashtextextended(v_professional::text,4516)); end if;
  perform 1 from public.professional_profiles where id=v_professional and status='approved'
    and private.professional_clearance_valid(id) for share;
  if not found then raise exception using errcode='22023',message='approved_professional_required'; end if;
  if d.id is null then
    insert into private.admin_service_requests(id,customer_id,created_by,input) values(v_id,v_customer,v_actor,v_payload);
  else
    update private.admin_service_requests set input=v_payload,customer_id=v_customer,version=version+1,updated_at=clock_timestamp() where id=v_id;
  end if;
  if v_action='draft' then
    perform private.append_admin_audit('request.admin_draft.saved','admin_service_request',v_id,jsonb_build_object('customerId',v_customer));
    return private.admin_request_record(v_id);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_professional::text,4515));
  if v_starts<=clock_timestamp()+interval '10 minutes' then raise exception using errcode='22023',message='future_visit_required'; end if;
  if not exists(select 1 from public.mp_split_connected_accounts where seller_id=v_professional::text and enabled) then
    raise exception using errcode='22023',message='seller_not_linked';
  end if;
  v_ends=v_starts+v_duration*interval '1 minute';
  v_date=(v_starts at time zone 'America/Argentina/Buenos_Aires')::date;
  v_window=to_char(v_starts at time zone 'America/Argentina/Buenos_Aires','HH24:MI')||'–'||to_char(v_ends at time zone 'America/Argentina/Buenos_Aires','HH24:MI');
  v_address_json=jsonb_build_object('street',v_address.street,'number',v_address.number,'city',v_address.city,
    'province',v_address.province,'floor',v_address.floor,'apartment',v_address.apartment);
  v_cost=round(v_total*coalesce((private.get_quote_policy()->>'paymentCostRate')::numeric,0.06),2);
  v_quote=jsonb_build_object('manualPricing',true,'currency','ARS','scope',v_description,'serviceTitle',v_title,
    'version','admin-'||v_id::text,'source','Precio personalizado autorizado por administración','sourceDate',current_date,
    'createdAt',clock_timestamp(),'expiresAt',v_starts,'issue',v_issue.slug,'scenario','maintenance','urgency','flexible',
    'labor',v_total,'laborReference',v_total,'adjustments','[]'::jsonb,'materials','[]'::jsonb,'materialsAmount',0,
    'travel',0,'route',null,'calculatorSubtotal',v_total,'subtotal',v_total,'safetyRate',0,'safetyAmount',0,
    'total',v_total,'platformFeeRate',v_fee/v_total,'platformFee',v_fee,'professionalAmount',v_total-v_fee,
    'paymentCostBudget',v_cost,'platformContribution',v_fee,'coverage','covered','reviewReasons','[]'::jsonb,
    'readyToOffer',true,'exclusions',jsonb_build_array('Trabajos o repuestos fuera del alcance acordado requieren una nueva aprobación.'),'priceKind','custom');
  insert into public.service_requests(id,customer_id,address_id,equipment_id,category_id,issue_type_id,status,
    urgency_level,preferred_date,preferred_time_window,submitted_at)
    values(v_request,v_customer,v_address.id,v_equipment,v_category,v_issue.id,'draft','flexible',v_date,v_window,clock_timestamp());
  insert into public.price_options(id,request_id,option_type,title,description,amount,platform_fee,professional_amount,selected)
    values(v_price,v_request,'flexible',v_title,v_description,v_total,v_fee,v_total-v_fee,true);
  update public.service_requests set selected_price_option_id=v_price,status='pending_assignment' where id=v_request;
  insert into public.service_quotes(id,customer_id,address,input,quote,preferred_date,time_window,status,expires_at,
    root_quote_id,created_by,reviewed_by,reviewed_at,review_reason,quote_origin)
    values(v_quote_id,v_customer,v_address_json,jsonb_build_object('issue',v_issue.slug),v_quote,v_date,v_window,'needs_review',v_starts,
      v_quote_id,v_actor,v_actor,clock_timestamp(),'Alcance, precio y comisión personalizados definidos por administración.','admin');
  insert into public.jobs(id,request_id,customer_id,status,scheduled_date,scheduled_time_window,final_amount)
    values(v_job,v_request,v_customer,'pending_assignment',v_date,v_window,v_total);
  update private.admin_service_requests set state='sent',quote_id=v_quote_id,request_id=v_request,job_id=v_job,
    version=version+1,updated_at=clock_timestamp() where id=v_id;
  -- Administration dispatches the agreed service directly. No offer, response,
  -- or synthetic technician acceptance participates in the customer payment path.
  perform private.expire_schedule_holds(v_professional);
  if not private.assignment_candidate_is_eligible(v_job,v_professional,v_starts,v_ends) then
    raise exception using errcode='22023',message='professional_ineligible_or_unavailable';
  end if;
  update public.jobs set professional_id=v_professional,status='confirmed',
    automatic_assignment_at=clock_timestamp(),assignment_version=assignment_version+1
    where id=v_job returning * into v_assigned_job;
  update public.service_requests set status='assigned' where id=v_request;
  v_res=private.insert_schedule_reservation(v_assigned_job,v_starts,v_duration,v_buffer,'confirmed',null,v_actor);
  insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata)
    values(v_job,'confirmed',v_actor,'Asignación directa; pendiente únicamente de confirmación y pago del cliente.',
      jsonb_build_object('adminRequestId',v_id,'source','administrative_direct_assignment',
        'assignmentVersion',v_assigned_job.assignment_version,'scheduleVersion',v_res.version));
  perform private.append_admin_audit('request.admin_created','service_request',v_request,
    jsonb_build_object('adminRequestId',v_id,'jobId',v_job,'quoteId',v_quote_id,'total',v_total,'platformFee',v_fee,'professionalAmount',v_total-v_fee,
      'assignmentMode','direct','assignmentVersion',v_assigned_job.assignment_version,'scheduleVersion',v_res.version));
  return private.admin_request_record(v_id);
end $$;
