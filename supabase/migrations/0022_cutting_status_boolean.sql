-- true = open; false = closed (was received/cancelled on orders, complete on products)

alter table public.cutting_orders drop constraint if exists cutting_orders_status_check;
alter table public.cutting_orders alter column status drop default;
alter table public.cutting_orders
  alter column status type boolean using (status = 'open');
alter table public.cutting_orders alter column status set default true;
alter table public.cutting_orders alter column status set not null;

alter table public.cutting_order_products drop constraint if exists cutting_order_products_status_check;
alter table public.cutting_order_products alter column status drop default;
alter table public.cutting_order_products
  alter column status type boolean using (status = 'open');
alter table public.cutting_order_products alter column status set default true;
alter table public.cutting_order_products alter column status set not null;
