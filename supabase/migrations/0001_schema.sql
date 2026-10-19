-- Greenland Afro Asia Store — core schema
-- Catalogue, inventory (batches + movement ledger), suppliers, purchase orders,
-- orders, shipping, imports, alerts.

create extension if not exists pg_trgm;

-- ---------- helpers ----------
create type public.user_role as enum ('customer', 'staff', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('staff', 'admin')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- catalogue ----------
create table public.categories (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  title_de text,
  description text,
  parent_id bigint references public.categories (id) on delete set null,
  department text not null check (department in ('food', 'beauty', 'home')),
  sort int not null default 0,
  image_url text,
  selldone_id bigint unique,
  created_at timestamptz not null default now()
);
create index on public.categories (parent_id);

create table public.suppliers (
  id bigint generated always as identity primary key,
  name text not null,
  contact_name text,
  email text,
  phone text,
  whatsapp text,               -- international format, e.g. 4915212345678
  preferred_channel text not null default 'email' check (preferred_channel in ('email', 'whatsapp', 'both')),
  lead_time_days int not null default 3,
  min_order_value numeric(10, 2) not null default 0,
  address text,
  is_dropshipper boolean not null default false,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id bigint generated always as identity primary key,
  sku text not null unique,
  slug text not null unique,
  title text not null,
  title_de text,
  brand text,
  description text,
  category_id bigint references public.categories (id) on delete set null,
  price numeric(10, 2) not null check (price >= 0),
  compare_at_price numeric(10, 2),
  cost_price numeric(10, 2),
  tax_rate numeric(4, 2) not null default 7 check (tax_rate in (0, 7, 19)),
  weight_g int not null default 500,
  size_qty numeric,
  size_unit text check (size_unit in ('g', 'ml')),
  image_url text,
  images jsonb not null default '[]'::jsonb,
  country text,
  is_frozen boolean not null default false,
  age_restricted boolean not null default false,
  is_dropship boolean not null default false,
  supplier_id bigint references public.suppliers (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'hidden', 'draft')),
  featured boolean not null default false,
  stock int not null default 0,          -- cached, maintained by trigger on stock_movements
  reorder_point int not null default 3,  -- alert when stock <= reorder_point
  reorder_qty int not null default 12,   -- default refill quantity
  price_source text,
  selldone_id bigint unique,
  search tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(sku, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products (category_id);
create index on public.products (supplier_id);
create index on public.products using gin (search);
create index on public.products using gin (title gin_trgm_ops);
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- price per kg / litre (German PAngV Grundpreis)
create or replace view public.product_unit_prices
with (security_invoker = true) as
select id,
  case when size_qty > 0 then round(price / size_qty * 1000, 2) end as unit_price,
  case size_unit when 'g' then 'kg' when 'ml' then 'l' end as unit_label
from public.products;

create table public.supplier_products (
  supplier_id bigint not null references public.suppliers (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  supplier_sku text,
  cost_price numeric(10, 2),
  pack_size int not null default 1,
  is_preferred boolean not null default true,
  primary key (supplier_id, product_id)
);
create index on public.supplier_products (product_id);

-- ---------- inventory ----------
create table public.stock_batches (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  lot_code text,
  best_before date,
  quantity_received int not null check (quantity_received > 0),
  quantity_left int not null,
  cost_price numeric(10, 2),
  purchase_order_id bigint,
  received_at timestamptz not null default now()
);
create index on public.stock_batches (product_id, best_before);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  batch_id bigint references public.stock_batches (id) on delete set null,
  qty_change int not null check (qty_change <> 0),
  reason text not null check (reason in ('purchase', 'sale', 'return', 'adjustment', 'damage', 'expired', 'import', 'initial')),
  reference text,
  note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index on public.stock_movements (product_id, created_at desc);

create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products set stock = stock + new.qty_change where id = new.product_id;
  return new;
end;
$$;
create trigger stock_movements_apply after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ---------- shipping ----------
create table public.shipping_methods (
  id bigint generated always as identity primary key,
  code text not null unique,
  name text not null,
  description text,
  type text not null check (type in ('parcel', 'frozen', 'local', 'pickup', 'dropship')),
  price numeric(10, 2) not null default 0,
  free_from numeric(10, 2),
  min_order numeric(10, 2) not null default 0,
  max_weight_g int,
  countries text[] not null default array['DE'],
  postal_prefixes text[],      -- for local delivery
  active boolean not null default true,
  sort int not null default 0
);

-- ---------- orders ----------
create sequence public.order_number_seq start 10001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.order_number_seq'),
  customer_id uuid references auth.users (id) on delete set null,
  email text not null,
  phone text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'processing', 'packed', 'shipped', 'ready_for_pickup', 'delivered', 'cancelled', 'refunded')),
  shipping_method_id bigint references public.shipping_methods (id),
  fulfillment_type text not null check (fulfillment_type in ('parcel', 'frozen', 'local', 'pickup', 'dropship')),
  shipping_address jsonb,
  pickup_slot text,
  subtotal numeric(10, 2) not null,
  shipping_total numeric(10, 2) not null default 0,
  tax_total numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  currency text not null default 'EUR',
  payment_provider text check (payment_provider in ('stripe', 'paypal', 'viva', 'cash', 'cod')),
  payment_ref text,
  paid_at timestamptz,
  tracking_number text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (customer_id);
create index on public.orders (status, created_at desc);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id bigint references public.products (id) on delete set null,
  sku text not null,
  title text not null,
  qty int not null check (qty > 0),
  unit_price numeric(10, 2) not null,
  tax_rate numeric(4, 2) not null,
  is_dropship boolean not null default false
);
create index on public.order_items (order_id);

