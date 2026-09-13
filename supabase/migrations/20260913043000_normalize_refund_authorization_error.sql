create or replace function private.request_payment_refund(
  p_payment_id uuid,
  p_amount numeric,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_profile_id uuid;
  v_payment public.payments%rowtype;
  v_request private.payment_refund_requests%rowtype;
  v_normalized_reason text := btrim(p_reason);
  v_normalized_key text := btrim(p_idempotency_key);
  v_reserved_amount numeric(12,2);
begin
  if not private.has_admin_permission('finance') then
    raise exception using errcode = '42501', message = 'finance_required';
  end if;

  v_actor_profile_id := private.current_profile_id();
  if v_actor_profile_id is null then
    raise exception 'Authenticated admin profile required';
  end if;

  if coalesce(length(v_normalized_reason), 0) = 0 or length(v_normalized_reason) > 2000 then
    raise exception 'Refund reason required';
  end if;
  if coalesce(length(v_normalized_key), 0) = 0 or length(v_normalized_key) > 200 then
    raise exception 'Refund idempotency key required';
  end if;
  if p_amount is not null and p_amount <> round(p_amount, 2) then
    raise exception 'Refund amount must have at most two decimal places';
  end if;

  select p.* into v_payment from public.payments p where p.id = p_payment_id for update;
  if v_payment.id is null then raise exception 'Payment not found'; end if;
  if v_payment.provider <> 'mercadopago'
     or nullif(btrim(v_payment.provider_payment_id), '') is null
     or v_payment.status not in ('approved', 'captured', 'partially_refunded') then
    raise exception 'Payment is not eligible for Mercado Pago refund';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > v_payment.amount then
    raise exception 'Refund amount must be positive and not exceed payment amount';
  end if;

  select prr.* into v_request
  from private.payment_refund_requests prr
  where prr.idempotency_key = v_normalized_key;
  if v_request.id is not null then
    if v_request.payment_id <> p_payment_id or v_request.amount <> p_amount or v_request.reason <> v_normalized_reason then
      raise exception 'Refund idempotency key conflict';
    end if;
    return jsonb_build_object('id', v_request.id, 'status', v_request.status::text, 'idempotent', true);
  end if;

  select coalesce(sum(prr.amount), 0) into v_reserved_amount
  from private.payment_refund_requests prr
  where prr.payment_id = p_payment_id and prr.status in ('requested', 'processing', 'succeeded');
  if v_reserved_amount + p_amount > v_payment.amount then
    raise exception 'Refund amount exceeds unrefunded payment balance';
  end if;

  insert into private.payment_refund_requests(payment_id, amount, reason, idempotency_key, requested_by)
  values (p_payment_id, p_amount, v_normalized_reason, v_normalized_key, v_actor_profile_id)
  on conflict on constraint payment_refund_requests_idempotency_key_unique do nothing
  returning * into v_request;

  if v_request.id is null then
    select prr.* into v_request from private.payment_refund_requests prr where prr.idempotency_key = v_normalized_key;
    if v_request.id is null or v_request.payment_id <> p_payment_id or v_request.amount <> p_amount or v_request.reason <> v_normalized_reason then
      raise exception 'Refund idempotency key conflict';
    end if;
    return jsonb_build_object('id', v_request.id, 'status', v_request.status::text, 'idempotent', true);
  end if;

  perform private.append_admin_audit(
    'payment.refund.requested',
    'payment_refund_request',
    v_request.id,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'amount', p_amount,
      'currency', v_payment.currency,
      'status', v_request.status::text
    )
  );
  return jsonb_build_object('id', v_request.id, 'status', v_request.status::text, 'idempotent', false);
end;
$$;
