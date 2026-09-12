-- T18: durable financial exception cases. Economic policy remains an explicit
-- business decision; ambiguous or payable states stay in review.
alter table public.marketplace_checkouts
  add column closed_for_new_payments_at timestamptz,
  add column closure_evidence jsonb;

alter table public.service_requests
  add column replacement_of_request_id uuid references public.service_requests(id);

create table private.financial_exception_cases (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  kind text not null check(kind in('cancellation','professional_replacement','payment_review')),
  status text not null default 'waiting_reconciliation'
    check(status in('waiting_reconciliation','ready','resolved','cancelled')),
  reason text not null check(length(trim(reason)) between 10 and 2000),
  requested_by uuid not null references public.profiles(id),
  assigned_to uuid references public.profiles(id),
  version integer not null default 1 check(version>0),
  evidence jsonb not null default '{}'::jsonb check(jsonb_typeof(evidence)='object'),
  financially_cleared_at timestamptz,
  financially_cleared_by uuid references public.profiles(id),
  replacement_job_id uuid references public.jobs(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  check((status='ready')=(financially_cleared_at is not null and financially_cleared_by is not null)
    or status in('waiting_reconciliation','resolved','cancelled')),
  check((status='resolved')=(resolved_at is not null) or status<>'resolved')
);
create unique index financial_exception_one_active
  on private.financial_exception_cases(job_id,kind) where status in('waiting_reconciliation','ready');
create index financial_exception_queue on private.financial_exception_cases(status,created_at,id);
alter table private.financial_exception_cases enable row level security;
alter table private.financial_exception_cases force row level security;
revoke all on private.financial_exception_cases from public,anon,authenticated,service_role;

create function private.checkout_is_financially_closed(p_checkout public.marketplace_checkouts)
returns boolean language sql stable set search_path='' as $$
  select p_checkout.closed_for_new_payments_at is not null
    and p_checkout.status in('expired','rejected','cancelled','refunded')
    and not exists(
      select 1 from public.marketplace_payment_observations o
      where o.checkout_id=p_checkout.id
        and o.provider_status in('approved','partially_refunded','charged_back','review')
    )
    and not exists(
      select 1 from public.marketplace_payment_observations o
      where o.checkout_id=p_checkout.id and o.provider_status='refunded'
        and o.refunded_amount<p_checkout.amount
    );
$$;

create function public.request_job_cancellation(
  p_job_id uuid,p_reason text,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.jobs%rowtype;v_case private.financial_exception_cases%rowtype;v_actor uuid:=private.current_profile_id();
begin
  if not private.has_admin_permission('operations') then raise exception using errcode='42501',message='operations_required'; end if;
  if length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception using errcode='22023',message='reason_required'; end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found then raise exception using errcode='P0002',message='job_not_found'; end if;
  if v_job.assignment_version<>p_expected_version then raise exception using errcode='40001',message='job_version_conflict'; end if;
  if v_job.status::text like 'cancelled%' then return jsonb_build_object('jobId',v_job.id,'status',v_job.status,'idempotent',true); end if;
  if not exists(select 1 from public.marketplace_checkouts where job_id=v_job.id) then
    update public.jobs set status='cancelled_by_admin',cancelled_at=clock_timestamp(),assignment_version=assignment_version+1 where id=v_job.id;
    update public.service_requests set status='cancelled' where id=v_job.request_id;
    update public.job_schedule_reservations set state='released',hold_expires_at=null where job_id=v_job.id and state in('hold','confirmed');
    perform private.append_admin_audit('job.cancelled','job',v_job.id,jsonb_build_object('reason',trim(p_reason),'financialCase',false));
    return jsonb_build_object('jobId',v_job.id,'status','cancelled_by_admin','requiresFinancialReview',false);
  end if;
  insert into private.financial_exception_cases(job_id,kind,reason,requested_by)
    values(v_job.id,'cancellation',trim(p_reason),v_actor)
    on conflict(job_id,kind) where status in('waiting_reconciliation','ready') do update
      set reason=excluded.reason,version=private.financial_exception_cases.version+1,updated_at=clock_timestamp()
    returning * into v_case;
  update public.marketplace_checkouts set status='review',review_reason='cancellation_requested',updated_at=clock_timestamp()
    where job_id=v_job.id and status not in('refunded','charged_back');
  perform private.append_admin_audit('job.cancellation_requested','financial_exception_case',v_case.id,
    jsonb_build_object('jobId',v_job.id,'reason',trim(p_reason),'version',v_case.version));
  return jsonb_build_object('caseId',v_case.id,'jobId',v_job.id,'status',v_case.status,'version',v_case.version,'requiresFinancialReview',true);
end; $$;

create function public.request_professional_replacement(
  p_job_id uuid,p_reason text,p_expected_version integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.jobs%rowtype;v_case private.financial_exception_cases%rowtype;v_actor uuid:=private.current_profile_id();
begin
  if not private.has_admin_permission('operations') then raise exception using errcode='42501',message='operations_required'; end if;
  if length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception using errcode='22023',message='reason_required'; end if;
  select * into v_job from public.jobs where id=p_job_id for update;
  if not found then raise exception using errcode='P0002',message='job_not_found'; end if;
  if v_job.assignment_version<>p_expected_version or v_job.professional_id is null or v_job.status in('completed','cancelled_by_customer','cancelled_by_professional','cancelled_by_admin') then
    raise exception using errcode='40001',message='job_not_replaceable'; end if;
  insert into private.financial_exception_cases(job_id,kind,reason,requested_by,status,financially_cleared_at,financially_cleared_by)
    values(v_job.id,'professional_replacement',trim(p_reason),v_actor,
      case when exists(select 1 from public.marketplace_checkouts where job_id=v_job.id) then 'waiting_reconciliation' else 'ready' end,
      case when exists(select 1 from public.marketplace_checkouts where job_id=v_job.id) then null else clock_timestamp() end,
      case when exists(select 1 from public.marketplace_checkouts where job_id=v_job.id) then null else v_actor end)
    on conflict(job_id,kind) where status in('waiting_reconciliation','ready') do update
      set reason=excluded.reason,version=private.financial_exception_cases.version+1,updated_at=clock_timestamp()
    returning * into v_case;
  update public.marketplace_checkouts set status='review',review_reason='professional_replacement_requested',updated_at=clock_timestamp()
    where job_id=v_job.id and status not in('refunded','charged_back');
  perform private.append_admin_audit('job.professional_replacement_requested','financial_exception_case',v_case.id,
    jsonb_build_object('jobId',v_job.id,'reason',trim(p_reason),'version',v_case.version));
  return jsonb_build_object('caseId',v_case.id,'jobId',v_job.id,'status',v_case.status,'version',v_case.version);
end; $$;

create function public.mark_marketplace_checkout_closed(
  p_checkout_id uuid,p_evidence jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_checkout public.marketplace_checkouts%rowtype;v_status text;
begin
  if not private.has_admin_permission('finance') then raise exception using errcode='42501',message='finance_required'; end if;
  if jsonb_typeof(p_evidence)<>'object' or nullif(trim(p_evidence->>'providerPreferenceStatus'),'') is null then
    raise exception using errcode='22023',message='provider_evidence_required'; end if;
  select * into v_checkout from public.marketplace_checkouts where id=p_checkout_id for update;
  if not found then raise exception using errcode='P0002',message='checkout_not_found'; end if;
  if exists(select 1 from public.marketplace_payment_observations where checkout_id=v_checkout.id
      and provider_status in('approved','partially_refunded','charged_back','review')) then
    raise exception using errcode='40001',message='payment_reconciliation_required'; end if;
  v_status:=case when exists(select 1 from public.marketplace_payment_observations where checkout_id=v_checkout.id and provider_status='refunded') then 'refunded' else 'expired' end;
  update public.marketplace_checkouts set status=v_status,closed_for_new_payments_at=clock_timestamp(),closure_evidence=p_evidence,
    review_reason=null,updated_at=clock_timestamp() where id=v_checkout.id;
  perform private.append_admin_audit('payment.checkout_closed','marketplace_checkout',v_checkout.id,p_evidence);
  return jsonb_build_object('id',v_checkout.id,'status',v_status,'closedForNewPayments',true);
end; $$;

create function public.clear_financial_exception(
  p_case_id uuid,p_expected_version integer,p_evidence jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.financial_exception_cases%rowtype;
begin
  if not private.has_admin_permission('finance') then raise exception using errcode='42501',message='finance_required'; end if;
  if jsonb_typeof(p_evidence)<>'object' or length(trim(coalesce(p_evidence->>'summary','')))<10 then
    raise exception using errcode='22023',message='evidence_required'; end if;
  select * into v_case from private.financial_exception_cases where id=p_case_id for update;
  if not found then raise exception using errcode='P0002',message='case_not_found'; end if;
  if v_case.status='ready' then return jsonb_build_object('id',v_case.id,'status','ready','version',v_case.version,'idempotent',true); end if;
  if v_case.status<>'waiting_reconciliation' or v_case.version<>p_expected_version then raise exception using errcode='40001',message='case_version_conflict'; end if;
  if exists(select 1 from public.marketplace_checkouts c where c.job_id=v_case.job_id and not private.checkout_is_financially_closed(c)) then
    raise exception using errcode='40001',message='checkout_not_financially_closed'; end if;
  update private.financial_exception_cases set status='ready',version=version+1,evidence=p_evidence,
    financially_cleared_at=clock_timestamp(),financially_cleared_by=private.current_profile_id(),updated_at=clock_timestamp()
    where id=v_case.id returning * into v_case;
  perform private.append_admin_audit('financial_exception.cleared','financial_exception_case',v_case.id,p_evidence);
  return jsonb_build_object('id',v_case.id,'status',v_case.status,'version',v_case.version,'idempotent',false);
end; $$;

create function public.resolve_financial_exception(
  p_case_id uuid,p_expected_version integer,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_case private.financial_exception_cases%rowtype;v_job public.jobs%rowtype;v_request public.service_requests%rowtype;
  v_new_request uuid;v_new_job uuid;v_price uuid;v_quote public.service_quotes%rowtype;v_new_quote uuid:=gen_random_uuid();
begin
  if not private.has_admin_permission('operations') then raise exception using errcode='42501',message='operations_required'; end if;
  if length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception using errcode='22023',message='reason_required'; end if;
  select * into v_case from private.financial_exception_cases where id=p_case_id for update;
  if not found then raise exception using errcode='P0002',message='case_not_found'; end if;
  if v_case.status='resolved' then return jsonb_build_object('id',v_case.id,'status','resolved','replacementJobId',v_case.replacement_job_id,'idempotent',true); end if;
  if v_case.status<>'ready' or v_case.version<>p_expected_version then raise exception using errcode='40001',message='case_not_ready'; end if;
  select * into v_job from public.jobs where id=v_case.job_id for update;
  if v_case.kind='cancellation' then
    update public.jobs set status='cancelled_by_admin',cancelled_at=clock_timestamp(),assignment_version=assignment_version+1 where id=v_job.id;
    update public.service_requests set status='cancelled' where id=v_job.request_id;
    update public.job_schedule_reservations set state='released',hold_expires_at=null where job_id=v_job.id and state in('hold','confirmed');
    update public.assignment_offers set status='cancelled',responded_at=clock_timestamp() where job_id=v_job.id and status='pending';
  elsif v_case.kind='professional_replacement' then
    select * into v_request from public.service_requests where id=v_job.request_id for share;
    insert into public.service_requests(customer_id,category_id,issue_type_id,status,time_since,address_id,preferred_date,
      preferred_time_window,urgency_level,submitted_at,equipment_id,replacement_of_request_id)
      values(v_request.customer_id,v_request.category_id,v_request.issue_type_id,'pending_assignment',v_request.time_since,
        v_request.address_id,v_request.preferred_date,v_request.preferred_time_window,v_request.urgency_level,clock_timestamp(),
        v_request.equipment_id,v_request.id) returning id into v_new_request;
    insert into public.request_answers(request_id,question_code,answer_value,answer_json)
      select v_new_request,question_code,answer_value,answer_json from public.request_answers where request_id=v_request.id;
    insert into public.diagnosis_reports(request_id,level,top_cause_code,top_cause_label,possible_causes,customer_summary,technician_summary,disclaimer)
      select v_new_request,level,top_cause_code,top_cause_label,possible_causes,customer_summary,technician_summary,disclaimer
      from public.diagnosis_reports where request_id=v_request.id;
    insert into public.price_options(request_id,option_type,title,description,amount,currency,platform_fee,professional_amount,selected)
      select v_new_request,option_type,title,description,amount,currency,platform_fee,professional_amount,selected
      from public.price_options where request_id=v_request.id;
    update public.service_requests set selected_price_option_id=(select id from public.price_options where request_id=v_new_request and selected order by created_at limit 1) where id=v_new_request;
    select * into v_quote from public.service_quotes where request_id=v_request.id and status='accepted' for share;
    if found then
      insert into public.service_quotes(id,customer_id,address,input,quote,preferred_date,time_window,status,expires_at,request_id,
        reviewed_by,review_reason,reviewed_at,accepted_at,revision,version,root_quote_id,previous_quote_id,created_by,
        revision_reason,manual_route_reason,policy_id,policy_snapshot,acceptance_result,upload_intent_ids)
      values(v_new_quote,v_quote.customer_id,v_quote.address,v_quote.input,v_quote.quote,v_quote.preferred_date,v_quote.time_window,
        'accepted',v_quote.expires_at,v_new_request,v_quote.reviewed_by,v_quote.review_reason,v_quote.reviewed_at,clock_timestamp(),
        1,1,v_new_quote,v_quote.id,private.current_profile_id(),'professional_replacement',v_quote.manual_route_reason,
        v_quote.policy_id,v_quote.policy_snapshot,v_quote.acceptance_result,v_quote.upload_intent_ids);
    end if;
    insert into public.jobs(request_id,customer_id,status,scheduled_date,scheduled_time_window,final_amount)
      values(v_new_request,v_job.customer_id,'pending_assignment',v_job.scheduled_date,v_job.scheduled_time_window,v_job.final_amount)
      returning id into v_new_job;
    update public.jobs set status='cancelled_by_admin',cancelled_at=clock_timestamp(),assignment_version=assignment_version+1 where id=v_job.id;
    update public.service_requests set status='cancelled' where id=v_job.request_id;
    update public.job_schedule_reservations set state='released',hold_expires_at=null where job_id=v_job.id and state in('hold','confirmed');
  else raise exception using errcode='22023',message='unsupported_case_kind'; end if;
  update private.financial_exception_cases set status='resolved',version=version+1,resolved_at=clock_timestamp(),
    replacement_job_id=v_new_job,evidence=evidence||jsonb_build_object('resolutionReason',trim(p_reason)),updated_at=clock_timestamp()
    where id=v_case.id returning * into v_case;
  perform private.append_admin_audit('financial_exception.resolved','financial_exception_case',v_case.id,
    jsonb_build_object('kind',v_case.kind,'jobId',v_case.job_id,'replacementJobId',v_new_job,'reason',trim(p_reason)));
  return jsonb_build_object('id',v_case.id,'status','resolved','version',v_case.version,'replacementJobId',v_new_job,'idempotent',false);
end; $$;

create function public.list_financial_exceptions(p_limit integer default 50,p_before timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if not (private.has_admin_permission('operations') or private.has_admin_permission('finance')) then
    raise exception using errcode='42501',message='admin_permission_required'; end if;
  if p_limit not between 1 and 100 then raise exception using errcode='22023',message='invalid_limit'; end if;
  return jsonb_build_object(
    'cases',coalesce((select jsonb_agg(row_value order by created_at desc,id desc) from (
    select c.created_at,c.id,jsonb_build_object('id',c.id,'jobId',c.job_id,'kind',c.kind,'status',c.status,
      'reason',c.reason,'version',c.version,'evidence',c.evidence,'createdAt',c.created_at,'updatedAt',c.updated_at,
      'replacementJobId',c.replacement_job_id,'checkoutCount',(select count(*) from public.marketplace_checkouts x where x.job_id=c.job_id),
      'openRefundCount',(select count(*) from private.payment_refund_requests r join public.payments p on p.id=r.payment_id where p.job_id=c.job_id and r.status in('requested','processing'))
    ) row_value from private.financial_exception_cases c where p_before is null or c.created_at<p_before
    order by c.created_at desc,c.id desc limit p_limit
  ) q),'[]'::jsonb),
    'refunds',case when private.has_admin_permission('finance') then coalesce((select jsonb_agg(jsonb_build_object(
      'id',r.id,'paymentId',r.payment_id,'jobId',p.job_id,'amount',r.amount,'paymentAmount',p.amount,
      'currency',p.currency,'reason',r.reason,'status',r.status,'attemptCount',r.attempt_count,
      'lastError',r.last_error,'failureReason',r.failure_reason,'providerReference',r.provider_reference,
      'requestedAt',r.requested_at,'updatedAt',r.updated_at) order by r.requested_at desc,r.id desc)
      from private.payment_refund_requests r join public.payments p on p.id=r.payment_id
      where p_before is null or r.requested_at<p_before),'[]'::jsonb) else '[]'::jsonb end,
    'refundablePayments',case when private.has_admin_permission('finance') then coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'jobId',p.job_id,'amount',p.amount,'currency',p.currency,'status',p.status,
      'reservedAmount',coalesce((select sum(r.amount) from private.payment_refund_requests r where r.payment_id=p.id and r.status in('requested','processing','succeeded')),0),
      'availableAmount',p.amount-coalesce((select sum(r.amount) from private.payment_refund_requests r where r.payment_id=p.id and r.status in('requested','processing','succeeded')),0)
    ) order by p.created_at desc,p.id desc) from public.payments p where p.provider='mercadopago'
      and p.status in('approved','captured','partially_refunded')),'[]'::jsonb) else '[]'::jsonb end
  );
end; $$;

create function public.get_payment_refund_execution_context(p_request_id uuid,p_claim_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
  if auth.role()<>'service_role' then raise exception using errcode='42501',message='service_role_required'; end if;
  select jsonb_build_object('professionalId',p.professional_id,'checkoutId',o.checkout_id,'paymentAmount',p.amount)
    into v from private.payment_refund_requests r join public.payments p on p.id=r.payment_id
    join public.marketplace_payment_observations o on o.provider_payment_id=p.provider_payment_id
    where r.id=p_request_id and r.status='processing' and r.claim_token=p_claim_token and r.locked_until>clock_timestamp();
  if v is null then raise exception using errcode='40001',message='refund_claim_stale'; end if;
  return v;
end; $$;

create or replace function private.protect_paid_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.professional_id is distinct from old.professional_id and exists(select 1 from public.marketplace_checkouts where job_id=old.id) then
    raise exception 'A checkout pins its professional: create a linked replacement service instead';
  end if;
  if new.status::text like 'cancelled%' and new.status is distinct from old.status
    and exists(select 1 from public.marketplace_checkouts c where c.job_id=old.id and not private.checkout_is_financially_closed(c)) then
    raise exception 'Reconcile, close and refund the checkout before cancelling its service';
  end if;
  if new.status in('technician_on_way','arrived','onsite_diagnosis','in_progress') and new.status is distinct from old.status
    and exists(select 1 from public.service_quotes where request_id=old.request_id and accepted_at is not null)
    and not exists(select 1 from public.marketplace_checkouts where job_id=old.id and extra_id is null and status='approved') then
    raise exception 'Initial payment must be approved before the visit';
  end if;
  return new;
end; $$;

revoke all on function private.checkout_is_financially_closed(public.marketplace_checkouts) from public,anon,authenticated,service_role;
revoke all on function public.request_job_cancellation(uuid,text,integer),public.request_professional_replacement(uuid,text,integer),
  public.mark_marketplace_checkout_closed(uuid,jsonb),public.clear_financial_exception(uuid,integer,jsonb),
  public.resolve_financial_exception(uuid,integer,text),public.list_financial_exceptions(integer,timestamptz),
  public.get_payment_refund_execution_context(uuid,uuid) from public,anon;
grant execute on function public.request_job_cancellation(uuid,text,integer),public.request_professional_replacement(uuid,text,integer),
  public.mark_marketplace_checkout_closed(uuid,jsonb),public.clear_financial_exception(uuid,integer,jsonb),
  public.resolve_financial_exception(uuid,integer,text),public.list_financial_exceptions(integer,timestamptz) to authenticated;
grant execute on function public.get_payment_refund_execution_context(uuid,uuid) to service_role;
