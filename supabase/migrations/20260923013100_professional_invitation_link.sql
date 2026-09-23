-- Return the delivery token only from the initial authorized mutation. The
-- invitation projection and later list reads continue to omit it.
create function private.create_professional_invitation_link(
  p_email text,p_specialty_slug text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_invitation jsonb;v_token text;
begin
  v_invitation=private.create_professional_invitation(p_email,p_specialty_slug,p_reason);
  select e.payload->>'invitation_token' into v_token
    from private.outbox_events e
    where e.aggregate_id=(v_invitation->>'id')::uuid
      and e.event_type='professional.invited' and e.channel='email';
  if v_token is null then raise exception using errcode='P0001',message='Invitation delivery token unavailable'; end if;
  return v_invitation||jsonb_build_object('token',v_token);
end;
$$;
revoke all on function private.create_professional_invitation_link(text,text,text) from public,anon,authenticated,service_role;
grant execute on function private.create_professional_invitation_link(text,text,text) to authenticated;

create or replace function public.create_professional_invitation(
  p_email text,p_specialty_slug text,p_reason text
) returns jsonb language sql security invoker set search_path='' as $$
  select private.create_professional_invitation_link(p_email,p_specialty_slug,p_reason);
$$;
revoke all on function public.create_professional_invitation(text,text,text) from public,anon,service_role;
grant execute on function public.create_professional_invitation(text,text,text) to authenticated;
