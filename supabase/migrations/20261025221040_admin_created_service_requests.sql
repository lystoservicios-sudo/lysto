-- Administrative prices are explicit contracts, separate from calculator tariffs.
create table private.admin_service_requests (
  id uuid primary key,
  customer_id uuid not null references public.customer_profiles(id),
  created_by uuid not null references public.profiles(id),
  input jsonb not null check(jsonb_typeof(input)='object'),
  version integer not null default 1 check(version>0),
  state text not null default 'draft' check(state in ('draft','sent')),
  quote_id uuid unique references public.service_quotes(id),
  request_id uuid unique references public.service_requests(id),
  job_id uuid unique references public.jobs(id),
  accepted_at timestamptz,
  accepted_professional_id uuid references public.professional_profiles(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  check((state='draft' and quote_id is null and request_id is null and job_id is null and accepted_at is null)
    or (state='sent' and quote_id is not null and request_id is not null and job_id is not null)),
  check((accepted_at is null)=(accepted_professional_id is null))
);
create index admin_service_requests_customer_idx on private.admin_service_requests(customer_id);
create index admin_service_requests_creator_idx on private.admin_service_requests(created_by);
create index admin_service_requests_professional_idx on private.admin_service_requests(accepted_professional_id);
create index admin_service_requests_updated_idx on private.admin_service_requests(updated_at desc,id desc);
alter table private.admin_service_requests enable row level security;
revoke all on private.admin_service_requests from public,anon,authenticated,service_role;

alter table public.service_quotes add column quote_origin text not null default 'calculator'
  check(quote_origin in ('calculator','admin'));
-- Preserve the exact existing calculator constraint, including historical rules.
do $$ declare previous_check text; begin
  select pg_get_expr(conbin,conrelid) into strict previous_check from pg_constraint
    where conrelid='public.service_quotes'::regclass and conname='service_quotes_financials';
  alter table public.service_quotes drop constraint service_quotes_financials;
  execute format('alter table public.service_quotes add constraint service_quotes_financials check (
    (quote_origin=''calculator'' and (%s)) or
    (quote_origin=''admin'' and coalesce(
      quote->>''currency''=''ARS'' and quote->''manualPricing''=''true''::jsonb
      and (quote->>''total'')::numeric between 0.01 and 100000000
      and (quote->>''total'')::numeric=round((quote->>''total'')::numeric,2)
      and (quote->>''platformFee'')::numeric>=0
      and (quote->>''platformFee'')::numeric=round((quote->>''platformFee'')::numeric,2)
      and (quote->>''professionalAmount'')::numeric>0
      and (quote->>''total'')::numeric=(quote->>''platformFee'')::numeric+(quote->>''professionalAmount'')::numeric,false)))', previous_check);
end $$;

create function private.guard_administrative_quote_origin() returns trigger
language plpgsql set search_path='' as $$ begin
  if tg_op='UPDATE' and new.quote_origin is distinct from old.quote_origin then
    raise exception using errcode='42501',message='Quote origin is immutable';
  end if;
  if new.quote_origin<>'admin' and new.quote->'manualPricing'='true'::jsonb then
    raise exception using errcode='22023',message='administrative_replacement_requires_new_request';
  end if;
  return new;
end $$;
create trigger administrative_quote_origin_guard before insert or update on public.service_quotes
  for each row execute function private.guard_administrative_quote_origin();

create function private.require_admin_request_management() returns void
language plpgsql stable security definer set search_path='' as $$ begin
  if not (private.has_admin_permission('operations') and private.has_admin_permission('finance')) then
    raise exception using errcode='42501',message='operations_and_finance_required';
  end if;
end $$;

create function private.admin_request_record(p_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',d.id,'version',d.version,'state',d.state,'customerId',d.customer_id,
    'customerName',(select concat_ws(' ',p.first_name,p.last_name) from public.customer_profiles c join public.profiles p on p.id=c.profile_id where c.id=d.customer_id),
    'input',d.input,'requestId',d.request_id,'jobId',d.job_id,'acceptedAt',d.accepted_at,
    'createdAt',d.created_at,'updatedAt',d.updated_at) from private.admin_service_requests d where d.id=p_id;
$$;

create function private.read_admin_service_requests(p_id uuid default null,p_limit integer default 25,
  p_cursor_at timestamptz default null,p_cursor_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$ begin
  perform private.require_admin_request_management();
  if p_limit is null or p_limit not between 1 and 100 or (p_cursor_at is null)<>(p_cursor_id is null) then
    raise exception using errcode='22023',message='invalid_admin_request_page';
  end if;
  if p_id is not null then
    if not exists(select 1 from private.admin_service_requests where id=p_id) then
      raise exception using errcode='P0002',message='draft_not_found';
    end if;
    return private.admin_request_record(p_id);
  end if;
  return jsonb_build_object('items',coalesce((select jsonb_agg(private.admin_request_record(d.id) order by d.updated_at desc,d.id desc)
    from (select id,updated_at from private.admin_service_requests
      where p_cursor_at is null or (updated_at,id)<(p_cursor_at,p_cursor_id)
      order by updated_at desc,id desc limit p_limit+1) d),'[]'::jsonb),
    'total',(select count(*) from private.admin_service_requests));
end $$;

create function private.save_admin_service_request(p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d private.admin_service_requests%rowtype; v_id uuid; v_customer uuid; v_actor uuid;
  v_address public.customer_addresses%rowtype; v_equipment uuid; v_category uuid; v_issue public.service_issue_types%rowtype;
  v_professional uuid; v_starts timestamptz; v_ends timestamptz; v_duration integer; v_buffer integer;
  v_total numeric; v_commission numeric; v_fee numeric; v_cost numeric; v_title text; v_description text;
  v_expected integer; v_action text; v_payload jsonb; v_address_json jsonb; v_quote jsonb;
  v_request uuid:=gen_random_uuid(); v_job uuid:=gen_random_uuid(); v_quote_id uuid:=gen_random_uuid(); v_price uuid:=gen_random_uuid();
  v_date date; v_window text; v_expiry timestamptz;
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
  v_expiry=least(clock_timestamp()+interval '30 minutes',v_starts-interval '5 minutes');
  perform public.create_assignment_offer(v_job,v_professional,v_starts,v_duration,v_buffer,v_expiry,0);
  insert into public.job_status_events(job_id,status,actor_profile_id,notes,metadata)
    values(v_job,'pending_professional_acceptance',v_actor,'Solicitud creada por administración; pendiente de técnico, cliente y pago.',jsonb_build_object('adminRequestId',v_id));
  perform private.append_admin_audit('request.admin_created','service_request',v_request,
    jsonb_build_object('adminRequestId',v_id,'jobId',v_job,'quoteId',v_quote_id,'total',v_total,'platformFee',v_fee,'professionalAmount',v_total-v_fee));
  return private.admin_request_record(v_id);
end $$;

create function private.get_admin_service_request_for_job(p_job_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare d private.admin_service_requests%rowtype; j public.jobs%rowtype; q public.service_quotes%rowtype;
  v_customer boolean; v_quote jsonb; v_res public.job_schedule_reservations%rowtype;
begin
  select * into j from public.jobs where id=p_job_id;
  if not found or (j.customer_id=private.current_customer_id() or j.professional_id=private.current_professional_id(false)
    or private.has_admin_permission('operations') or private.has_admin_permission('finance')) is not true then
    raise exception using errcode='P0002',message='job_not_found';
  end if;
  select * into d from private.admin_service_requests where job_id=j.id;
  if not found then return null; end if;
  select * into q from public.service_quotes where id=d.quote_id;
  select * into v_res from public.job_schedule_reservations where job_id=j.id and state='confirmed' order by version desc limit 1;
  v_customer=coalesce(j.customer_id=private.current_customer_id(),false);
  v_quote=case when v_customer then q.quote-array['platformFee','platformFeeRate','professionalAmount','paymentCostBudget','platformContribution'] else q.quote end;
  return jsonb_build_object('summary',jsonb_build_object('id',d.id,'version',d.version,'title',d.input->>'serviceTitle',
    'description',q.quote->>'scope','total',(q.quote->>'total')::numeric,'startsAt',coalesce(v_res.starts_at,(d.input->>'startsAt')::timestamptz),
    'durationMinutes',coalesce(v_res.duration_minutes,(d.input->>'durationMinutes')::integer),'acceptedAt',d.accepted_at,
    'assignmentVersion',j.assignment_version,'scheduleVersion',coalesce(v_res.version,0),
    'canAccept',v_customer and d.accepted_at is null and j.status='confirmed' and q.status='needs_review'
      and v_res.id is not null and v_res.starts_at>clock_timestamp() and q.expires_at>clock_timestamp()
      and exists(select 1 from public.professional_profiles p where p.id=j.professional_id and p.status='approved' and private.professional_clearance_valid(p.id))
      and exists(select 1 from public.mp_split_connected_accounts where seller_id=j.professional_id::text and enabled)),
    'savedQuote',jsonb_build_object('quote',v_quote,'address',q.address,'input',q.input,'expires_at',q.expires_at,
      'status',case when d.accepted_at is null then 'ready' else 'accepted' end));
end $$;

create function private.accept_admin_service_request(p_id uuid,p_expected_version integer,p_assignment_version integer,p_schedule_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d private.admin_service_requests%rowtype; j public.jobs%rowtype; q public.service_quotes%rowtype;
  v_customer uuid:=private.current_customer_id(); v_job_id uuid; v_res public.job_schedule_reservations%rowtype;
begin
  if v_customer is null then raise exception using errcode='42501',message='customer_required'; end if;
  select job_id into v_job_id from private.admin_service_requests where id=p_id and customer_id=v_customer and state='sent';
  if v_job_id is null then raise exception using errcode='P0002',message='request_not_found'; end if;
  -- Same job-first lock order as assignment and checkout.
  select * into j from public.jobs where id=v_job_id and customer_id=v_customer for update;
  select * into d from private.admin_service_requests where id=p_id for update;
  if d.accepted_at is not null then return private.get_admin_service_request_for_job(j.id); end if;
  if d.version is distinct from p_expected_version then raise exception using errcode='40001',message='request_version_conflict'; end if;
  if j.assignment_version is distinct from p_assignment_version then raise exception using errcode='40001',message='assignment_version_conflict'; end if;
  select * into v_res from public.job_schedule_reservations where job_id=j.id and professional_id=j.professional_id
    and state='confirmed' order by version desc limit 1 for update;
  if v_res.id is null or v_res.version is distinct from p_schedule_version or v_res.starts_at<=clock_timestamp() then
    raise exception using errcode='40001',message='schedule_version_conflict';
  end if;
  if j.status<>'confirmed' or j.professional_id is null then
    raise exception using errcode='22023',message='professional_acceptance_required';
  end if;
  perform 1 from public.service_requests r join public.customer_equipment e on e.id=r.equipment_id
    and e.customer_id=r.customer_id and e.address_id=r.address_id and e.category_id=r.category_id and e.archived_at is null
    where r.id=j.request_id for share of r,e;
  if not found then raise exception using errcode='22023',message='equipment_required_before_send'; end if;
  select * into q from public.service_quotes where id=d.quote_id and quote_origin='admin' for update;
  if q.status is distinct from 'needs_review' or q.expires_at<=clock_timestamp() then raise exception using errcode='22023',message='request_expired'; end if;
  perform 1 from public.professional_profiles where id=j.professional_id and status='approved' and private.professional_clearance_valid(id) for share;
  if not found then raise exception using errcode='22023',message='approved_professional_required'; end if;
  if not exists(select 1 from public.mp_split_connected_accounts where seller_id=j.professional_id::text and enabled) then
    raise exception using errcode='22023',message='seller_not_linked';
  end if;
  update public.service_quotes set status='accepted',request_id=j.request_id,accepted_at=clock_timestamp(),
    acceptance_result=jsonb_build_object('request_id',j.request_id,'job_id',j.id,'quote_id',q.id) where id=q.id;
  update private.admin_service_requests set accepted_at=clock_timestamp(),accepted_professional_id=j.professional_id,
    version=version+1,updated_at=clock_timestamp() where id=d.id;
  insert into public.admin_audit_logs(actor_profile_id,action,entity_type,entity_id,metadata)
    values(private.current_profile_id(),'request.admin_created.accepted','service_request',j.request_id,
      jsonb_build_object('adminRequestId',d.id,'quoteId',q.id,'professionalId',j.professional_id,'total',q.quote->'total',
        'assignmentVersion',j.assignment_version,'scheduleVersion',v_res.version,'startsAt',v_res.starts_at));
  return private.get_admin_service_request_for_job(j.id);
end $$;

create function private.guard_admin_request_job() returns trigger
language plpgsql security definer set search_path='' as $$
declare d private.admin_service_requests%rowtype;
begin
  select * into d from private.admin_service_requests where job_id=new.id;
  if not found then return new; end if;
  if d.accepted_at is not null and new.professional_id is distinct from d.accepted_professional_id then
    raise exception using errcode='22023',message='customer_confirmation_pins_professional';
  end if;
  if new.status is distinct from old.status and new.status in('technician_on_way','arrived','onsite_diagnosis','in_progress')
    and (d.accepted_at is null or not exists(select 1 from public.marketplace_checkouts where job_id=new.id and extra_id is null and status='approved')) then
    raise exception using errcode='22023',message='customer_confirmation_and_payment_required';
  end if;
  return new;
end $$;
create trigger admin_request_job_guard before update on public.jobs for each row execute function private.guard_admin_request_job();

-- Route every administrative replacement through a fresh, reviewable request.
-- Reject at case creation too, so operations never gets a case it cannot close.
create function private.guard_admin_request_replacement_case() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if new.kind='professional_replacement' and exists(select 1 from private.admin_service_requests where job_id=new.job_id) then
    raise exception using errcode='22023',message='administrative_replacement_requires_new_request';
  end if;
  return new;
end $$;
create trigger admin_request_replacement_case_guard before insert or update of kind,job_id on private.financial_exception_cases
  for each row execute function private.guard_admin_request_replacement_case();
create function private.guard_admin_request_replacement() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if new.replacement_of_request_id is not null and exists(select 1 from private.admin_service_requests where request_id=new.replacement_of_request_id) then
    raise exception using errcode='22023',message='administrative_replacement_requires_new_request';
  end if;
  return new;
end $$;
create trigger admin_request_replacement_guard before insert on public.service_requests
  for each row execute function private.guard_admin_request_replacement();

create function private.admin_request_financials_visible(p_request_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select not exists(select 1 from private.admin_service_requests where request_id=p_request_id)
    or private.has_admin_permission('operations') or private.has_admin_permission('finance')
    or exists(select 1 from public.jobs where request_id=p_request_id and professional_id=private.current_professional_id(true));
$$;
create policy admin_request_price_privacy on public.price_options as restrictive for select to authenticated
  using(private.admin_request_financials_visible(request_id));
create policy admin_request_quote_privacy on public.service_quotes as restrictive for select to authenticated
  using(quote_origin<>'admin' or private.has_admin_permission('operations') or private.has_admin_permission('finance')
    or exists(select 1 from public.jobs where request_id=service_quotes.request_id and professional_id=private.current_professional_id(true)));

create function private.admin_request_job_financials_visible(p_job_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select not exists(select 1 from private.admin_service_requests where job_id=p_job_id)
    or private.has_admin_permission('finance')
    or exists(select 1 from public.jobs where id=p_job_id and professional_id=private.current_professional_id(true));
$$;
create policy admin_request_checkout_privacy on public.marketplace_checkouts as restrictive for select to authenticated
  using(private.admin_request_job_financials_visible(job_id));
create policy admin_request_payment_privacy on public.payments as restrictive for select to authenticated
  using(private.admin_request_job_financials_visible(job_id));

create function private.read_customer_payment_summaries(p_id uuid default null,p_status text default null,p_limit integer default 25,
  p_cursor_at timestamptz default null,p_cursor_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_customer uuid:=private.current_customer_id(); v_status public.payment_status;
begin
  if v_customer is null then raise exception using errcode='42501',message='customer_required'; end if;
  if p_limit is null or p_limit not between 1 and 101 or (p_cursor_at is null)<>(p_cursor_id is null) then
    raise exception using errcode='22023',message='invalid_payment_page';
  end if;
  v_status=p_status::public.payment_status;
  return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc) from (
    select p.id,p.created_at,p.request_id,p.job_id,p.status,p.currency,p.amount from public.payments p
    where p.customer_id=v_customer and (p_id is null or p.id=p_id) and (v_status is null or p.status=v_status)
      and (p_cursor_at is null or (p.created_at,p.id)<(p_cursor_at,p_cursor_id))
    order by p.created_at desc,p.id desc limit p_limit) r),'[]'::jsonb),
    'total',(select count(*) from public.payments p where p.customer_id=v_customer and (p_id is null or p.id=p_id) and (v_status is null or p.status=v_status)));
end $$;
create function public.read_customer_payment_summaries(p_id uuid default null,p_status text default null,p_limit integer default 25,
  p_cursor_at timestamptz default null,p_cursor_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.read_customer_payment_summaries(p_id,p_status,p_limit,p_cursor_at,p_cursor_id); $$;

-- Suppress customer notices during preparation; send the existing payment-entry
-- job confirmation through both delivery channels after professional acceptance.
create or replace function private.notify_job_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_customer_profile uuid; v_professional_profile uuid; v_event text; v_key text:=gen_random_uuid()::text; v_managed boolean;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_event=case new.status when 'pending_professional_acceptance' then 'job.assigned' when 'confirmed' then 'job.confirmed'
    when 'technician_on_way' then 'job.technician_on_way' when 'arrived' then 'job.arrived'
    when 'completed_pending_customer_confirmation' then 'job.completed_pending_customer_confirmation' when 'completed' then 'job.completed' else null end;
  if v_event is null then return new; end if;
  v_managed=exists(select 1 from private.admin_service_requests where job_id=new.id);
  select profile_id into v_customer_profile from public.customer_profiles where id=new.customer_id;
  if new.professional_id is not null then select profile_id into v_professional_profile from public.professional_profiles where id=new.professional_id; end if;
  if not (v_managed and new.status='pending_professional_acceptance') then
    perform private.enqueue_profile_delivery(v_event,'job',new.id,v_customer_profile,
      case when new.status='completed_pending_customer_confirmation' or (v_managed and new.status='confirmed') then array['in_app','email'] else array['in_app'] end,v_key);
  end if;
  perform private.enqueue_profile_delivery(v_event,'job',new.id,v_professional_profile,
    case when new.status='pending_professional_acceptance' then array['in_app','email'] else array['in_app'] end,v_key);
  perform private.enqueue_admin_delivery(v_event,'job',new.id,'operations',v_key);
  return new;
end $$;

create function private.admin_service_request_options(p_customer_id uuid default null,p_search text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.require_admin_request_management();
  if p_search is null or length(p_search)>100 then raise exception using errcode='22023',message='invalid_customer_search'; end if;
  return jsonb_build_object(
    'customers',coalesce((select jsonb_agg(to_jsonb(c)) from (
      select cp.id,concat_ws(' ',p.first_name,p.last_name) as name,p.email
      from public.customer_profiles cp join public.profiles p on p.id=cp.profile_id join auth.users u on u.id=p.auth_user_id
      where p.role='customer' and u.email_confirmed_at is not null and u.deleted_at is null
        and (u.banned_until is null or u.banned_until<=now())
        and (cp.id=p_customer_id or position(lower(btrim(p_search)) in lower(concat_ws(' ',p.first_name,p.last_name,p.email)))>0)
      order by (cp.id=p_customer_id) desc nulls last,p.first_name,cp.id limit 25) c),'[]'::jsonb),
    'addresses',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'label',concat_ws(' ',a.street,a.number)||', '||a.city))
      from public.customer_addresses a where a.customer_id=p_customer_id and a.archived_at is null),'[]'::jsonb),
    'equipment',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'addressId',e.address_id,'categoryId',e.category_id,'name',e.nickname))
      from public.customer_equipment e where e.customer_id=p_customer_id and e.archived_at is null),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name) from public.service_categories c where c.active),'[]'::jsonb),
    'issues',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'categoryId',i.category_id,'name',i.name) order by i.sort_order) from public.service_issue_types i where i.active),'[]'::jsonb),
    'professionals',coalesce((select jsonb_agg(to_jsonb(p)) from (
      select pro.id,concat_ws(' ',profile.first_name,profile.last_name) as name,
        exists(select 1 from public.mp_split_connected_accounts m where m.seller_id=pro.id::text and m.enabled) as "paymentAccountConnected"
      from public.professional_profiles pro join public.profiles profile on profile.id=pro.profile_id
      where pro.status='approved' and private.professional_clearance_valid(pro.id)
      order by profile.first_name,pro.id limit 200) p),'[]'::jsonb),
    'quotes',coalesce((select jsonb_agg(to_jsonb(q)) from (
      select id,left(quote->>'scope',120) as title,(quote->>'total')::numeric as total,
        (quote->>'platformFeeRate')::numeric*100 as "commissionRate"
      from public.service_quotes where customer_id=p_customer_id and quote_origin='calculator'
        and status in ('ready','accepted') order by created_at desc,id desc limit 25) q),'[]'::jsonb),
    'paymentCostRate',coalesce((private.get_quote_policy()->>'paymentCostRate')::numeric,0.06));
