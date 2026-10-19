-- The store owner's account becomes admin automatically on first sign-in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when lower(new.email) in (select lower(jsonb_array_elements_text(value)) from public.settings where key = 'admin_emails')
         then 'admin'::public.user_role else 'customer'::public.user_role end
  );
  return new;
end;
$$;

insert into public.settings (key, value) values ('admin_emails', '["solomon.tsehaye07@gmail.com"]'::jsonb)
on conflict (key) do update set value = excluded.value;

-- Never expose cost prices or supplier data through the public API
revoke select on public.products from anon, authenticated;
grant select (id, sku, slug, title, title_de, brand, description, category_id, price, compare_at_price, tax_rate, weight_g, size_qty, size_unit, image_url, images, country, is_frozen, age_restricted, is_dropship, status, featured, stock, reorder_point, reorder_qty, selldone_id, search, created_at, updated_at) on public.products to anon, authenticated;
