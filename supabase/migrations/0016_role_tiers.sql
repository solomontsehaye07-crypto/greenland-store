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

-- settings: everyone reads public.*, managers read/write the rest (never admin_emails)
alter policy "public settings readable" on public.settings using (key like 'public.%' or (select public.is_manager()));
alter policy "staff settings" on public.settings
  using ((select public.is_manager()) and key <> 'admin_emails') with check ((select public.is_manager()) and key <> 'admin_emails');

-- money and invoices: managers and the owner only (policy names kept; they were altered in place)
alter policy "staff expenses" on public.expenses using ((select public.is_manager())) with check ((select public.is_manager()));
alter policy "staff store_sales" on public.store_sales using ((select public.is_manager())) with check ((select public.is_manager()));
alter policy "staff price_changes" on public.price_changes using ((select public.is_manager())) with check ((select public.is_manager()));
alter policy "staff invoices" on public.invoices using ((select public.is_manager())) with check ((select public.is_manager()));
alter policy "staff invoice items" on public.invoice_items using ((select public.is_manager())) with check ((select public.is_manager()));
alter policy "staff invoice series" on public.invoice_series using ((select public.is_manager())) with check ((select public.is_manager()));
alter policy "staff business customers" on public.business_customers using ((select public.is_manager())) with check ((select public.is_manager()));

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
