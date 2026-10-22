-- Local delivery by distance: a radius around the shop instead of postcode lists.
alter table public.shipping_methods add column if not exists max_distance_km numeric;

-- Addresses already looked up (OpenStreetMap / Nominatim), so each address is asked only once.
create table if not exists public.geocode_cache (
  key text primary key,
  lat double precision,
  lng double precision,
  found boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.geocode_cache enable row level security;
-- server only (service role); nobody else reads or writes it
grant select, insert, update, delete on public.geocode_cache to service_role;

-- Greenland's decision (22 Oct 2026): frozen food only by pickup or local delivery within 5 km;
-- local delivery free from 69 EUR; no nationwide frozen express for now.
update public.shipping_methods set max_distance_km = 5, free_from = 69, postal_prefixes = '{}' where type = 'local';
update public.shipping_methods set active = false where type = 'frozen';
