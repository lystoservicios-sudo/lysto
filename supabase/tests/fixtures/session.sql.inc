-- SQL-only gateway fixtures, rolled back with this test. They model an issued
-- session; actual password/TOTP issuance and revocation are tested over HTTP.
create function pg_temp.fixture_session() returns trigger language plpgsql as $$
begin
  if new.raw_app_meta_data->>'app_role'='admin' then
    insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at)
    values(new.id,new.id,'totp','verified','sql-fixture-not-an-auth-secret',now(),now());
  end if;
  insert into auth.sessions(id,user_id,aal,factor_id,created_at,updated_at)
  values(new.id,new.id,case when new.raw_app_meta_data->>'app_role'='admin' then 'aal2'::auth.aal_level else 'aal1'::auth.aal_level end,
    case when new.raw_app_meta_data->>'app_role'='admin' then new.id else null end,now(),now());
  return new;
end;
$$;
create trigger fixture_session after insert on auth.users for each row execute function pg_temp.fixture_session();
create function pg_temp.fixture_set_config(p_name text,p_value text,p_local boolean) returns text language plpgsql as $$
declare claims jsonb;
begin
  if p_name='request.jwt.claims' then
    claims=p_value::jsonb;
    if claims ? 'sub' then
      claims=jsonb_build_object('session_id',claims->>'sub','aal',case when claims->'app_metadata'->>'app_role'='admin' then 'aal2' else 'aal1' end) || claims;
    end if;
    return pg_catalog.set_config(p_name,claims::text,p_local);
  end if;
  return pg_catalog.set_config(p_name,p_value,p_local);
end;
$$;
