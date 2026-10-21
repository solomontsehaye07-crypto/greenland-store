-- Invoices for business customers (shops, restaurants …) who pay later by bank transfer.
-- Own number series, separate from the online-shop receipts. Issuing an invoice takes the next number,
-- sets the due date and takes the products out of stock in one step (all or nothing).

create table if not exists public.business_customers (
  id bigint generated always as identity primary key,
  name text not null,
  contact_name text,
  street text,
  postal text,
  city text,
  country text not null default 'DE',
  vat_id text,
  email text,
  whatsapp text,
  phone text,
  discount_pct numeric(5, 2) not null default 0 check (discount_pct >= 0 and discount_pct < 100),
  payment_days int not null default 14 check (payment_days between 0 and 365),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row: how the next invoice number looks. "prefix" + number padded to "pad" digits.
create table if not exists public.invoice_series (
  id int primary key default 1 check (id = 1),
  prefix text not null default 'RE-',
  next_number bigint not null default 1 check (next_number > 0),
  pad int not null default 4 check (pad between 1 and 10),
  payment_days int not null default 14,
  footer text
);
insert into public.invoice_series (id) values (1) on conflict do nothing;

create table if not exists public.invoices (
  id bigint generated always as identity primary key,
  number text unique,                         -- given when the invoice is issued
  status text not null default 'draft' check (status in ('draft', 'open', 'paid', 'cancelled')),
  customer_id bigint references public.business_customers(id),
  customer jsonb not null default '{}',       -- copy of name/address at issue time
  issue_date date,
  delivery_date date,
  due_date date,
  payment_days int not null default 14,
  discount_pct numeric(5, 2) not null default 0,
  notes text,
  subtotal_net numeric(12, 2) not null default 0,
  vat_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  paid_at date,
  paid_amount numeric(12, 2),
  reminders int not null default 0,
  last_reminder_at timestamptz,
  stock_booked boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_status on public.invoices (status, due_date);
create index if not exists invoices_customer on public.invoices (customer_id);

create table if not exists public.invoice_items (
  id bigint generated always as identity primary key,
  invoice_id bigint not null references public.invoices(id) on delete cascade,
  product_id bigint references public.products(id),
  title text not null,
  sku text,
  size text,
  qty numeric(10, 2) not null check (qty > 0),
  unit_net numeric(10, 4) not null default 0 check (unit_net >= 0),   -- price per unit without VAT
  tax_rate numeric(5, 2) not null default 7,
  position int not null default 0
);
create index if not exists invoice_items_invoice on public.invoice_items (invoice_id);

alter table public.business_customers enable row level security;
alter table public.invoice_series enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
create policy "staff business customers" on public.business_customers for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff invoice series" on public.invoice_series for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff invoices" on public.invoices for all using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff invoice items" on public.invoice_items for all using ((select public.is_staff())) with check ((select public.is_staff()));

grant select, insert, update, delete on public.business_customers to anon, authenticated, service_role;
grant select, insert, update, delete on public.invoice_series to anon, authenticated, service_role;
grant select, insert, update, delete on public.invoices to anon, authenticated, service_role;
grant select, insert, update, delete on public.invoice_items to anon, authenticated, service_role;

-- Issue a draft: next number, dates, totals, stock out. Returns the number.
create or replace function public.issue_invoice(p_id bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv record;
  s record;
  it record;
  b record;
  remaining int;
  take int;
  no text;
begin
  select * into inv from public.invoices where id = p_id for update;
  if inv is null then raise exception 'Invoice not found'; end if;
  if inv.status <> 'draft' then return inv.number; end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_id) then raise exception 'The invoice has no lines'; end if;

  select * into s from public.invoice_series where id = 1 for update;
  no := s.prefix || lpad(s.next_number::text, s.pad, '0');
  while exists (select 1 from public.invoices where number = no) loop
    s.next_number := s.next_number + 1;
    no := s.prefix || lpad(s.next_number::text, s.pad, '0');
  end loop;
  update public.invoice_series set next_number = s.next_number + 1 where id = 1;

  update public.invoices
     set number = no,
         status = 'open',
         issue_date = coalesce(issue_date, current_date),
         delivery_date = coalesce(delivery_date, coalesce(issue_date, current_date)),
         due_date = coalesce(issue_date, current_date) + payment_days,
         stock_booked = true,
         updated_at = now()
   where id = p_id;

  -- products out of stock, oldest best-before first (same as shop sales)
  for it in select * from public.invoice_items where invoice_id = p_id and product_id is not null loop
    remaining := ceil(it.qty)::int;
    for b in select * from public.stock_batches
              where product_id = it.product_id and quantity_left > 0
              order by best_before nulls last, received_at
              for update loop
      exit when remaining = 0;
      take := least(remaining, b.quantity_left);
      update public.stock_batches set quantity_left = quantity_left - take where id = b.id;
      insert into public.stock_movements (product_id, batch_id, qty_change, reason, reference)
      values (it.product_id, b.id, -take, 'sale', 'invoice:' || p_id);
      remaining := remaining - take;
    end loop;
    if remaining > 0 then
      insert into public.stock_movements (product_id, qty_change, reason, reference)
      values (it.product_id, -remaining, 'sale', 'invoice:' || p_id);
    end if;
  end loop;
  return no;
end;
$$;

-- Cancel an issued invoice: keeps its number (no gaps), puts the products back into stock.
create or replace function public.cancel_invoice(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv record;
  it record;
begin
  select * into inv from public.invoices where id = p_id for update;
  if inv is null or inv.status = 'cancelled' then return; end if;
  if inv.stock_booked then
    for it in select * from public.invoice_items where invoice_id = p_id and product_id is not null loop
      insert into public.stock_movements (product_id, qty_change, reason, reference)
      values (it.product_id, ceil(it.qty)::int, 'return', 'invoice-cancel:' || p_id);
    end loop;
  end if;
  update public.invoices set status = 'cancelled', stock_booked = false, updated_at = now() where id = p_id;
end;
$$;

revoke execute on function public.issue_invoice(bigint) from public, anon, authenticated;
revoke execute on function public.cancel_invoice(bigint) from public, anon, authenticated;
grant execute on function public.issue_invoice(bigint) to service_role;
grant execute on function public.cancel_invoice(bigint) to service_role;
