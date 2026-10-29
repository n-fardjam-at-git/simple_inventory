-- Close a cutting_order_product when sized qty is fully received.
-- Does not reopen if ordered later exceeds received.
-- Ordered total must be > 0 so unsized lines stay Open.

create or replace function public.cutting_quantities_close_product_if_filled()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  order_id uuid;
  prod_id uuid;
  ordered int;
  received int;
begin
  order_id := coalesce(new.cutting_order_id, old.cutting_order_id);
  prod_id := coalesce(new.product_id, old.product_id);

  select
    coalesce(sum(qty_ordered), 0)::int,
    coalesce(sum(qty_received), 0)::int
  into ordered, received
  from public.cutting_quantities
  where cutting_order_id = order_id
    and product_id = prod_id;

  if ordered > 0 and received >= ordered then
    update public.cutting_order_products
    set status = false
    where cutting_order_id = order_id
      and product_id = prod_id
      and status is distinct from false;
  end if;

  return null;
end;
$$;

drop trigger if exists cutting_quantities_close_product on public.cutting_quantities;
create trigger cutting_quantities_close_product
  after insert or update of qty_ordered, qty_received or delete
  on public.cutting_quantities
  for each row
  execute function public.cutting_quantities_close_product_if_filled();
