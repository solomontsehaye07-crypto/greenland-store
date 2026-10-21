-- Price requests: a refill list is first sent as a request for prices. The supplier enters prices on a
-- private link (or the shop types them in), the shop compares and only then places the order.
alter table public.purchase_orders
  add column if not exists request_kind text not null default 'order' check (request_kind in ('quote', 'order')),
  add column if not exists offer_token text unique,
  add column if not exists quoted_at timestamptz,
  add column if not exists offer_note text,
  add column if not exists offer_by text;
alter table public.purchase_orders drop constraint if exists purchase_orders_status_check;
alter table public.purchase_orders add constraint purchase_orders_status_check
  check (status in ('draft', 'sent', 'quoted', 'confirmed', 'partially_received', 'received', 'cancelled'));
alter table public.purchase_order_items
  add column if not exists offer_price numeric(10, 2) check (offer_price is null or offer_price >= 0),
  add column if not exists offer_available boolean,
  add column if not exists offer_note text,
  add column if not exists ordered boolean not null default true;
-- open refill lists in the Manager app become price requests
update public.purchase_orders set request_kind = 'quote' where status = 'draft' and kind = 'refill';
