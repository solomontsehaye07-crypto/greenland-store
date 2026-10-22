-- Steuerberater access: own role, change log for cash book lines.
-- (run on its own: a new enum value can't be used in the same transaction)
alter type public.user_role add value if not exists 'tax_advisor';

-- Every change to a booked line: old and new value, reason, who and when (GoBD: changes stay traceable).
create table if not exists public.cashbook_changes (
  id bigint generated always as identity primary key,
  entry_id bigint not null references public.cashbook_entries(id),
  field text not null,
  old_value text,
  new_value text,
  reason text not null check (length(trim(reason)) >= 3),
  changed_by uuid,
  changed_by_email text,
  changed_by_role text,
  changed_at timestamptz not null default now()
);
create index if not exists cashbook_changes_entry on public.cashbook_changes (entry_id, changed_at);
alter table public.cashbook_changes enable row level security;

-- the log itself is append-only
create or replace trigger cashbook_changes_lock before update or delete on public.cashbook_changes
  for each row execute function public.cashbook_no_change();

-- Lines stay locked, except the account fields (BU, Gegenkonto, USt %, Notiz) when changed through cashbook_classify.
create or replace function public.cashbook_no_change() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and tg_table_name = 'cashbook_entries' and current_setting('cashbook.classify', true) = 'on' then
    if new.id = old.id and new.year = old.year and new.month = old.month and new.seq = old.seq and new.entry_date = old.entry_date
       and new.income = old.income and new.expense = old.expense and new.text = old.text
       and new.storno_of is not distinct from old.storno_of and new.created_at = old.created_at and new.created_by is not distinct from old.created_by then
      return new;
    end if;
  end if;
  raise exception 'Kassenbuch-Einträge und das Änderungsprotokoll können nicht geändert oder gelöscht werden – bitte eine Stornobuchung erfassen.';
end $$;

create or replace function public.cashbook_classify(
  p_id bigint, p_bu text, p_contra text, p_vat numeric, p_note text, p_reason text, p_user uuid, p_email text, p_role text
) returns int language plpgsql as $$
declare e public.cashbook_entries; n int := 0;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'Bitte einen Grund für die Änderung angeben.'; end if;
  select * into e from public.cashbook_entries where id = p_id for update;
  if not found then raise exception 'Buchung nicht gefunden.'; end if;
  if e.bu is distinct from nullif(p_bu, '') then
    insert into public.cashbook_changes (entry_id, field, old_value, new_value, reason, changed_by, changed_by_email, changed_by_role) values (p_id, 'BU', e.bu, nullif(p_bu, ''), p_reason, p_user, p_email, p_role); n := n + 1; end if;
  if e.contra_account is distinct from nullif(p_contra, '') then
    insert into public.cashbook_changes (entry_id, field, old_value, new_value, reason, changed_by, changed_by_email, changed_by_role) values (p_id, 'Gegenkonto', e.contra_account, nullif(p_contra, ''), p_reason, p_user, p_email, p_role); n := n + 1; end if;
  if e.vat_rate is distinct from p_vat then
    insert into public.cashbook_changes (entry_id, field, old_value, new_value, reason, changed_by, changed_by_email, changed_by_role) values (p_id, 'USt %', e.vat_rate::text, p_vat::text, p_reason, p_user, p_email, p_role); n := n + 1; end if;
  if e.note is distinct from nullif(p_note, '') then
    insert into public.cashbook_changes (entry_id, field, old_value, new_value, reason, changed_by, changed_by_email, changed_by_role) values (p_id, 'Notiz', e.note, nullif(p_note, ''), p_reason, p_user, p_email, p_role); n := n + 1; end if;
  if n = 0 then return 0; end if;
  perform set_config('cashbook.classify', 'on', true);
  update public.cashbook_entries set bu = nullif(p_bu, ''), contra_account = nullif(p_contra, ''), vat_rate = p_vat, note = nullif(p_note, '') where id = p_id;
  perform set_config('cashbook.classify', 'off', true);
  return n;
end $$;
revoke all on function public.cashbook_classify(bigint, text, text, numeric, text, text, uuid, text, text) from public, anon, authenticated;
