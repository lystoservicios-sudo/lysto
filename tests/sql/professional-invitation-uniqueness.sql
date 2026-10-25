-- Run inside a transaction and ROLLBACK. No invitations are sent by these inserts.
do $$
declare v_email text; v_account_email text; v_id uuid; v_other_id uuid; v_actor uuid; v_specialty text; v_message text;
begin
  select id into v_actor from public.profiles order by created_at limit 1;
  select slug into v_specialty from public.service_categories where active order by slug limit 1;
  select email into v_email from auth.users where email is not null order by created_at limit 1;
  v_account_email=v_email;
  if v_actor is null or v_specialty is null or v_email is null then raise exception 'Invitation test fixtures unavailable'; end if;

  begin
    insert into public.professional_invitations(email,specialty_slug,token_hash,status,created_by)
      values('  '||upper(v_email)||'  ',v_specialty,encode(extensions.gen_random_bytes(32),'hex'),'queued',v_actor);
    raise exception 'An existing account email must be rejected before an invitation is stored';
  exception when unique_violation then
    get stacked diagnostics v_message=message_text;
    if v_message<>'professional_invitation_account_exists' then raise exception 'Wrong account conflict: %',v_message; end if;
  end;

  v_email='invitation-uniqueness-'||gen_random_uuid()::text||'@example.invalid';
  insert into public.professional_invitations(email,specialty_slug,token_hash,status,created_by)
    values(v_email,v_specialty,encode(extensions.gen_random_bytes(32),'hex'),'cancelled',v_actor) returning id into v_id;
  begin
    insert into public.professional_invitations(email,specialty_slug,token_hash,status,created_by)
      values(' '||upper(v_email)||' ',v_specialty,encode(extensions.gen_random_bytes(32),'hex'),'queued',v_actor);
    raise exception 'Cancelled invitations must still prevent a duplicate email';
  exception when unique_violation then null;
  end;
  if (select count(*) from public.professional_invitations where lower(btrim(email::text))=v_email)<>1 then
    raise exception 'Duplicate attempt changed invitation count';
  end if;
  -- Existing rows remain editable for the normal resend/status lifecycle.
  update public.professional_invitations set status='queued' where id=v_id;
  update public.professional_invitations set status='sent' where id=v_id;
  if (select status from public.professional_invitations where id=v_id)<>'sent' then raise exception 'Existing invitation cannot be reused'; end if;
  insert into public.professional_invitations(email,specialty_slug,token_hash,status,created_by)
    values('other-'||v_email,v_specialty,encode(extensions.gen_random_bytes(32),'hex'),'queued',v_actor) returning id into v_other_id;
  begin
    update public.professional_invitations set email=upper(v_email) where id=v_other_id;
    raise exception 'Changing a recipient must not bypass invitation uniqueness';
  exception when unique_violation then null;
  end;
  begin
    update public.professional_invitations set email=upper(v_account_email) where id=v_other_id;
    raise exception 'Changing a recipient must not collide with an existing account';
  exception when unique_violation then null;
  end;
  if not exists(select 1 from pg_index where indexrelid='public.professional_invitation_email_unique'::regclass and indisunique and indisvalid) then
    raise exception 'Concurrent duplicate protection is missing';
  end if;
  if has_function_privilege('authenticated','private.guard_professional_invitation_email()','EXECUTE')
    or has_function_privilege('anon','private.guard_professional_invitation_email()','EXECUTE') then
    raise exception 'Invitation email guard must remain private';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.professional_invitations'::regclass) then
    raise exception 'Invitation RLS must remain enabled';
  end if;
end $$;
select 'professional_invitation_uniqueness_verified' as result;