end $$;
create function public.admin_service_request_options(p_customer_id uuid default null,p_search text default '') returns jsonb
language sql security invoker set search_path='' as $$ select private.admin_service_request_options(p_customer_id,p_search); $$;

create function public.read_admin_service_requests(p_id uuid default null,p_limit integer default 25,
  p_cursor_at timestamptz default null,p_cursor_id uuid default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.read_admin_service_requests(p_id,p_limit,p_cursor_at,p_cursor_id); $$;
create function public.save_admin_service_request(p_input jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.save_admin_service_request(p_input); $$;
create function public.get_admin_service_request_for_job(p_job_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.get_admin_service_request_for_job(p_job_id); $$;
create function public.accept_admin_service_request(p_id uuid,p_expected_version integer,p_assignment_version integer,p_schedule_version integer) returns jsonb
language sql security invoker set search_path='' as $$ select private.accept_admin_service_request(p_id,p_expected_version,p_assignment_version,p_schedule_version); $$;

revoke all on function private.guard_admin_request_replacement_case(),private.guard_admin_request_replacement(),
  private.guard_administrative_quote_origin(),private.require_admin_request_management(),private.admin_request_record(uuid),private.guard_admin_request_job()
  from public,anon,authenticated,service_role;
revoke all on function private.read_customer_payment_summaries(uuid,text,integer,timestamptz,uuid),
  public.read_customer_payment_summaries(uuid,text,integer,timestamptz,uuid),private.admin_request_job_financials_visible(uuid),
  private.admin_service_request_options(uuid,text),public.admin_service_request_options(uuid,text),
  private.admin_request_financials_visible(uuid),private.read_admin_service_requests(uuid,integer,timestamptz,uuid),private.save_admin_service_request(jsonb),
  private.get_admin_service_request_for_job(uuid),private.accept_admin_service_request(uuid,integer,integer,integer),
  public.read_admin_service_requests(uuid,integer,timestamptz,uuid),public.save_admin_service_request(jsonb),
  public.get_admin_service_request_for_job(uuid),public.accept_admin_service_request(uuid,integer,integer,integer)
  from public,anon,authenticated,service_role;
grant execute on function private.read_customer_payment_summaries(uuid,text,integer,timestamptz,uuid),
  public.read_customer_payment_summaries(uuid,text,integer,timestamptz,uuid),private.admin_request_job_financials_visible(uuid),
  private.admin_service_request_options(uuid,text),public.admin_service_request_options(uuid,text),
  private.admin_request_financials_visible(uuid),private.read_admin_service_requests(uuid,integer,timestamptz,uuid),private.save_admin_service_request(jsonb),
  private.get_admin_service_request_for_job(uuid),private.accept_admin_service_request(uuid,integer,integer,integer),
  public.read_admin_service_requests(uuid,integer,timestamptz,uuid),public.save_admin_service_request(jsonb),
  public.get_admin_service_request_for_job(uuid),public.accept_admin_service_request(uuid,integer,integer,integer) to authenticated;
notify pgrst,'reload schema';