-- Marks an order paid exactly once and books the stock out (FEFO batches).
create or replace function public.mark_order_paid(p_order_id uuid, p_provider text, p_ref text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  it record;
  b record;
  remaining int;
  take int;
begin
  update public.orders
     set status = 'paid', paid_at = now(), payment_provider = p_provider, payment_ref = p_ref
   where id = p_order_id and status = 'pending';
  if not found then
    return false; -- already processed (idempotent webhook)
  end if;

  for it in select * from public.order_items where order_id = p_order_id and product_id is not null and not is_dropship loop
    remaining := it.qty;
    for b in select * from public.stock_batches
              where product_id = it.product_id and quantity_left > 0
              order by best_before nulls last, received_at
              for update loop
      exit when remaining = 0;
      take := least(remaining, b.quantity_left);
      update public.stock_batches set quantity_left = quantity_left - take where id = b.id;
      insert into public.stock_movements (product_id, batch_id, qty_change, reason, reference)
      values (it.product_id, b.id, -take, 'sale', 'order:' || p_order_id);
      remaining := remaining - take;
    end loop;
    if remaining > 0 then
      insert into public.stock_movements (product_id, qty_change, reason, reference)
      values (it.product_id, -remaining, 'sale', 'order:' || p_order_id);
    end if;
  end loop;
  return true;
end;
$$;

-- ---------- purchasing ----------
create sequence public.po_number_seq start 5001;

create table public.purchase_orders (
  id bigint generated always as identity primary key,
  number bigint not null unique default nextval('public.po_number_seq'),
  supplier_id bigint not null references public.suppliers (id),
  status text not null default 'draft' check (status in ('draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled')),
  kind text not null default 'refill' check (kind in ('refill', 'dropship')),
  order_id uuid references public.orders (id),  -- set for dropship POs
  sent_via text,
  sent_at timestamptz,
  expected_at date,
  pdf_path text,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index on public.purchase_orders (supplier_id, status);

create table public.purchase_order_items (
  id bigint generated always as identity primary key,
  purchase_order_id bigint not null references public.purchase_orders (id) on delete cascade,
  product_id bigint not null references public.products (id),
  qty int not null check (qty > 0),
  unit_cost numeric(10, 2),
  qty_received int not null default 0
);
create index on public.purchase_order_items (purchase_order_id);

alter table public.stock_batches
  add constraint stock_batches_po_fk foreign key (purchase_order_id) references public.purchase_orders (id) on delete set null;

-- Products at or below reorder point, with preferred supplier
create or replace view public.low_stock
with (security_invoker = true) as
select p.id, p.sku, p.title, p.stock, p.reorder_point, p.reorder_qty, p.image_url,
       coalesce(sp.supplier_id, p.supplier_id) as supplier_id,
       s.name as supplier_name, sp.cost_price,
       exists (
         select 1 from public.purchase_order_items poi
         join public.purchase_orders po on po.id = poi.purchase_order_id
         where poi.product_id = p.id and po.status in ('draft', 'sent', 'confirmed')
       ) as on_order
from public.products p
left join public.supplier_products sp on sp.product_id = p.id and sp.is_preferred
left join public.suppliers s on s.id = coalesce(sp.supplier_id, p.supplier_id)
where p.status = 'active' and not p.is_dropship and p.stock <= p.reorder_point;

-- Batches expiring within 30 days
create or replace view public.expiring_batches
with (security_invoker = true) as
select b.*, p.sku, p.title
from public.stock_batches b join public.products p on p.id = b.product_id
where b.quantity_left > 0 and b.best_before is not null and b.best_before <= current_date + 30;

-- ---------- misc ----------
create table public.import_jobs (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('products', 'stock', 'prices', 'supplier_prices')),
  filename text,
  total_rows int,
  ok_rows int,
  failed_rows int,
  errors jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.alerts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('low_stock', 'expiring', 'order', 'system')),
  product_id bigint references public.products (id) on delete cascade,
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.settings (
  key text primary key,
  value jsonb not null
);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.supplier_products enable row level security;
alter table public.stock_batches enable row level security;
alter table public.stock_movements enable row level security;
alter table public.shipping_methods enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.import_jobs enable row level security;
alter table public.alerts enable row level security;
alter table public.settings enable row level security;

-- public storefront reads
create policy "categories readable" on public.categories for select using (true);
create policy "active products readable" on public.products for select using (status = 'active' or (select public.is_staff()));
create policy "shipping readable" on public.shipping_methods for select using (active or (select public.is_staff()));
create policy "public settings readable" on public.settings for select using (key like 'public.%' or (select public.is_staff()));

-- profiles
create policy "own profile" on public.profiles for select using (id = (select auth.uid()) or (select public.is_staff()));
create policy "update own profile" on public.profiles for update using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = 'customer');

