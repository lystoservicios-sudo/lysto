create or replace function private.professional_review_context(p_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_id uuid:=coalesce(p_id,private.current_professional_id(false));v_documents jsonb;v_submission uuid;v_reason text;
begin
  if not private.has_admin_permission('operations') and (v_id is null or v_id is distinct from private.current_professional_id(false)) then raise exception using errcode='42501',message='Professional review access denied'; end if;
  select current_submission_id into v_submission from public.professional_profiles where id=v_id;
  if not found then raise exception using errcode='P0002',message='Application unavailable'; end if;
  if not private.has_admin_permission('operations') then perform private.read_professional_onboarding(); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'documentType',d.document_type,'status',d.status,'version',d.version,'expiresAt',d.expires_at,
    'reviewedBy',d.reviewed_by,'reviewedAt',d.reviewed_at,'reason',d.review_reason,'createdAt',d.created_at,
    'inSubmission',exists(select 1 from private.professional_application_submissions s where s.id=v_submission and d.id=any(s.document_ids)))
    order by d.created_at desc,d.id desc),'[]'::jsonb)
    into v_documents from public.professional_documents d where d.professional_id=v_id;
  select metadata->>'reason' into v_reason from public.admin_audit_logs
    where entity_id=v_id and action in ('professional.approved','professional.rejected')
    order by created_at desc,id desc limit 1;
  return jsonb_build_object('application',private.professional_application_document(v_id),'requirements',private.professional_requirements(v_id),
    'documents',v_documents,'decisionReason',v_reason,'eligible',private.professional_clearance_valid(v_id));
end;
$$;
