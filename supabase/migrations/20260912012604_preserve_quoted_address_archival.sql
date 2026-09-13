-- Version and archival are bookkeeping. Accepted location/access fields remain immutable.
create or replace function private.protect_quoted_address() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.service_requests r join public.service_quotes q on q.request_id=r.id where r.address_id=old.id and q.status='accepted')
    and (to_jsonb(new) - 'updated_at' - 'is_default' - 'version' - 'archived_at' - 'label')
      is distinct from (to_jsonb(old) - 'updated_at' - 'is_default' - 'version' - 'archived_at' - 'label') then
    raise exception 'Accepted quote address is immutable: request a new quote';
  end if;
  return new;
end;
$$;
