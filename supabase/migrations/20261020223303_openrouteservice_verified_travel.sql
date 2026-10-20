-- Accept verified OpenRouteService routes without changing prices, historical rows or ACLs.
CREATE OR REPLACE FUNCTION private.persist_customer_request_preview(p_actor_user_id uuid, p_actor_session_id uuid, p_customer_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid; v_claims text:=current_setting('request.jwt.claims',true); v_current jsonb; v_id uuid;
begin
  v_actor:=private.customer_request_actor(p_actor_user_id,p_actor_session_id,p_customer_id);
  v_current:=private.read_customer_request_context(p_actor_user_id,p_actor_session_id,p_customer_id,p_payload->'input');
  if v_current->>'reason' is not null then
    perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
    return jsonb_build_object('status',case when v_current->>'reason'='no_available_professional' then 'unavailable' else 'needs_review' end,'reason',v_current->>'reason'); end if;
  if v_current->'context' is distinct from p_payload->'context'
    or v_current->'policy'->>'id' is distinct from p_payload->>'policyId'
    or v_current->'quotePolicy'->>'id' is distinct from p_payload->>'quotePolicyId'
    or v_current->'quotePolicy'->'policy' is distinct from p_payload->'quotePolicySnapshot'
    or v_current->'policy'->'scope' is distinct from p_payload->'scope'
    or not exists(select 1 from jsonb_array_elements(v_current->'candidates') c where c->>'professionalId'=p_payload->>'professionalId'
      and c->>'sellerAccountId'=p_payload->>'sellerAccountId' and c->>'origin'=p_payload->>'origin') then
    raise exception using errcode='PT409',message='Preview context changed'; end if;
  if p_payload->'quote'->>'currency' is distinct from 'ARS' or p_payload->'quote'->>'contractScope' is distinct from 'initial_labor'
    or p_payload->'quote'->'reviewReasons' is distinct from '[]'::jsonb or p_payload->'quote'->>'readyToOffer' is distinct from 'true'
    or coalesce(p_payload->'route'->>'source','') not in ('google','openrouteservice') or p_payload->'route'->>'tollsVerified' is distinct from 'true'
    or p_payload->'quote'->>'coverage' is distinct from 'covered' or p_payload->'calculatedInput'->>'materialsConfirmed' is distinct from 'false'
    or p_payload->'calculatedInput'->'materials' is distinct from '[]'::jsonb
    or p_payload->'quote'->'route'->>'origin' is distinct from 'Origen del profesional'
    or p_payload->'quote'->'route'->>'destination' is distinct from 'Dirección de visita'
    or p_payload->'calculatedInput'->'route' is distinct from p_payload->'quote'->'route'
    or ((p_payload->'quote'->'route')-array['origin','destination']) is distinct from ((p_payload->'route')-array['origin','destination'])
    or not coalesce((p_payload->'quote'->>'total')::numeric=round((p_payload->'quote'->>'calculatorSubtotal')::numeric*1.3,2),false)
    or not coalesce((p_payload->'quote'->>'platformFee')::numeric=round((p_payload->'quote'->>'total')::numeric*(p_payload->'quotePolicySnapshot'->>'platformFeeRate')::numeric,2),false)
    or not coalesce((p_payload->'quote'->>'professionalAmount')::numeric=(p_payload->'quote'->>'total')::numeric-(p_payload->'quote'->>'platformFee')::numeric,false)
    or coalesce((p_payload->'quote'->>'professionalAmount')::numeric,-1)<coalesce((p_payload->'quote'->>'calculatorSubtotal')::numeric,1000000000)
    or (p_payload->>'expiresAt')::timestamptz<=clock_timestamp()
    or (p_payload->>'expiresAt')::timestamptz>clock_timestamp()+interval '30 minutes'
    or (p_payload->'route'->>'measuredAt')::timestamptz<clock_timestamp()-interval '30 minutes' then
    raise exception using errcode='22023',message='Verified complete initial labor quote required'; end if;
  insert into private.customer_request_previews(customer_id,actor_profile_id,input,context_snapshot,policy_id,quote_policy_id,
    professional_id,seller_account_id,origin,live_mode,payload,expires_at)
  values(p_customer_id,v_actor,p_payload->'input',p_payload->'context',(p_payload->>'policyId')::uuid,(p_payload->>'quotePolicyId')::uuid,
    (p_payload->>'professionalId')::uuid,p_payload->>'sellerAccountId',p_payload->>'origin',(p_payload->>'liveMode')::boolean,p_payload,(p_payload->>'expiresAt')::timestamptz) returning id into v_id;
  perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
  return jsonb_build_object('status','ready','previewId',v_id,'quote',p_payload->'quote','scope',p_payload->'quote'->>'scope',
    'exclusions',p_payload->'quote'->'exclusions','expiresAt',p_payload->>'expiresAt');
end; $function$;

CREATE OR REPLACE FUNCTION private.assert_quote_offerable(p_quote_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare q public.service_quotes%rowtype; policy uuid; value jsonb; route jsonb; owner_test boolean;
begin
  select * into q from public.service_quotes where id=p_quote_id;
  select c.policy_id,v.policy into policy,value
    from private.quote_policy_current c
    left join private.quote_policy_versions v on v.id=c.policy_id
    where c.singleton for share of c;
  owner_test=private.is_owner_maintenance_test_quote(q.customer_id,q.input,q.quote);
  if q.id is null or q.policy_id is distinct from policy
    or (policy is not null and q.policy_snapshot is distinct from value)
    or (not owner_test and (policy is null or value->>'approvedUntil' is null
      or (value->>'approvedUntil')::date < (now() at time zone 'America/Argentina/Buenos_Aires')::date))
    then raise exception using errcode='22023',message='Current approved tariff required'; end if;
  if q.expires_at<=now() or ((q.preferred_date+substring(q.time_window from '^\d{2}:\d{2}')::time) at time zone 'America/Argentina/Buenos_Aires')<=now()
    then raise exception using errcode='22023',message='Quote expired: recalculate'; end if;
  perform private.validate_quote_uploads(q.customer_id,q.upload_intent_ids);
  route=q.quote->'route';
  if q.quote->>'currency' is distinct from 'ARS' or q.quote->>'coverage' is distinct from 'covered'
    or coalesce(route->>'source','') not in ('manual','google','openrouteservice') or coalesce(route->>'province','') not in ('CABA','Buenos Aires')
    or coalesce((route->>'outboundMinutes')::numeric,10000)>180
    or coalesce((route->>'tollsVerified')::boolean,false)=false
    or coalesce((q.input->>'materialsConfirmed')::boolean,false)=false
    or route->>'measuredAt' is null or (route->>'measuredAt')::timestamptz<now()-interval '30 minutes' or (route->>'measuredAt')::timestamptz>now()+interval '1 minute'
    or (route->>'source'='manual' and (q.created_by is null or length(trim(coalesce(q.manual_route_reason,'')))<15))
    or q.input->'equipment'->>'capacity' is null or coalesce(q.input->'equipment'->>'technology','unknown') not in ('conventional','inverter')
    or (not owner_test and coalesce((q.quote->>'professionalAmount')::numeric,-1)<coalesce((q.quote->>'calculatorSubtotal')::numeric,1000000000))
    or not coalesce((q.quote->>'professionalAmount')::numeric=(q.quote->>'total')::numeric-(q.quote->>'platformFee')::numeric,false)
    or coalesce((q.quote->>'platformContribution')::numeric,-1)<0
    then raise exception using errcode='22023',message='Verified complete quote inputs required'; end if;
end; $function$;
