create or replace function public.cutting_order_qty_ordered(p_cutting_order_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce(sum(qty_ordered), 0)::int
  from public.cutting_quantities
  where cutting_order_id = p_cutting_order_id;
$$;

create or replace function public.cutting_order_qty_received(p_cutting_order_id uuid)
returns int
language sql
stable
set search_path = public
as $$
  select coalesce(sum(qty_received), 0)::int
  from public.cutting_quantities
  where cutting_order_id = p_cutting_order_id;
$$;

grant execute on function public.cutting_order_qty_ordered(uuid) to authenticated;
grant execute on function public.cutting_order_qty_received(uuid) to authenticated;
