-- A professional covering CABA also covers its neighborhoods. Keep the exact-city path
-- and every credential, schedule, reservation and payment-account eligibility check.
CREATE OR REPLACE FUNCTION private.read_customer_request_context(p_actor_user_id uuid, p_actor_session_id uuid, p_customer_id uuid, p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_claims text:=current_setting('request.jwt.claims',true); v_context jsonb; v_policy private.customer_request_policy_versions%rowtype;
  v_quote private.quote_policy_versions%rowtype; v_scope jsonb; v_reason text; v_start timestamptz; v_category uuid; v_candidates jsonb:='[]'::jsonb;
begin
  perform private.customer_request_actor(p_actor_user_id,p_actor_session_id,p_customer_id);
  v_context:=private.customer_request_context_snapshot(p_customer_id,p_input);
  perform private.validate_quote_uploads(p_customer_id,array(select value::uuid from jsonb_array_elements_text(coalesce(p_input->'uploadIntentIds','[]'::jsonb))));
  select q.* into v_quote from private.quote_policy_current c join private.quote_policy_versions q on q.id=c.policy_id where c.singleton;
  select p.* into v_policy from private.customer_request_policy_current c join private.customer_request_policy_versions p on p.id=c.policy_id
    where c.singleton and c.enabled and p.approved_until>clock_timestamp();
  v_scope:=v_policy.scopes->(p_input->>'issue');
  v_start:=((p_input->>'preferredDate')::date+substring(p_input->>'timeWindow' from '^\d{2}:\d{2}')::time) at time zone 'America/Argentina/Buenos_Aires';
  if v_start is null or v_start<=clock_timestamp() then raise exception using errcode='22023',message='Future visit preference required'; end if;
  if p_input->>'timeWindow'<>all(array['08:00 – 10:00','10:00 – 12:00','14:00 – 16:00','16:00 – 18:00','18:00 – 20:00']) then
    raise exception using errcode='22023',message='Invalid visit preference'; end if;
  if v_quote.id is null or v_quote.policy->>'approvedUntil' is null or
    (v_quote.policy->>'approvedUntil')::date<(clock_timestamp() at time zone 'America/Argentina/Buenos_Aires')::date then v_reason:='tariffs_unapproved';
  elsif v_policy.id is null or v_policy.quote_policy_id<>v_quote.id or v_scope is null then v_reason:='initial_scope_unavailable';
  elsif p_input->>'issue'='unknown' then v_reason:='diagnosis_required';
  elsif (v_context->'equipment'->>'capacity')::integer>18000 then v_reason:='capacity_outside_catalog';
  elsif v_context->'equipment'->>'capacity' is null or v_context->'equipment'->>'technology'='unknown' then v_reason:='equipment_unknown';
  elsif (v_context->'equipment'->>'declarationUsed')::boolean and not coalesce((v_scope->>'allowCustomerEquipmentDeclaration')::boolean,false) then v_reason:='equipment_declaration_requires_review';
  end if;
  select id into v_category from public.service_categories where slug='aire_acondicionado' and active;
  if v_reason is null and (v_category is null or v_context->'equipment'->>'categoryId' is distinct from v_category::text) then v_reason:='equipment_category_unavailable'; end if;
  if v_reason is null then
    select coalesce(jsonb_agg(candidate.document order by candidate.score desc,candidate.rating desc nulls last,candidate.id),'[]'::jsonb) into v_candidates
    from (select p.id,p.internal_score as score,p.rating_avg as rating,jsonb_build_object('professionalId',p.id,'origin',p.base_location,'sellerAccountId',m.mercado_pago_user_id) as document
      from public.professional_profiles p join public.mp_split_connected_accounts m on m.seller_id=p.id::text and m.enabled
      where (private.customer_request_candidate_is_eligible(v_category,v_context->'address'->>'city',p.id,v_start,
        v_start+(v_scope->>'durationMinutes')::integer*interval '1 minute',(v_scope->>'travelBufferMinutes')::integer)
        or (lower(v_context->'address'->>'province') in ('caba','ciudad autónoma de buenos aires','ciudad autonoma de buenos aires','capital federal')
          and private.customer_request_candidate_is_eligible(v_category,'CABA',p.id,v_start,
        v_start+(v_scope->>'durationMinutes')::integer*interval '1 minute',(v_scope->>'travelBufferMinutes')::integer)))
      order by p.internal_score desc,p.rating_avg desc nulls last,p.id limit 5) candidate;
    if jsonb_array_length(v_candidates)=0 then v_reason:='no_available_professional'; end if;
  end if;
  perform set_config('request.jwt.claims',coalesce(v_claims,''),true);
  return jsonb_build_object('context',v_context,'policy',case when v_policy.id is not null and v_scope is not null then
    jsonb_build_object('id',v_policy.id,'quotePolicyId',v_policy.quote_policy_id,'approvedUntil',v_policy.approved_until,'scope',v_scope) end,
    'quotePolicy',jsonb_build_object('id',v_quote.id,'policy',v_quote.policy),'candidates',v_candidates,'reason',v_reason);
end; $function$;
