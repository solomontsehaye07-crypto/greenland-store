-- Home page section "reviews" (Google reviews).
alter table public.home_sections drop constraint if exists home_sections_type_check;
alter table public.home_sections add constraint home_sections_type_check
  check (type in ('hero','marquee','tiles','products','offers','scene','banners','usp','story','faq','newsletter','text','countries','recipes','reviews'));

insert into public.home_sections (position, type, enabled, data)
select 105, 'reviews', true, '{"title":{"de":"Das sagen unsere Kund:innen","en":"What our customers say"},"color":"sand"}'::jsonb
where not exists (select 1 from public.home_sections where type = 'reviews');
