-- Public customer replies are allowed while a case is open. Staff decisions,
-- assignment, internal notes, RLS and the existing function OIDs/ACL stay intact.
-- Only deliberate business conflicts become PT409 (not retryable SQLSTATE 40001).
do $migration$
declare
  v_signature text;
  v_oid oid;
  v_definition text;
  v_identity jsonb;
  v_after jsonb;
  v_old text;
  v_new text;
begin
  foreach v_signature in array array[
    'public.open_support_case(uuid,text,text,boolean,boolean,boolean,uuid[],uuid)',
    'public.open_warranty_claim(uuid,text,boolean,uuid[],uuid)',
    'public.update_support_case(uuid,text,integer,text,text,uuid,uuid[],text,boolean)',
    'private.can_read_upload(private.upload_intents,public.profiles)'
  ] loop
    v_oid := to_regprocedure(v_signature);
    if v_oid is null then raise exception 'support_reply_preimage_mismatch: missing %', v_signature; end if;
    -- proacl, owner, security-definer flag, search_path and all other metadata
    -- must be unchanged after replacing only the function body.
    select to_jsonb(p)-'prosrc', pg_get_functiondef(p.oid) into v_identity,v_definition from pg_proc p where p.oid=v_oid;
    if not coalesce((v_identity->>'prosecdef')::boolean,false)
       or v_identity->'proconfig' is distinct from '["search_path=\"\""]'::jsonb then
      raise exception 'support_reply_preimage_mismatch: metadata %',v_signature;
    end if;
    if v_signature not like 'private.can_read_upload(%' then
      if strpos(v_definition,'errcode=''40001''')=0 then
        raise exception 'support_reply_preimage_mismatch: conflict %',v_signature;
      end if;
      v_definition := replace(v_definition,'errcode=''40001''','errcode=''PT409''');
    end if;

    if v_signature like 'public.update_support_case(%' then
      for v_old,v_new in select * from (values
        ($old$v_case.version<>p_expected_version$old$,$new$v_case.version is distinct from p_expected_version$new$),
        ($old$if p_internal_note is not null and not v_is_admin then$old$,$new$if coalesce(p_communication_failed,false) and not v_is_admin then raise exception using errcode='42501',message='communication_flag_forbidden';end if;
  if p_internal_note is not null and not v_is_admin then$new$),
        ($old$p_action='customer_replied' and v_case.customer_id<>private.current_customer_id()$old$,$new$p_action='customer_replied' and (private.current_customer_id() is null or v_case.customer_id is distinct from private.current_customer_id())$new$),
        ($old$p_action='professional_replied' and v_case.professional_id<>private.current_professional_id(false)$old$,$new$p_action='professional_replied' and (private.current_professional_id(false) is null or v_case.professional_id is distinct from private.current_professional_id(false))$new$),
        ($old$when v_case.status='waiting_customer' and p_action='customer_replied' then 'in_review'$old$,$new$when v_case.status='waiting_customer' and p_action='customer_replied' then 'in_review'
    when v_case.status in('open','in_review','waiting_professional') and p_action='customer_replied' then v_case.status$new$)
      ) as replacements(old_source,new_source) loop
        if array_length(string_to_array(v_definition,v_old),1)<>2 then
          raise exception 'support_reply_preimage_mismatch: reply %',v_old;
        end if;
        v_definition:=replace(v_definition,v_old,v_new);
      end loop;
    elsif v_signature like 'private.can_read_upload(%' then
      -- General support photos have no request entity. Only a verified photo
      -- actually attached to a visible case can be shared with its participants.
      v_old := $old$if p_intent.entity_id is null then return p_intent.owner_profile_id=p_actor.id; end if;$old$;
      v_new := $new$if p_intent.entity_id is null then
      return p_intent.owner_profile_id=p_actor.id or (
        p_actor.id=private.current_profile_id() and exists(
          select 1 from public.support_case_events e join public.complaints c on c.id=e.case_id
          where p_intent.attachment_id=any(e.evidence_ids) and coalesce(private.support_case_visible(c),false)
        )
      );
    end if;$new$;
      if array_length(string_to_array(v_definition,v_old),1)<>2 then
        raise exception 'support_reply_preimage_mismatch: support_evidence';
      end if;
      v_definition:=replace(v_definition,v_old,v_new);
    elsif v_signature like 'public.open_warranty_claim(%' then
      v_old := $old$if not found then raise exception using errcode='P0002',message='job_not_found';end if;$old$;
      v_new := $new$if not found then raise exception using errcode='P0002',message='job_not_found';end if;
  if v_job.status is distinct from 'completed' or v_job.completed_at is null then raise exception using errcode='22023',message='completed_service_required';end if;$new$;
      if array_length(string_to_array(v_definition,v_old),1)<>2 then
        raise exception 'support_reply_preimage_mismatch: warranty';
      end if;
      v_definition:=replace(v_definition,v_old,v_new);
    end if;

    execute v_definition;
    select to_jsonb(p)-'prosrc' into v_after from pg_proc p where p.oid=v_oid;
    if v_identity is distinct from v_after then raise exception 'support_reply_metadata_changed: %',v_signature; end if;
  end loop;
