-- Optional photo for content pages (e.g. the owner's portrait on "Über uns").
alter table public.pages add column if not exists image text;
