-- Customer accounts in the shop: saved delivery details on the profile; guest orders placed with the
-- same email are attached to the account when the customer first signs in.
alter table public.profiles
  add column if not exists address jsonb,            -- {street, postal, city, country}
  add column if not exists email text,
  add column if not exists marketing boolean not null default false,
  add column if not exists welcome_code text;        -- the one-time welcome coupon shown after sign-up
create index if not exists orders_email_idx on public.orders (lower(email));
create index if not exists order_items_product_idx on public.order_items (product_id);