end;
$migration$;

-- Customer replies have a separate durable command boundary. A lost HTTP
-- response replays its result before the optimistic version check, not a second
-- public message with a newer version. No staff-only fields are accepted.
create function private.reply_customer_support_case(p_case_id uuid,p_expected_version integer,p_public_message text,p_evidence_ids uuid[],p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $reply$
declare
  v_actor uuid:=private.current_profile_id();
  v_customer uuid:=private.current_customer_id();
  v_hash text;
  v_command private.support_case_commands%rowtype;
  v_result jsonb;
begin
  if v_actor is null or v_customer is null or not private.current_session_active(true) then raise exception using errcode='42501',message='customer_required';end if;
  if p_idempotency_key is null or p_case_id is null or p_expected_version is null or p_expected_version<1
    or length(trim(coalesce(p_public_message,''))) not between 2 and 3000
    or coalesce(cardinality(p_evidence_ids),0)>10 then raise exception using errcode='22023',message='invalid_customer_reply';end if;
  if not exists(select 1 from public.complaints where id=p_case_id and customer_id=v_customer) then raise exception using errcode='P0002',message='case_not_found';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('customer-support-reply:'||v_actor::text||':'||p_idempotency_key::text,0));
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('operation','customer_support_reply','caseId',p_case_id,'expectedVersion',p_expected_version,'publicMessage',trim(p_public_message),'evidenceIds',coalesce(p_evidence_ids,'{}'::uuid[]))::text,'UTF8'),'sha256'),'hex');
  select * into v_command from private.support_case_commands where actor_profile_id=v_actor and idempotency_key=p_idempotency_key;
  if found then
    if v_command.fingerprint is distinct from v_hash then raise exception using errcode='PT409',message='idempotency_key_reused';end if;
    return v_command.result;
  end if;
  v_result:=public.update_support_case(p_case_id,'customer_replied',p_expected_version,trim(p_public_message),null,null,coalesce(p_evidence_ids,'{}'::uuid[]),null,false);
  v_result:=jsonb_build_object('id',v_result->'id','status',v_result->'status','version',v_result->'version');
  insert into private.support_case_commands(actor_profile_id,idempotency_key,fingerprint,result) values(v_actor,p_idempotency_key,v_hash,v_result);
  return v_result;
end;
$reply$;
create function public.reply_customer_support_case(p_case_id uuid,p_expected_version integer,p_public_message text,p_evidence_ids uuid[],p_idempotency_key uuid)
returns jsonb language sql security invoker set search_path='' as $reply$
  select private.reply_customer_support_case(p_case_id,p_expected_version,p_public_message,p_evidence_ids,p_idempotency_key);
$reply$;
revoke all on function private.reply_customer_support_case(uuid,integer,text,uuid[],uuid),public.reply_customer_support_case(uuid,integer,text,uuid[],uuid) from public,anon,authenticated,service_role;
grant execute on function private.reply_customer_support_case(uuid,integer,text,uuid[],uuid),public.reply_customer_support_case(uuid,integer,text,uuid[],uuid) to authenticated;
