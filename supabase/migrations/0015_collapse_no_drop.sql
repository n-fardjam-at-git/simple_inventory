-- Move product/inventory/shipment refs off a drop so a chart can become no-drop.

create or replace function public.retarget_drop(p_from uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_from is null or p_to is null or p_from = p_to then
    return;
  end if;

  insert into public.product_drops (product_id, drop_id)
  select product_id, p_to from public.product_drops where drop_id = p_from
  on conflict do nothing;
  delete from public.product_drops where drop_id = p_from;

  insert into public.inventory (product_id, size_id, drop_id, qty_on_hand, reorder_point)
  select product_id, size_id, p_to, qty_on_hand, reorder_point
  from public.inventory
  where drop_id = p_from
  on conflict (product_id, size_id, drop_id) do update
  set
    qty_on_hand = public.inventory.qty_on_hand + excluded.qty_on_hand,
    reorder_point = greatest(public.inventory.reorder_point, excluded.reorder_point);
  delete from public.inventory where drop_id = p_from;

  insert into public.product_price_upcharges (product_id, size_id, drop_id, upcharge_amount)
  select product_id, size_id, p_to, upcharge_amount
  from public.product_price_upcharges
  where drop_id = p_from
  on conflict (product_id, size_id, drop_id) do update
  set upcharge_amount = greatest(
    public.product_price_upcharges.upcharge_amount,
    excluded.upcharge_amount
  );
  delete from public.product_price_upcharges where drop_id = p_from;

  insert into public.customer_shipment_cells (
    customer_shipment_product_id, size_id, drop_id, qty
  )
  select customer_shipment_product_id, size_id, p_to, qty
  from public.customer_shipment_cells
  where drop_id = p_from
  on conflict (customer_shipment_product_id, size_id, drop_id) do update
  set qty = public.customer_shipment_cells.qty + excluded.qty;
  delete from public.customer_shipment_cells where drop_id = p_from;

  insert into public.cutting_shipment_cells (
    cutting_shipment_product_id, size_id, drop_id, qty
  )
  select cutting_shipment_product_id, size_id, p_to, qty
  from public.cutting_shipment_cells
  where drop_id = p_from
  on conflict (cutting_shipment_product_id, size_id, drop_id) do update
  set qty = public.cutting_shipment_cells.qty + excluded.qty;
  delete from public.cutting_shipment_cells where drop_id = p_from;

  update public.stock_movements set drop_id = p_to where drop_id = p_from;
end;
$$;

create or replace function public.collapse_chart_to_no_drop(p_chart_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sentinel uuid;
  r record;
begin
  if not public.is_admin() then
    raise exception 'not allowed';
  end if;

  insert into public.size_chart_drops (chart_id, code, sort_order)
  values (p_chart_id, '', 100000)
  on conflict (chart_id, code) do update set code = excluded.code
  returning id into sentinel;

  if sentinel is null then
    select id into sentinel
    from public.size_chart_drops
    where chart_id = p_chart_id and code = '';
  end if;

  for r in
    select id
    from public.size_chart_drops
    where chart_id = p_chart_id and id is distinct from sentinel
  loop
    perform public.retarget_drop(r.id, sentinel);
    delete from public.size_chart_drops where id = r.id;
  end loop;

  update public.size_chart_drops set sort_order = 1 where id = sentinel;
end;
$$;

grant execute on function public.retarget_drop(uuid, uuid) to authenticated;
grant execute on function public.collapse_chart_to_no_drop(uuid) to authenticated;
