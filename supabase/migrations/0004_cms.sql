-- Website content system: everything on the storefront that isn't a product is editable from the admin.
-- Texts are stored as {"de": "...", "en": "..."} so the shop can switch language.

-- Home page is a list of sections; each section has a type and its own content (data).
create table public.home_sections (
  id bigint generated always as identity primary key,
  position int not null default 0,
  type text not null check (type in ('hero','marquee','tiles','products','banners','usp','story','faq','newsletter','text')),
  enabled boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index home_sections_position on public.home_sections (position);
create trigger home_sections_touch before update on public.home_sections for each row execute function public.touch_updated_at();

-- Free pages: About us, legal pages, delivery info, etc.
create table public.pages (
  slug text primary key check (slug ~ '^[a-z0-9-]+$'),
  title jsonb not null default '{}'::jsonb,
  body jsonb not null default '{}'::jsonb,       -- markdown per language
  published boolean not null default true,
  show_in_footer boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
create trigger pages_touch before update on public.pages for each row execute function public.touch_updated_at();

-- Newsletter / club sign-ups from the storefront
create table public.subscribers (
  id bigint generated always as identity primary key,
  email text not null unique,
  lang text not null default 'de',
  source text,
  created_at timestamptz not null default now()
);

-- Product content in two languages (title_de already exists)
alter table public.products add column if not exists description_de text;
alter table public.products add column if not exists images_extra jsonb;
alter table public.categories add column if not exists description_de text;

alter table public.home_sections enable row level security;
alter table public.pages enable row level security;
alter table public.subscribers enable row level security;

create policy "sections readable" on public.home_sections for select using (enabled or (select public.is_staff()));
create policy "staff sections" on public.home_sections for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "pages readable" on public.pages for select using (published or (select public.is_staff()));
create policy "staff pages" on public.pages for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff subscribers" on public.subscribers for all using ((select public.is_staff())) with check ((select public.is_staff()));

-- Public bucket for website images (hero photos, banners, logos). Uploads go through the admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 8388608, array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','image/avif'])
on conflict (id) do nothing;
create policy "staff site media write" on storage.objects for insert with check (bucket_id = 'site-media' and (select public.is_staff()));
create policy "staff site media update" on storage.objects for update using (bucket_id = 'site-media' and (select public.is_staff()));
create policy "staff site media delete" on storage.objects for delete using (bucket_id = 'site-media' and (select public.is_staff()));
