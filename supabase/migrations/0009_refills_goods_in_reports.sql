-- Refill requests with live PDF and archive, barcode on products, stolen / own-use stock reasons.
alter table public.purchase_orders add column if not exists message text,
  add column if not exists show_prices boolean not null default true,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists edited_after_send boolean not null default false;
alter table public.purchase_order_items add column if not exists note text;
alter table public.products add column if not exists ean text;
create index if not exists products_ean on public.products (ean);

create table if not exists public.purchase_order_sends (
  id bigint generated always as identity primary key,
  purchase_order_id bigint not null references public.purchase_orders(id) on delete cascade,
  channel text not null,
  recipient text,
  pdf_path text,
  sent_at timestamptz not null default now(),
  created_by uuid
);
alter table public.purchase_order_sends enable row level security;
create policy "staff po sends" on public.purchase_order_sends for all using ((select public.is_staff())) with check ((select public.is_staff()));
create index if not exists po_sends_po on public.purchase_order_sends (purchase_order_id);

alter table public.stock_movements drop constraint stock_movements_reason_check;
alter table public.stock_movements add constraint stock_movements_reason_check check (reason in ('purchase','sale','return','adjustment','damage','expired','spoiled','theft','own_use','import','initial'));
