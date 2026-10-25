-- One invitation per normalized email, across the entire lifecycle. Resends
-- update the existing row; a unique index also covers concurrent requests.
create unique index professional_invitation_email_unique
  on public.professional_invitations (lower(btrim(email::text)));

create function private.guard_professional_invitation_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(btrim(new.email::text));
begin
  new.email=v_email;
  -- Binding and resending an existing invitation must remain possible after
  -- its Auth identity is provisioned. Only a new recipient needs this check.
  if tg_op='UPDATE' and v_email=lower(btrim(old.email::text)) then return new; end if;
  if exists(select 1 from public.professional_invitations i
      where lower(btrim(i.email::text))=v_email and i.id<>new.id) then
    raise exception using errcode='23505',message='professional_invitation_email_exists';
  end if;
  if exists(select 1 from auth.users u where lower(btrim(u.email))=v_email)
    or exists(select 1 from public.profiles p where lower(btrim(p.email::text))=v_email) then
    raise exception using errcode='23505',message='professional_invitation_account_exists';
  end if;
  return new;
end; $$;
revoke all on function private.guard_professional_invitation_email() from public,anon,authenticated,service_role;

create trigger professional_invitation_email_guard
  before insert or update of email on public.professional_invitations
  for each row execute function private.guard_professional_invitation_email();
