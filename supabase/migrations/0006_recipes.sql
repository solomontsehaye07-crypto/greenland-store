-- Recipe ideas: dishes linked to the products they need. Used for "goes well together" suggestions
-- on product pages and in the cart, and for the /rezepte pages.

create table public.recipes (
  id bigint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title jsonb not null default '{}'::jsonb,
  intro jsonb not null default '{}'::jsonb,
  image_url text,
  country text,
  published boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.recipe_items (
  recipe_id bigint not null references public.recipes (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  note jsonb not null default '{}'::jsonb,
  essential boolean not null default true,
  primary key (recipe_id, product_id)
);
create index recipe_items_product on public.recipe_items (product_id);
create index products_country on public.products (country);

alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;

create policy "recipes readable" on public.recipes for select using (published or (select public.is_staff()));
create policy "staff recipes" on public.recipes for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "recipe items readable" on public.recipe_items for select
  using (exists (select 1 from public.recipes r where r.id = recipe_id and (r.published or (select public.is_staff()))));
create policy "staff recipe items" on public.recipe_items for all using ((select public.is_staff())) with check ((select public.is_staff()));

grant select on public.recipes, public.recipe_items to anon, authenticated;
grant insert, update, delete on public.recipes, public.recipe_items to authenticated;
