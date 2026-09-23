-- Report the full dossier readiness independently of the operational rollout.
-- Existing assignment flows bypass this diagnostic until the rollout is enabled.
create or replace function private.professional_ready_for_new_work(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select cardinality(private.professional_readiness_reasons(p_id))=0;
$$;
revoke all on function private.professional_ready_for_new_work(uuid)
  from public,anon,authenticated,service_role;
