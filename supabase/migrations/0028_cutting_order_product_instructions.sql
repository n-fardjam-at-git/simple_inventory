alter table public.cutting_order_products
  add column if not exists instructions text;
