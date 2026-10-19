-- The public site reads the German description and extra images.
grant select (description_de, images_extra) on public.products to anon, authenticated;
