-- Offers with end dates, more section types, and order fields for deposits, receipts and carriers.
-- Applied piecewise through the SQL editor; this file records the result.

alter table public.products add column if not exists sale_ends_at timestamptz;
grant select (sale_ends_at) on public.products to anon, authenticated;

alter table public.orders add column if not exists payment_method text,
  add column if not exists deposit_amount numeric(10,2),
  add column if not exists balance_due numeric(10,2) not null default 0,
  add column if not exists receipt_number bigint,
  add column if not exists pickup_at timestamptz,
  add column if not exists carrier text;
create sequence if not exists public.receipt_number_seq start 1001;

alter table public.shipping_methods add column if not exists name_de text,
  add column if not exists description_de text,
  add column if not exists carrier text,
  add column if not exists tracking_url text,
  add column if not exists eta text;

alter table public.home_sections drop constraint home_sections_type_check;
alter table public.home_sections add constraint home_sections_type_check check (type in ('hero','marquee','tiles','products','offers','scene','banners','usp','story','faq','newsletter','text','countries','recipes'));

create or replace function public.end_expired_offers() returns int language plpgsql security definer set search_path = public as $fn$
declare n int;
begin
  update public.products set price = compare_at_price, compare_at_price = null, sale_ends_at = null, price_source = 'offer ended'
   where sale_ends_at is not null and sale_ends_at < now() and compare_at_price is not null;
  get diagnostics n = row_count;
  update public.products set sale_ends_at = null where sale_ends_at is not null and sale_ends_at < now();
  return n;
end $fn$;
revoke execute on function public.end_expired_offers() from public, anon, authenticated;

create or replace function public.next_receipt_number() returns bigint language sql security definer set search_path = public as $fn$ select nextval('public.receipt_number_seq') $fn$;
revoke execute on function public.next_receipt_number() from public, anon, authenticated;
