-- Run only inside an explicit transaction ending in ROLLBACK.
-- The caller supplies an owned, paid simulation job and an authenticated admin.
-- No provider calls, committed fixtures, or changes to the source job/payment.
-- SAVEPOINT also prevents accidental standalone execution outside a transaction.
savepoint admin_payments_test;
do $test$
#variable_conflict use_variable
declare
  source_job public.jobs%rowtype;
  request_id uuid:=gen_random_uuid(); job_id uuid:=gen_random_uuid();
  admin_claims jsonb; customer_claims jsonb; pro_claims jsonb;
  rate numeric; result jsonb; zero_result jsonb; rejected_result jsonb; retry jsonb; refund_result jsonb;
  fake_payment uuid:=gen_random_uuid(); refund_key text:=gen_random_uuid()::text; denied boolean;
  key_standard uuid:=gen_random_uuid(); key_zero uuid:=gen_random_uuid();
  checkout public.marketplace_checkouts%rowtype; again public.marketplace_checkouts%rowtype;
  count_before integer; status_name text; visit jsonb;
begin
  select * into strict source_job from public.jobs where id=current_setting('lysto.qa.source_job')::uuid;
  if source_job.status<>'completed' then raise exception 'QA requires the completed simulation fixture'; end if;
  select jsonb_build_object('sub',u.id,'role','authenticated','aal','aal2','session_id',s.id,
    'app_metadata',jsonb_build_object('app_role','admin')) into strict admin_claims
  from auth.users u join auth.sessions s on s.user_id=u.id
  where lower(u.email)=lower(current_setting('lysto.qa.admin_email'))
    and s.aal='aal2' and private.session_is_active(u.id,s.id) order by s.created_at desc limit 1;
  select jsonb_build_object('sub',p.auth_user_id,'role','authenticated','aal',s.aal::text,'session_id',s.id,
    'app_metadata',jsonb_build_object('app_role','customer')) into strict customer_claims
  from public.customer_profiles c join public.profiles p on p.id=c.profile_id
  join auth.sessions s on s.user_id=p.auth_user_id
  where c.id=source_job.customer_id and private.session_is_active(s.user_id,s.id) order by s.created_at desc limit 1;
  select jsonb_build_object('sub',p.auth_user_id,'role','authenticated','aal',s.aal::text,'session_id',s.id,
    'app_metadata',jsonb_build_object('app_role','professional')) into strict pro_claims
  from public.professional_profiles p0 join public.profiles p on p.id=p0.profile_id
  join auth.sessions s on s.user_id=p.auth_user_id
  where p0.id=source_job.professional_id and private.session_is_active(s.user_id,s.id) order by s.created_at desc limit 1;
  perform set_config('request.jwt.claims',admin_claims::text,true);
  rate:=(public.get_admin_payment_context()->>'commissionRate')::numeric;
  insert into public.service_requests(id,customer_id,category_id,issue_type_id,status,address_id,
    preferred_date,preferred_time_window,equipment_id)
  select request_id,customer_id,category_id,issue_type_id,status,address_id,
    preferred_date,preferred_time_window,equipment_id from public.service_requests where id=source_job.request_id;
  insert into public.jobs(id,request_id,customer_id,professional_id,status)
  values(job_id,request_id,source_job.customer_id,source_job.professional_id,'confirmed');
  insert into public.service_quotes(customer_id,address,input,quote,preferred_date,time_window,status,
    expires_at,request_id,accepted_at,policy_id,policy_snapshot)
  select customer_id,address,input,quote,preferred_date,time_window,'accepted',
    now()+interval '1 day',request_id,now(),policy_id,policy_snapshot
  from public.service_quotes q where q.request_id=source_job.request_id and q.status='accepted';

  set local role authenticated;
  begin
    retry:=public.request_job_cancellation(job_id,'QA cancelación antes de emitir enlace',0);
    if (retry->>'requiresFinancialReview')::boolean then raise exception 'unpaid cancellation required review'; end if;
    raise exception using errcode='ZQ001',message='rollback temporary cancellation';
  exception when sqlstate 'ZQ001' then null; end;
  result:=public.create_admin_charge(job_id,'QA cobro normal','Solicitud simulada con rollback',100,'standard',rate,'Ensayo aislado sin dinero real',key_standard);
  if result->>'status'<>'proposed' or (result->>'platform_fee')::numeric<>round(100*rate,2)
    or (result->>'professional_amount')::numeric<>100-round(100*rate,2)
  then raise exception 'normal charge snapshot failed'; end if;
  if result ? 'admin_reason' or result ? 'admin_created_by'
    or has_table_privilege('authenticated','private.admin_charge_details','SELECT')
  then raise exception 'internal administrative details leaked'; end if;
  retry:=public.get_admin_payment_context(job_id::text,null);
  if jsonb_array_length(retry->'jobs')<>1 or retry->'jobs'->0->>'id'<>job_id::text
  then raise exception 'exact historical service search failed'; end if;
  retry:=public.get_admin_payment_context('no matching service qa',array[job_id]);
  if jsonb_array_length(retry->'jobs')<>1 or (retry->'jobs'->0->>'matchesSearch')::boolean
  then raise exception 'exact recipient lookup outside search failed'; end if;
  retry:=public.create_admin_charge(job_id,'QA cobro normal','Solicitud simulada con rollback',100,'standard',rate,'Ensayo aislado sin dinero real',key_standard);
  if retry->>'id'<>result->>'id' then raise exception 'idempotent retry duplicated charge'; end if;
  begin
    perform public.create_admin_charge(job_id,'QA cobro normal','Solicitud simulada con rollback',101,'standard',rate,'Ensayo aislado sin dinero real',key_standard);
    raise exception 'changed retry was accepted';
  exception when serialization_failure then null; end;
  begin
    perform public.create_admin_charge(job_id,'QA cobro normal','Solicitud simulada con rollback',100,'standard',0.499999,'Ensayo aislado sin dinero real',gen_random_uuid());
    raise exception 'stale commission was accepted';
  exception when serialization_failure then null; end;
  zero_result:=public.create_admin_charge(job_id,'QA cobro sin comisión','Solicitud simulada con rollback',100,'none',0,'Ensayo aislado sin dinero real',key_zero);
  if (zero_result->>'platform_fee')::numeric<>0 or (zero_result->>'professional_amount')::numeric<>100 then raise exception 'zero commission failed'; end if;
  rejected_result:=public.create_admin_charge(job_id,'QA propuesta rechazada','Solicitud simulada con rollback',50,'none',0,'Ensayo aislado sin dinero real',gen_random_uuid());
  perform set_config('request.jwt.claims',jsonb_set(admin_claims,'{aal}','"aal1"')::text,true);
  begin
    perform public.get_admin_payment_context(); raise exception 'admin without MFA allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',pro_claims::text,true);
  begin
    perform public.create_admin_charge(job_id,'QA cobro intruso','Solicitud simulada con rollback',100,'none',0,'Ensayo aislado sin dinero real',gen_random_uuid());
    raise exception 'professional created administrative charge';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',customer_claims::text,true);
  begin
    perform public.get_admin_payment_context(); raise exception 'customer read admin context';
  exception when insufficient_privilege then null; end;
  perform public.decide_job_extra_v2((result->>'id')::uuid,'accepted',gen_random_uuid());
  perform public.decide_job_extra_v2((zero_result->>'id')::uuid,'accepted',gen_random_uuid());
  perform public.decide_job_extra_v2((rejected_result->>'id')::uuid,'rejected',gen_random_uuid());
  begin
    perform public.decide_job_extra_v2((rejected_result->>'id')::uuid,'accepted',gen_random_uuid());
    raise exception 'rejected charge changed to accepted';
  exception when serialization_failure then null; end;
  reset role;
  select count(*) into count_before from public.marketplace_checkouts where public.marketplace_checkouts.job_id=job_id;
  if count_before<>0 then raise exception 'proposal or acceptance automatically created checkout'; end if;
  checkout:=private.prepare_marketplace_checkout_before_automatic_request(source_job.customer_id,job_id,(result->>'id')::uuid,false);
  again:=private.prepare_marketplace_checkout_before_automatic_request(source_job.customer_id,job_id,(result->>'id')::uuid,false);
  if checkout.id<>again.id or checkout.marketplace_fee<>round(100*rate,2) then raise exception 'checkout snapshot or idempotency failed'; end if;
  again:=private.prepare_marketplace_checkout_before_automatic_request(source_job.customer_id,job_id,(zero_result->>'id')::uuid,false);
  if again.marketplace_fee<>0 or again.professional_amount<>100 then raise exception 'zero commission checkout failed'; end if;
  begin
    update public.job_extras set amount=101 where id=(result->>'id')::uuid;
    raise exception 'accepted charge was mutable';
  exception when serialization_failure then null; end;
  begin
    insert into public.marketplace_checkouts(job_id,extra_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode)
    values(job_id,(rejected_result->>'id')::uuid,source_job.customer_id,source_job.professional_id,checkout.seller_account_id,50,0,false);
    raise exception 'rejected proposal had checkout';
  exception when check_violation then null; end;
  -- Synthetic approved payment: never sent to Mercado Pago and never committed.
  insert into public.marketplace_checkouts(job_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode,status)
  values(job_id,source_job.customer_id,source_job.professional_id,checkout.seller_account_id,100,18,false,'approved');
  insert into public.payments(id,job_id,request_id,customer_id,professional_id,provider,provider_payment_id,amount,marketplace_fee,professional_amount,status)
  values(fake_payment,job_id,request_id,source_job.customer_id,source_job.professional_id,'mercadopago','qa-rollback-'||fake_payment,100,18,82,'approved');
  perform set_config('request.jwt.claims',admin_claims::text,true);
  set local role authenticated;
  refund_result:=public.request_payment_refund(fake_payment,25,'QA reintegro parcial sin ejecución',refund_key);
  retry:=public.request_payment_refund(fake_payment,25,'QA reintegro parcial sin ejecución',refund_key);
  if retry->>'id'<>refund_result->>'id' then raise exception 'refund retry duplicated request'; end if;
  perform public.request_payment_refund(fake_payment,75,'QA reintegro del saldo sin ejecución',gen_random_uuid()::text);
  denied:=false;
  begin
    perform public.request_payment_refund(fake_payment,0.01,'QA saldo completamente reservado',gen_random_uuid()::text);
  exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'overrefund was allowed'; end if;
  begin
    retry:=public.request_job_cancellation(job_id,'QA cancelación después de pago simulado',0);
    if not (retry->>'requiresFinancialReview')::boolean then raise exception 'paid cancellation skipped reconciliation'; end if;
    raise exception using errcode='ZQ001',message='rollback temporary paid cancellation';
  exception when sqlstate 'ZQ001' then null; end;
  reset role;
  perform set_config('request.jwt.claims',customer_claims::text,true);
  -- Only new, uncommitted rows are changed to inspect all visit stages.
  insert into public.job_schedule_reservations(job_id,professional_id,state,version,starts_at,ends_at,local_visit_date,timezone,duration_minutes,travel_buffer_minutes,created_by)
  select job_id,professional_id,'confirmed',1,starts_at+interval '3 years',ends_at+interval '3 years',local_visit_date+interval '3 years',timezone,duration_minutes,travel_buffer_minutes,created_by
  from public.job_schedule_reservations where public.job_schedule_reservations.job_id=source_job.id order by version desc limit 1;
  foreach status_name in array array['confirmed','technician_on_way','arrived','onsite_diagnosis','waiting_customer_approval','in_progress','completed_pending_customer_confirmation','completed'] loop
    update public.jobs set status=status_name::public.job_status where id=job_id;
    visit:=public.get_job_visit(job_id);
    if visit is null or visit->>'addressLabel' is null then raise exception 'visit missing in status %',status_name; end if;
  end loop;
  perform set_config('request.jwt.claims',admin_claims::text,true);
  begin
    perform public.create_admin_charge(job_id,'QA trabajo terminado','Solicitud simulada con rollback',100,'none',0,'Ensayo aislado sin dinero real',gen_random_uuid());
    raise exception 'completed job accepted new charge';
  exception when serialization_failure then null; end;
  if not (select relrowsecurity from pg_class where oid='public.job_extras'::regclass)
    or has_table_privilege('authenticated','public.job_extras','INSERT')
    or has_function_privilege('anon','public.create_admin_charge(uuid,text,text,numeric,text,numeric,text,uuid)','EXECUTE')
  then raise exception 'RLS or grants regression'; end if;
end;
$test$;
rollback to savepoint admin_payments_test;
release savepoint admin_payments_test;
