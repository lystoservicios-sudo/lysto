-- Only server-verified precise points enter this private store. No customer can
-- submit coordinates through an exposed RPC; address changes yield a new key.
create table private.verified_routing_points (
  address_key text primary key check (address_key ~ '^[a-f0-9]{64}$'),
  point jsonb not null check (jsonb_typeof(point)='object'),
  verified_at timestamptz not null default clock_timestamp()
);
alter table private.verified_routing_points enable row level security;
revoke all on private.verified_routing_points from public, anon, authenticated;

create function public.read_verified_routing_point(p_key text)
returns jsonb language sql stable security definer set search_path='' as $$
  select point from private.verified_routing_points
  where address_key=p_key and verified_at>now()-interval '90 days';
$$;

create function public.store_verified_routing_point(p_key text,p_point jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$' or p_point is null or jsonb_typeof(p_point)<>'object'
    or not (p_point ?& array['formattedAddress','latitude','longitude','province','precision','coordinateSource'])
    or coalesce(p_point->>'province','') not in ('CABA','Buenos Aires')
    or coalesce(p_point->>'precision','') not in ('rooftop','range_interpolated')
    or coalesce(p_point->>'coordinateSource','') not in ('georef','openrouteservice','google')
    or jsonb_typeof(p_point->'latitude') is distinct from 'number'
    or jsonb_typeof(p_point->'longitude') is distinct from 'number'
    or length(coalesce(p_point->>'formattedAddress','')) not between 1 and 500
    or (p_point->>'latitude')::numeric not between -90 and 90
    or (p_point->>'longitude')::numeric not between -180 and 180
  then raise exception using errcode='22023',message='Verified precise location required'; end if;
  insert into private.verified_routing_points(address_key,point) values(p_key,p_point)
  on conflict(address_key) do update set point=excluded.point,verified_at=clock_timestamp();
end; $$;
revoke all on function public.read_verified_routing_point(text), public.store_verified_routing_point(text,jsonb) from public, anon, authenticated;
grant execute on function public.read_verified_routing_point(text), public.store_verified_routing_point(text,jsonb) to service_role;