-- customers see their own orders (orders are created server-side with the service role)
create policy "own orders" on public.orders for select using (customer_id = (select auth.uid()) or (select public.is_staff()));
create policy "own order items" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = (select auth.uid()) or (select public.is_staff())))
);

-- staff manage everything
create policy "staff categories" on public.categories for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff products" on public.products for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff suppliers" on public.suppliers for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff supplier_products" on public.supplier_products for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff batches" on public.stock_batches for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff movements" on public.stock_movements for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff shipping" on public.shipping_methods for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff orders" on public.orders for update using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff pos" on public.purchase_orders for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff po items" on public.purchase_order_items for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff imports" on public.import_jobs for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff alerts" on public.alerts for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff settings" on public.settings for all using ((select public.is_staff())) with check ((select public.is_staff()));

revoke execute on function public.mark_order_paid(uuid, text, text) from public, anon, authenticated;

-- storage bucket for refill-order PDFs (private) and product images (public)
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict do nothing;
create policy "staff documents" on storage.objects for all
  using (bucket_id = 'documents' and (select public.is_staff()))
  with check (bucket_id = 'documents' and (select public.is_staff()));
create policy "staff product images write" on storage.objects for insert
  with check (bucket_id = 'product-images' and (select public.is_staff()));
