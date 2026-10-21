-- Explicit Data API grants for every table and view in "public".
-- From 30 Oct 2026 Supabase no longer grants API access to new tables automatically. The live tables keep the
-- grants they already have; this file writes them down, so a new project, a preview branch or `supabase db reset`
-- built from these migrations behaves exactly like production. Row Level Security still decides which rows each
-- role may read or change. Every NEW table needs the same three grant lines in the migration that creates it
-- (see README › "Adding a table").

do $$
declare t text;
begin
  foreach t in array array[
    'alerts', 'categories', 'expenses', 'home_sections', 'import_jobs', 'order_items', 'orders', 'pages',
    'price_changes', 'profiles', 'purchase_order_items', 'purchase_order_sends', 'purchase_orders', 'recipe_items',
    'recipes', 'settings', 'shipping_methods', 'stock_batches', 'stock_movements', 'store_sales', 'subscribers',
    'supplier_products', 'suppliers'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select, insert, update, delete on public.%I to anon, authenticated, service_role', t);
    end if;
  end loop;

  -- products: the public site may only read the columns granted in 0002/0005/0007/0008 (no cost prices etc.),
  -- so anon/authenticated get no table-wide SELECT here.
  grant insert, update, delete on public.products to anon, authenticated;
  grant select, insert, update, delete on public.products to service_role;

  -- Views run with the caller's rights (security_invoker), so RLS on the underlying tables still applies.
  foreach t in array array['low_stock', 'expiring_batches', 'product_unit_prices'] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select on public.%I to anon, authenticated, service_role', t);
    end if;
  end loop;
end $$;
