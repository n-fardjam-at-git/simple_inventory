create or replace function public.cutting_orders_close_if_no_open_products()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  order_id uuid;
  has_open boolean;
begin
  order_id := coalesce(new.cutting_order_id, old.cutting_order_id);
  select exists (
    select 1
    from public.cutting_order_products
    where cutting_order_id = order_id
      and status = true
  ) into has_open;
  update public.cutting_orders
  set status = has_open
  where id = order_id
    and status is distinct from has_open;
  return null;
end;
$$;

drop trigger if exists cutting_order_products_insert_rollup on public.cutting_order_products;
create trigger cutting_order_products_insert_rollup
  after insert on public.cutting_order_products
  for each row
  execute function public.cutting_orders_close_if_no_open_products();
