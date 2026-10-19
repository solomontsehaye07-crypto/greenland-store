-- Eritrea / shared countries, pricing rules, write-offs with cost, store sales and expenses for profit & loss.

-- ---------- products shown under more than one country ----------
alter table public.products add column if not exists also_countries text[] not null default '{}';
grant select (also_countries) on public.products to anon, authenticated;
create index if not exists products_also_countries_idx on public.products using gin (also_countries);

-- Habesha products are shared by Eritrea and Ethiopia
update public.products set also_countries = array['Eritrea'] where country = 'Ethiopia';
update public.products set also_countries = array['Ethiopia'] where country = 'Eritrea';
update public.products set country = 'Ethiopia', also_countries = array['Eritrea']
  where country is null and (title ilike '%teff%' or title ilike '%injera%' or title ilike '%mitad%' or title ilike '%jebena%' or title ilike '%berbere%' or title ilike '%shiro%');

-- ---------- stock movements carry their cost ----------
alter table public.stock_movements add column if not exists unit_cost numeric(10, 4);
alter table public.stock_movements drop constraint if exists stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check
  check (reason in ('purchase', 'sale', 'return', 'adjustment', 'damage', 'expired', 'spoiled', 'import', 'initial'));

-- Before a movement is stored: purchases update the product's average cost; other movements are valued at the current cost.
create or replace function public.cost_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  select stock, cost_price into p from public.products where id = new.product_id;
  if new.reason = 'purchase' and new.unit_cost is not null and new.qty_change > 0 then
    update public.products
       set cost_price = case
         when p.cost_price is null or coalesce(p.stock, 0) <= 0 then new.unit_cost
         else round(((p.stock * p.cost_price) + (new.qty_change * new.unit_cost)) / (p.stock + new.qty_change), 4)
       end
     where id = new.product_id;
  elsif new.unit_cost is null then
    new.unit_cost := p.cost_price;
  end if;
  return new;
end;
$$;
create or replace trigger stock_movements_cost before insert on public.stock_movements
  for each row execute function public.cost_stock_movement();

-- ---------- in-store till totals (Z-Bon) ----------
create table if not exists public.store_sales (
  id bigint generated always as identity primary key,
  day date not null,
  gross_7 numeric(12, 2) not null default 0,
  gross_19 numeric(12, 2) not null default 0,
  note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists store_sales_day_idx on public.store_sales (day);

-- ---------- running costs ----------
create table if not exists public.expenses (
  id bigint generated always as identity primary key,
  day date not null,
  category text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists expenses_day_idx on public.expenses (day);

-- ---------- price history (every applied price change) ----------
create table if not exists public.price_changes (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  old_price numeric(10, 2),
  new_price numeric(10, 2) not null,
  cost_price numeric(10, 4),
  source text not null default 'pricing tool',
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists price_changes_product_idx on public.price_changes (product_id, created_at desc);

alter table public.store_sales enable row level security;
alter table public.expenses enable row level security;
alter table public.price_changes enable row level security;
create policy "staff store_sales" on public.store_sales for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff expenses" on public.expenses for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff price_changes" on public.price_changes for all using ((select public.is_staff())) with check ((select public.is_staff()));

-- default pricing rules (percentages); departments come from categories.department
insert into public.settings (key, value) values ('admin.pricing', '{
  "autoApply": false,
  "useMeasuredLoss": false,
  "rounding": "psych",
  "default": {"margin": 30, "waste": 2},
  "departments": {
    "food": {"margin": 30, "waste": 2},
    "beauty": {"margin": 40, "waste": 1},
    "home": {"margin": 45, "waste": 0}
  },
  "categories": {
    "2": {"margin": 35, "waste": 12},
    "3": {"margin": 30, "waste": 3}
  }
}'::jsonb) on conflict (key) do nothing;
