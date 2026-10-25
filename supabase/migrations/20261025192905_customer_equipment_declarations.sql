-- Incident: customers completing Pedir could not obtain a price because every
-- active scope rejected equipment details entered in that same form.
-- Version the existing, approved policy; retain its rates, scopes, approver and
-- expiry. This does not activate an inactive policy or infer unknown equipment.
do $migration$
declare
  current_policy private.customer_request_policy_current%rowtype;
  previous_policy private.customer_request_policy_versions%rowtype;
  revised_scopes jsonb;
  revised_id uuid;
begin
  select * into current_policy from private.customer_request_policy_current
    where singleton for update;
  if not coalesce(current_policy.enabled, false) then return; end if;
  select * into previous_policy from private.customer_request_policy_versions
    where id = current_policy.policy_id;
  if previous_policy.id is null or previous_policy.approved_until <= clock_timestamp() then return; end if;

  select jsonb_object_agg(key, value || '{"allowCustomerEquipmentDeclaration":true}'::jsonb)
    into revised_scopes from jsonb_each(previous_policy.scopes);
  if revised_scopes = previous_policy.scopes then return; end if;

  insert into private.customer_request_policy_versions
    (quote_policy_id, scopes, approved_until, approved_by, reason)
  values (previous_policy.quote_policy_id, revised_scopes, previous_policy.approved_until,
    previous_policy.approved_by,
    'Corrección solicitada por el titular el 2026-10-25: aceptar capacidad y tecnología declaradas en Pedir. Se conserva la aprobación del alcance, tarifas y vigencia originales; no se completan datos desconocidos ni se modifican presupuestos históricos.')
  returning id into revised_id;

  update private.customer_request_policy_current
    set policy_id = revised_id, version = version + 1
    where singleton and policy_id = previous_policy.id;
  insert into public.admin_audit_logs (actor_profile_id, action, entity_type, entity_id, metadata)
  values (previous_policy.approved_by, 'customer_request.policy.declarations_enabled',
    'customer_request_policy', revised_id,
    jsonb_build_object('previousPolicyId', previous_policy.id,
      'quotePolicyId', previous_policy.quote_policy_id,
      'transport', 'owner_cli_migration', 'scopeApprovalInherited', true,
      'reason', 'Customer quote blockage reported by owner; allow explicit equipment declarations.'));
end;
$migration$;
