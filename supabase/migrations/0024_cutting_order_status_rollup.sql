create or replace function public.cutting_orders_close_if_no_open_products()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  order_id uuid;
begin
  order_id := coalesce(new.cutting_order_id, old.cutting_order_id);
  if exists (
    select 1
    from public.cutting_order_products
    where cutting_order_id = order_id
      and status = true
  ) then
    return null;
  end if;
  update public.cutting_orders
  set status = false
  where id = order_id
    and status is distinct from false;
  return null;
end;
$$;

drop trigger if exists cutting_order_products_status_rollup on public.cutting_order_products;
create trigger cutting_order_products_status_rollup
  after update of status on public.cutting_order_products
  for each row
  when (old.status is distinct from new.status)
  execute function public.cutting_orders_close_if_no_open_products();

drop trigger if exists cutting_order_products_delete_rollup on public.cutting_order_products;
create trigger cutting_order_products_delete_rollup
  after delete on public.cutting_order_products
  for each row
  execute function public.cutting_orders_close_if_no_open_products();
