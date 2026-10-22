-- Product page: benefit bullets, pack-size groups, ingredients, quantity discounts and reviews.

alter table public.products
  add column if not exists bullets_de text[] not null default '{}',
  add column if not exists bullets_en text[] not null default '{}',
  -- products with the same size_group are offered as pack sizes of each other ("500 g", "1 kg", "5 kg")
  add column if not exists size_group text,
  add column if not exists ingredients text,
  -- false = this product never gets the quantity discount (e.g. very low margin)
  add column if not exists qty_discount boolean not null default true;

create index if not exists products_size_group_idx on public.products (size_group) where size_group is not null;

grant select (bullets_de, bullets_en, size_group, ingredients, qty_discount) on public.products to anon, authenticated;

-- Reviews: written by signed-in customers; "verified" when they bought the product.
create table if not exists public.product_reviews (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  rating smallint not null check (rating between 1 and 5),
  body text,
  verified boolean not null default false,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists product_reviews_product_idx on public.product_reviews (product_id, created_at desc) where status = 'published';

alter table public.product_reviews enable row level security;
-- everyone may read published reviews; writing goes through the server (service role) only
create policy "published reviews readable" on public.product_reviews for select using (status = 'published' or (select public.is_staff()));
create policy "staff reviews" on public.product_reviews for all using ((select public.is_staff())) with check ((select public.is_staff()));
grant select on public.product_reviews to anon, authenticated;
grant select, insert, update, delete on public.product_reviews to service_role;
