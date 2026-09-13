create or replace function private.prepare_marketplace_checkout(p_customer uuid,p_job uuid,p_extra uuid,p_live boolean)
returns public.marketplace_checkouts language plpgsql set search_path='' as $$
declare j public.jobs%rowtype; q public.service_quotes%rowtype; e public.job_extras%rowtype; c public.marketplace_checkouts%rowtype; account_id text; total numeric; fee numeric;
begin
 select * into j from public.jobs where id=p_job and customer_id=p_customer for update;
 if j.id is null then raise exception 'payment_forbidden'; end if;
 if j.professional_id is null or j.status not in ('confirmed','technician_on_way','arrived','onsite_diagnosis','waiting_customer_approval','in_progress','completed_pending_customer_confirmation','completed') then raise exception 'professional_acceptance_required'; end if;
 if not exists(select 1 from public.professional_profiles where id=j.professional_id and status='approved') then raise exception 'professional_acceptance_required'; end if;
 select mercado_pago_user_id into account_id from public.mp_split_connected_accounts where seller_id=j.professional_id::text and enabled for update;
 if account_id is null then raise exception 'seller_not_linked'; end if;
 select * into q from public.service_quotes where request_id=j.request_id and status='accepted';
 if q.id is null then raise exception 'accepted_quote_required'; end if;
 if p_extra is null then total:=(q.quote->>'total')::numeric; fee:=(q.quote->>'platformFee')::numeric;
 else
   select * into e from public.job_extras where id=p_extra and job_id=j.id and professional_id=j.professional_id and status='accepted';
   if e.id is null then raise exception 'accepted_extra_required'; end if;
   total:=e.amount; fee:=0;
 end if;
 select * into c from public.marketplace_checkouts where job_id=j.id and extra_id is not distinct from p_extra for update;
 if c.id is not null then
   if c.professional_id<>j.professional_id or c.seller_account_id<>account_id or c.amount<>total or c.marketplace_fee<>fee or c.live_mode<>p_live then raise exception 'checkout_identity_changed'; end if;
   return c;
 end if;
 insert into public.marketplace_checkouts(job_id,extra_id,customer_id,professional_id,seller_account_id,amount,marketplace_fee,live_mode)
 values(j.id,p_extra,p_customer,j.professional_id,account_id,total,fee,p_live) returning * into c;
 return c;
end $$;

create function private.protect_marketplace_account() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.marketplace_checkouts where professional_id::text=old.seller_id)
 and (tg_op='DELETE' or new.mercado_pago_user_id is distinct from old.mercado_pago_user_id or new.enabled=false or new.seller_id is distinct from old.seller_id) then
   raise exception 'seller_has_payments';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger marketplace_account_guard before update or delete on public.mp_split_connected_accounts for each row execute function private.protect_marketplace_account();

create or replace function private.protect_paid_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.professional_id is distinct from old.professional_id and exists(select 1 from public.marketplace_checkouts where job_id=old.id) then
   raise exception 'A checkout pins its professional: close this service before creating a replacement';
 end if;
 if new.status::text like 'cancelled%' and new.status is distinct from old.status
 and exists(select 1 from public.marketplace_checkouts where job_id=old.id and (status not in ('expired','refunded') or expires_at>now())) then
   raise exception 'Reconcile or refund the checkout before cancelling its service';
 end if;
 if new.status in ('technician_on_way','arrived','onsite_diagnosis','in_progress') and new.status is distinct from old.status
 and exists(select 1 from public.service_quotes where request_id=old.request_id and accepted_at is not null)
 and not exists(select 1 from public.marketplace_checkouts where job_id=old.id and extra_id is null and status='approved') then
   raise exception 'Initial payment must be approved before the visit';
 end if;
 return new;
end $$;
create or replace function private.review_service_quote(p_quote_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.service_quotes%rowtype;
begin
  if not private.has_admin_permission('operations') then raise exception 'Operations permission required'; end if;
  if length(trim(coalesce(p_reason,''))) < 15 then raise exception 'Document verified scope, costs and exclusions'; end if;
  select * into q from public.service_quotes where id = p_quote_id for update;
  if q.id is null or q.status = 'accepted' then raise exception 'Quote unavailable'; end if;
  if q.expires_at <= now() then raise exception 'Quote expired: recalculate'; end if;
  if q.quote->>'coverage' is distinct from 'covered' or q.quote->'route'->>'source' = 'simulation'
     or coalesce((q.quote->>'platformContribution')::numeric, -1) < 0 or (q.quote->>'professionalAmount')::numeric - coalesce((q.quote->>'paymentCostBudget')::numeric,0) < (q.quote->>'calculatorSubtotal')::numeric then raise exception 'Quote cannot be offered'; end if;
  -- Missing materials must be priced or explicitly confirmed as unnecessary before review.
  if coalesce((q.input->>'materialsConfirmed')::boolean, false) = false then raise exception 'Confirm material scope before review'; end if;
  if coalesce((q.quote->'route'->>'tollsVerified')::boolean, false) = false then raise exception 'Verify tolls before review'; end if;
  update public.service_quotes set status = 'ready', reviewed_by = private.current_profile_id(), review_reason = trim(p_reason), reviewed_at = now() where id = q.id;
  return jsonb_build_object('id', q.id, 'status', 'ready');
end;
$$;
