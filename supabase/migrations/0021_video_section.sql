-- Home page section "video" (store video: uploaded MP4 or YouTube/Instagram link) and its storage bucket.
alter table public.home_sections drop constraint if exists home_sections_type_check;
alter table public.home_sections add constraint home_sections_type_check
  check (type in ('hero','marquee','tiles','products','offers','scene','banners','usp','story','faq','newsletter','text','countries','recipes','reviews','video'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-video', 'site-video', true, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

insert into public.home_sections (position, type, enabled, data)
select 102, 'video', true, '{"title":{"de":"Ein Blick in unseren Laden","en":"A look inside our shop"},"text":{"de":"Komm vorbei in der Richard-Wagner-Straße 58A in Kaiserslautern – oder bestell bequem online.","en":"Visit us at Richard-Wagner-Straße 58A in Kaiserslautern – or order online."},"video":"","color":"none"}'::jsonb
where not exists (select 1 from public.home_sections where type = 'video');
