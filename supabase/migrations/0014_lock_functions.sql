-- Security lint: trigger functions never need to be callable through the API.
-- (is_staff() stays executable: row-level security policies run it as the visitor's role.
--  bestseller_ids() is meant to be public: it returns product ids and 90-day sales counts only.)
revoke execute on function public.cost_stock_movement() from public, anon, authenticated;
