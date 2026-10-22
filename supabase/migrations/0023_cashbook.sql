-- Kassenbuch (shop cash book) and data for the online book.
-- GoBD: saved lines can never be changed or deleted – corrections are counter-entries (Storno).
-- Closed months take no new lines. Everything goes through staff server actions (service role); no client access.

create table if not exists public.cashbook_months (
  year int not null,
  month int not null check (month between 1 and 12),
  opening_balance numeric(12,2) not null default 0,
  closed_at timestamptz,
  closed_by uuid,
  primary key (year, month)
);

create table if not exists public.cashbook_entries (
  id bigint generated always as identity primary key,
  year int not null,
  month int not null,
  seq int not null,
  entry_date date not null,
  income numeric(12,2) not null default 0 check (income >= 0),
  expense numeric(12,2) not null default 0 check (expense >= 0),
  text text not null check (length(text) between 1 and 200),
  bu text,
  contra_account text,
  vat_rate numeric(4,1),
  note text,
  storno_of bigint references public.cashbook_entries(id),
  created_at timestamptz not null default now(),
  created_by uuid,
  check ((income > 0) <> (expense > 0)),
  check (extract(year from entry_date) = year and extract(month from entry_date) = month),
  unique (year, month, seq)
);
create index if not exists cashbook_entries_month on public.cashbook_entries (year, month, seq);

create table if not exists public.cashbook_templates (
  id bigint generated always as identity primary key,
  text text not null,
  kind text not null check (kind in ('in','out')),
  bu text,
  contra_account text,
  vat_rate numeric(4,1),
  sort int not null default 0
);

-- lines are append-only
create or replace function public.cashbook_no_change() returns trigger language plpgsql as $$
begin
  raise exception 'Kassenbuch-Einträge können nicht geändert oder gelöscht werden – bitte eine Stornobuchung erfassen.';
end $$;
create or replace trigger cashbook_entries_lock before update or delete on public.cashbook_entries
  for each row execute function public.cashbook_no_change();

-- no lines in closed months; numbering per month without gaps
create or replace function public.cashbook_add(
  p_date date, p_income numeric, p_expense numeric, p_text text, p_bu text, p_contra text, p_vat numeric, p_note text, p_storno_of bigint, p_user uuid
) returns public.cashbook_entries language plpgsql as $$
declare y int := extract(year from p_date); m int := extract(month from p_date); n int; r public.cashbook_entries; bal numeric;
begin
  insert into public.cashbook_months (year, month, opening_balance)
    values (y, m, coalesce((select opening_balance + coalesce((select sum(income - expense) from public.cashbook_entries e where e.year = cm.year and e.month = cm.month), 0)
                             from public.cashbook_months cm where (cm.year, cm.month) < (y, m) order by cm.year desc, cm.month desc limit 1), 0))
    on conflict do nothing;
  if exists (select 1 from public.cashbook_months where year = y and month = m and closed_at is not null) then
    raise exception 'Der Monat %/% ist abgeschlossen.', m, y;
  end if;
  perform 1 from public.cashbook_months where year = y and month = m for update;
  select coalesce(max(seq), 0) + 1 into n from public.cashbook_entries where year = y and month = m;
  select opening_balance + coalesce((select sum(income - expense) from public.cashbook_entries where year = y and month = m), 0)
    into bal from public.cashbook_months where year = y and month = m;
  if bal + coalesce(p_income, 0) - coalesce(p_expense, 0) < 0 then
    raise exception 'Der Kassenbestand würde negativ (%). Bitte Reihenfolge und Beträge prüfen.', bal + coalesce(p_income, 0) - coalesce(p_expense, 0);
  end if;
  insert into public.cashbook_entries (year, month, seq, entry_date, income, expense, text, bu, contra_account, vat_rate, note, storno_of, created_by)
    values (y, m, n, p_date, coalesce(p_income, 0), coalesce(p_expense, 0), p_text, nullif(p_bu, ''), nullif(p_contra, ''), p_vat, nullif(p_note, ''), p_storno_of, p_user)
    returning * into r;
  return r;
end $$;

alter table public.cashbook_months enable row level security;
alter table public.cashbook_entries enable row level security;
alter table public.cashbook_templates enable row level security;
revoke all on function public.cashbook_add(date, numeric, numeric, text, text, text, numeric, text, bigint, uuid) from public, anon, authenticated;

insert into public.cashbook_templates (text, kind, sort)
select * from (values ('Bargeld Kasse 1789', 'in', 1), ('Bargeld Kasse 1790', 'in', 2), ('Trinkgeld', 'out', 3), ('Bankeinzahlung', 'out', 4), ('Wareneinkauf bar', 'out', 5), ('Privatentnahme', 'out', 6), ('Privateinlage', 'in', 7)) v(text, kind, sort)
where not exists (select 1 from public.cashbook_templates);

-- online book: payment fees and refund date per order
alter table public.orders add column if not exists payment_fee numeric(10,2);
alter table public.orders add column if not exists refunded_at timestamptz;
create or replace function public.orders_refund_stamp() returns trigger language plpgsql as $$
begin
  if new.status in ('refunded', 'cancelled') and old.status is distinct from new.status and new.paid_at is not null and new.refunded_at is null then
    new.refunded_at := now();
  end if;
  return new;
end $$;
create or replace trigger orders_refund_stamp before update on public.orders for each row execute function public.orders_refund_stamp();
