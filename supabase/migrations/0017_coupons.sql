-- Discount codes. The welcome code (10 % on the first order) is created per sign-up and bound to the email.
create table if not exists public.coupons (
  code text primary key,
  percent_off numeric(5, 2) not null default 0 check (percent_off >= 0 and percent_off <= 100),
  min_subtotal numeric(10, 2) not null default 0,
  email text,                                   -- only this customer may use it (lower-case)
  first_order_only boolean not null default false,
  uses_left int not null default 1,
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
alter table public.coupons enable row level security;
create policy "manager coupons" on public.coupons for all using ((select public.is_manager())) with check ((select public.is_manager()));
grant select, insert, update, delete on public.coupons to anon, authenticated, service_role;
alter table public.orders
  add column if not exists coupon_code text,
  add column if not exists discount_total numeric(10, 2) not null default 0;
