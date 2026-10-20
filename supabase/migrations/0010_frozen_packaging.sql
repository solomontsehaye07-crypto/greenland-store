-- Frozen packaging: insulated boxes per started 5 kg (settings → public.frozen_pack)
alter table public.orders add column if not exists frozen_boxes int not null default 0;
alter table public.orders add column if not exists packaging_total numeric(10,2) not null default 0;
insert into public.settings (key, value) values ('public.frozen_pack', '{"enabled":true,"boxKg":5,"boxPrice":7.9,"smallKg":1,"perBoxShipping":true,"applyLocal":false,"smallNote":{"de":"","en":""}}'::jsonb)
on conflict (key) do nothing;
