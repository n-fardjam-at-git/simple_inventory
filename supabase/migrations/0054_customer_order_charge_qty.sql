-- Surcharge quantity on a customer order. Freight is always 1.
-- Merchandise leaves qty null and keeps quantity on size/drop cells.

alter table public.customer_order_products
  add column if not exists qty int;

alter table public.customer_order_products
  drop constraint if exists customer_order_products_qty_check;

alter table public.customer_order_products
  add constraint customer_order_products_qty_check
  check (qty is null or qty >= 0);

comment on column public.customer_order_products.qty is
  'Surcharge quantity. Freight is always 1. Merchandise leaves this null and uses size/drop cells.';
