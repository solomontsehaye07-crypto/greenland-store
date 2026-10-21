-- Security hardening of the database rules (the app itself already separates roles in its UI):
-- 1. "staff" (shop floor) could use their login token directly against the database API and read or
--    change manager-only data (finances, invoices, settings). Row rules now distinguish manager/admin.
-- 2. The "admin_emails" list could turn a new sign-up into an admin. It now only works for the very first
--    admin (bootstrap); afterwards admins are made under Team & roles.

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('manager', 'admin'));
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin');
$$;

-- settings: everyone reads public.*, staff read nothing private, managers read/write all but admin_emails
drop policy if exists "staff settings" on public.settings;
drop policy if exists "public settings readable" on public.settings;
create policy "settings read" on public.settings for select
  using (key like 'public.%' or (select public.is_manager()));
create policy "settings write" on public.settings for all
  using ((select public.is_manager()) and key <> 'admin_emails')
  with check ((select public.is_manager()) and key <> 'admin_emails');

-- money and invoices: managers and the owner only
do $$
declare t text;
begin
  foreach t in array array['expenses', 'store_sales', 'price_changes', 'invoices', 'invoice_items', 'invoice_series', 'business_customers'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', 'staff ' || replace(t, '_', ' '), t);
      execute format('drop policy if exists %I on public.%I', 'staff ' || t, t);
      execute format('create policy %I on public.%I for all using ((select public.is_manager())) with check ((select public.is_manager()))', 'manager ' || t, t);
    end if;
  end loop;
end $$;

-- new accounts: customer, unless this is the first admin ever (bootstrap from admin_emails)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    lower(new.email),
    case when not exists (select 1 from public.profiles where role = 'admin')
          and lower(new.email) in (select lower(jsonb_array_elements_text(value)) from public.settings where key = 'admin_emails')
         then 'admin'::public.user_role else 'customer'::public.user_role end
  );
  return new;
end;
$$;

revoke execute on function public.is_manager() from public;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_manager(), public.is_admin() to anon, authenticated, service_role;
