-- Lysto MVP operativo - RPC transaccionales de aplicación.
-- Objetivo: que las route handlers puedan persistir flujos completos sin lógica parcial en el cliente.
-- No contiene secretos. Probar primero en staging.

create or replace function public.create_service_request_from_app(
  p_customer_id uuid,
  p_address_id uuid,
  p_category_slug text,
  p_issue_slug text,
  p_time_since text,
  p_preferred_date date,
  p_preferred_time_window text,
  p_selected_option public.urgency_level,
  p_diagnosis jsonb,
  p_flexible_price numeric,
  p_priority_price numeric,
  p_selected_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category_id uuid;
  v_issue_id uuid;
  v_request_id uuid;
  v_flexible_id uuid;
  v_priority_id uuid;
  v_selected_id uuid;
  v_platform_rate numeric := coalesce((select (value->>'fee_rate')::numeric from public.platform_settings where key = 'marketplace'), 0.18);
begin
  if public.current_user_role() not in ('customer','admin') then
    raise exception 'Only customer or admin can create service requests';
  end if;

  if public.current_user_role() = 'customer' and p_customer_id <> public.current_customer_id() then
    raise exception 'Customer can only create own requests';
  end if;

  select id into v_category_id from public.service_categories where slug = p_category_slug and active = true;
  if v_category_id is null then raise exception 'Unknown service category %', p_category_slug; end if;

  select id into v_issue_id from public.service_issue_types where category_id = v_category_id and slug = p_issue_slug and active = true;
  if v_issue_id is null then raise exception 'Unknown issue type %', p_issue_slug; end if;

  insert into public.service_requests(
    customer_id, category_id, issue_type_id, status, time_since, address_id, preferred_date, preferred_time_window, urgency_level, submitted_at
  ) values (
    p_customer_id, v_category_id, v_issue_id, 'pending_payment', p_time_since, p_address_id, p_preferred_date, p_preferred_time_window, p_selected_option, now()
  ) returning id into v_request_id;

  insert into public.diagnosis_reports(
    request_id, level, top_cause_code, top_cause_label, possible_causes, customer_summary, technician_summary, disclaimer
  ) values (
    v_request_id,
    coalesce(p_diagnosis->>'level', 'medium'),
    coalesce(p_diagnosis->'topCause'->>'code', 'unknown'),
    coalesce(p_diagnosis->'topCause'->>'label', 'Diagnóstico preliminar'),
    coalesce(p_diagnosis->'causes', '[]'::jsonb),
    coalesce(p_diagnosis->>'customerSummary', 'Diagnóstico preliminar generado por Lysto.'),
    coalesce(p_diagnosis->>'technicianSummary', 'Revisar equipo en domicilio.'),
    coalesce(p_diagnosis->>'disclaimer', 'El diagnóstico final será confirmado por el técnico en el domicilio.')
  );

  insert into public.price_options(request_id, option_type, title, description, amount, platform_fee, professional_amount)
  values (
    v_request_id,
    'flexible',
    'Flexible',
    'Más económico. Franja horaria amplia, técnico verificado y garantía Lysto.',
    coalesce(p_flexible_price, p_selected_amount),
    round(coalesce(p_flexible_price, p_selected_amount) * v_platform_rate, 2),
    round(coalesce(p_flexible_price, p_selected_amount) * (1 - v_platform_rate), 2)
  ) returning id into v_flexible_id;

  insert into public.price_options(request_id, option_type, title, description, amount, platform_fee, professional_amount)
  values (
    v_request_id,
    'priority',
    'Prioridad',
    'Mayor prioridad de asignación, mejor SLA y seguimiento preferente.',
    coalesce(p_priority_price, p_selected_amount),
    round(coalesce(p_priority_price, p_selected_amount) * v_platform_rate, 2),
    round(coalesce(p_priority_price, p_selected_amount) * (1 - v_platform_rate), 2)
  ) returning id into v_priority_id;

  v_selected_id := case when p_selected_option = 'priority' then v_priority_id else v_flexible_id end;
  update public.price_options set selected = (id = v_selected_id) where request_id = v_request_id;
  update public.service_requests set selected_price_option_id = v_selected_id where id = v_request_id;

  return jsonb_build_object('request_id', v_request_id, 'selected_price_option_id', v_selected_id, 'status', 'pending_payment');
end;
$$;

create or replace function public.apply_mercadopago_payment_webhook(
  p_provider_event_id text,
  p_provider_payment_id text,
  p_provider_status text,
  p_raw_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_new_status public.payment_status;
  v_job_id uuid;
  v_duplicate boolean := false;
begin
  if exists (select 1 from public.payment_events where provider = 'mercadopago' and provider_event_id = p_provider_event_id) then
    v_duplicate := true;
    return jsonb_build_object('duplicate', true, 'provider_event_id', p_provider_event_id);
  end if;

  select * into v_payment from public.payments where provider = 'mercadopago' and provider_payment_id = p_provider_payment_id limit 1;
  if v_payment.id is null then
    insert into public.payment_events(provider, provider_event_id, event_type, raw_payload)
    values ('mercadopago', p_provider_event_id, 'unmatched_payment', p_raw_payload);
    return jsonb_build_object('duplicate', false, 'matched', false, 'provider_payment_id', p_provider_payment_id);
  end if;

  v_new_status := case lower(p_provider_status)
    when 'approved' then 'approved'::public.payment_status
    when 'accredited' then 'approved'::public.payment_status
    when 'authorized' then 'authorized'::public.payment_status
    when 'captured' then 'captured'::public.payment_status
    when 'rejected' then 'rejected'::public.payment_status
    when 'cancelled' then 'cancelled'::public.payment_status
    when 'refunded' then 'refunded'::public.payment_status
    when 'failed' then 'failed'::public.payment_status
    else 'pending'::public.payment_status
  end;

  insert into public.payment_events(payment_id, provider, provider_event_id, event_type, raw_payload)
  values (v_payment.id, 'mercadopago', p_provider_event_id, p_provider_status, p_raw_payload);

  update public.payments set status = v_new_status where id = v_payment.id;

  if v_new_status in ('approved','captured') and v_payment.request_id is not null then
    update public.service_requests set status = 'pending_assignment' where id = v_payment.request_id;
    insert into public.jobs(request_id, customer_id, status, scheduled_date, scheduled_time_window, final_amount)
    select sr.id, sr.customer_id, 'pending_assignment', sr.preferred_date, sr.preferred_time_window, po.amount
    from public.service_requests sr
    left join public.price_options po on po.id = sr.selected_price_option_id
    where sr.id = v_payment.request_id
    on conflict (request_id) do update set status = public.jobs.status
    returning id into v_job_id;
    update public.payments set job_id = v_job_id where id = v_payment.id;
  end if;

  return jsonb_build_object('duplicate', v_duplicate, 'matched', true, 'payment_id', v_payment.id, 'status', v_new_status, 'job_id', v_job_id);
end;
$$;

create or replace function public.assign_professional_to_job(
  p_job_id uuid,
  p_request_id uuid,
  p_professional_id uuid,
  p_admin_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_professional public.professional_profiles%rowtype;
begin
  if not public.is_admin() then raise exception 'Only admin can assign professionals'; end if;
  select * into v_job from public.jobs where id = p_job_id and request_id = p_request_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.status <> 'pending_assignment' then raise exception 'Job is not pending assignment'; end if;

  select * into v_professional from public.professional_profiles where id = p_professional_id for update;
  if v_professional.id is null then raise exception 'Professional not found'; end if;
  if v_professional.status <> 'approved' then raise exception 'Professional is not approved'; end if;

  update public.jobs
    set professional_id = p_professional_id, status = 'pending_professional_acceptance'
    where id = p_job_id;
  update public.service_requests set status = 'pending_professional_acceptance' where id = p_request_id;

  insert into public.admin_audit_logs(actor_profile_id, action, entity_type, entity_id, metadata)
  values (p_admin_profile_id, 'job.assigned', 'job', p_job_id, jsonb_build_object('professional_id', p_professional_id));

  return jsonb_build_object('job_id', p_job_id, 'professional_id', p_professional_id, 'status', 'pending_professional_acceptance');
end;
$$;

create or replace function public.professional_respond_to_job(
  p_job_id uuid,
  p_professional_id uuid,
  p_response text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if v_job.professional_id <> p_professional_id then raise exception 'Professional does not own this assignment'; end if;
  if v_job.status <> 'pending_professional_acceptance' then raise exception 'Job is not waiting professional acceptance'; end if;

  if p_response = 'accepted' then
    update public.jobs set status = 'confirmed', accepted_at = now() where id = p_job_id;
    update public.service_requests set status = 'assigned' where id = v_job.request_id;
    return jsonb_build_object('job_id', p_job_id, 'status', 'confirmed');
  elsif p_response = 'rejected' then
    update public.jobs set status = 'pending_assignment', professional_id = null where id = p_job_id;
    update public.service_requests set status = 'pending_assignment' where id = v_job.request_id;
    insert into public.job_status_events(job_id, status, actor_profile_id, notes, metadata)
    values (p_job_id, 'pending_assignment', public.current_profile_id(), 'professional_rejected', jsonb_build_object('reason', p_reason));
    return jsonb_build_object('job_id', p_job_id, 'status', 'pending_assignment');
  else
    raise exception 'Invalid response';
  end if;
end;
$$;

create or replace function public.close_job_with_final_report(
  p_job_id uuid,
  p_equipment_id uuid,
  p_real_diagnosis text,
  p_work_done text,
  p_parts_used text,
  p_final_state text,
  p_maintenance_option public.maintenance_option,
  p_next_maintenance_date date,
  p_warranty_days int,
  p_internal_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_report_id uuid;
  v_receipt_token uuid;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if public.current_user_role() = 'professional' and v_job.professional_id <> public.current_professional_id() then
    raise exception 'Professional does not own this job';
  end if;
  if v_job.status not in ('in_progress','onsite_diagnosis','waiting_customer_approval') then
    raise exception 'Job is not ready for final report';
  end if;
  if length(trim(p_real_diagnosis)) < 8 or length(trim(p_work_done)) < 8 then
    raise exception 'Final report is incomplete';
  end if;

  insert into public.job_final_reports(
    job_id, equipment_id, real_diagnosis, work_done, parts_used, final_state, maintenance_option, next_maintenance_date, warranty_days, internal_notes
  ) values (
    p_job_id, p_equipment_id, p_real_diagnosis, p_work_done, p_parts_used, p_final_state, p_maintenance_option, p_next_maintenance_date, greatest(p_warranty_days, 0), p_internal_notes
  ) returning id, public_token into v_report_id, v_receipt_token;

  insert into public.equipment_service_records(equipment_id, job_id, professional_id, reported_problem, real_diagnosis, work_done, parts_used, next_maintenance_option, next_maintenance_date, notes)
  values (p_equipment_id, p_job_id, v_job.professional_id, null, p_real_diagnosis, p_work_done, p_parts_used, p_maintenance_option, p_next_maintenance_date, p_internal_notes);

  insert into public.receipts(job_id, final_report_id, public_token)
  values (p_job_id, v_report_id, v_receipt_token)
  on conflict (job_id) do nothing;

  update public.jobs
    set status = 'completed_pending_customer_confirmation', completed_at = now(), warranty_until = case when p_warranty_days > 0 then current_date + p_warranty_days else null end
    where id = p_job_id;

  return jsonb_build_object('job_id', p_job_id, 'final_report_id', v_report_id, 'public_token', v_receipt_token, 'status', 'completed_pending_customer_confirmation');
end;
$$;

create or replace function public.submit_customer_review_transaction(
  p_job_id uuid,
  p_customer_id uuid,
  p_service_rating int,
  p_professional_rating int,
  p_problem_resolved boolean,
  p_would_hire_again boolean,
  p_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.jobs%rowtype;
  v_review_id uuid;
begin
  select * into v_job from public.jobs where id = p_job_id for update;
  if v_job.id is null then raise exception 'Job not found'; end if;
  if public.current_user_role() = 'customer' and p_customer_id <> public.current_customer_id() then raise exception 'Customer mismatch'; end if;
  if v_job.customer_id <> p_customer_id then raise exception 'Review customer does not own job'; end if;
  if v_job.status not in ('completed','completed_pending_customer_confirmation') then raise exception 'Job is not complete'; end if;
  if p_service_rating not between 1 and 5 or p_professional_rating not between 1 and 5 then raise exception 'Invalid rating'; end if;

  insert into public.reviews(job_id, customer_id, professional_id, service_rating, professional_rating, problem_resolved, would_hire_again, comment)
  values (p_job_id, p_customer_id, v_job.professional_id, p_service_rating, p_professional_rating, p_problem_resolved, p_would_hire_again, p_comment)
  returning id into v_review_id;

  update public.jobs set status = 'completed' where id = p_job_id;

  update public.professional_profiles pp
  set rating_avg = agg.avg_rating, jobs_completed = agg.jobs_completed
  from (
    select professional_id, round(avg(professional_rating)::numeric, 2) as avg_rating, count(*)::int as jobs_completed
    from public.reviews
    where professional_id = v_job.professional_id
    group by professional_id
  ) agg
  where pp.id = agg.professional_id;

  if p_service_rating <= 2 or p_professional_rating <= 2 or p_problem_resolved = false then
    insert into public.complaints(job_id, customer_id, professional_id, severity, description)
    values (p_job_id, p_customer_id, v_job.professional_id, 'high', coalesce(p_comment, 'Review baja o problema no resuelto'));
  end if;

  return jsonb_build_object('review_id', v_review_id, 'job_id', p_job_id, 'status', 'completed');
end;
$$;
