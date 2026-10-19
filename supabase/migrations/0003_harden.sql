-- Trigger functions must not be callable through the REST API.
revoke execute on function public.apply_stock_movement() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
-- is_staff() stays executable: RLS policies call it as the requesting role; it only reveals the caller's own role.
