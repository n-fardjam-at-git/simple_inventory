create or replace function public.cutting_product_qty_received(
  p_cutting_order_id uuid,
  p_product_id uuid
)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce(sum(qty_received), 0)::int
  from public.cutting_quantities
  where cutting_order_id = p_cutting_order_id
    and product_id = p_product_id;
$$;

grant execute on function public.cutting_product_qty_received(uuid, uuid) to authenticated;
