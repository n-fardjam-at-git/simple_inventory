create or replace function public.post_vendor_shipment(p_shipment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  closed_cutting int;
  closed_product text;
  closed_product_cutting int;
begin
  if not (public.is_admin() or public.is_warehouse()) then
    raise exception 'not allowed';
  end if;
  if not exists (select 1 from public.vendor_shipments where id = p_shipment_id) then
    raise exception 'shipment not found';
  end if;
  if public.vendor_shipment_is_posted(p_shipment_id) then
    raise exception 'already posted';
  end if;

  select co.order_num
  into closed_cutting
  from public.vendor_shipment_products sp
  join public.cutting_orders co on co.id = sp.cutting_order_id
  where sp.shipment_id = p_shipment_id
    and co.status is distinct from true
  order by co.order_num
  limit 1;
  if closed_cutting is not null then
    raise exception 'Cutting % is closed', closed_cutting;
  end if;

  select
    coalesce(nullif(btrim(p.name), ''), 'Product'),
    co.order_num
  into closed_product, closed_product_cutting
  from public.vendor_shipment_products sp
  join public.cutting_orders co on co.id = sp.cutting_order_id
  join public.products p on p.id = sp.product_id
  left join public.cutting_order_products cop
    on cop.cutting_order_id = sp.cutting_order_id
   and cop.product_id = sp.product_id
  where sp.shipment_id = p_shipment_id
    and (cop.product_id is null or cop.status is distinct from true)
  order by co.order_num, 1
  limit 1;
  if closed_product is not null then
    raise exception '% on cutting % is complete', closed_product, closed_product_cutting;
  end if;

  for rec in
    select
      sp.cutting_order_id,
      sp.product_id,
      c.size_id,
      c.drop_id,
      c.qty
    from public.vendor_shipment_products sp
    join public.vendor_shipment_cells c on c.shipment_product_id = sp.id
    where sp.shipment_id = p_shipment_id
      and c.qty <> 0
  loop
    insert into public.inventory (product_id, size_id, drop_id, qty_on_hand, reorder_point)
    values (rec.product_id, rec.size_id, rec.drop_id, rec.qty, 0)
    on conflict (product_id, size_id, drop_id)
    do update set qty_on_hand = public.inventory.qty_on_hand + excluded.qty_on_hand;

    insert into public.cutting_quantities (
      cutting_order_id, product_id, size_id, drop_id, qty_ordered, qty_received
    )
    values (
      rec.cutting_order_id, rec.product_id, rec.size_id, rec.drop_id, 0, rec.qty
    )
    on conflict (cutting_order_id, product_id, size_id, drop_id)
    do update set qty_received = public.cutting_quantities.qty_received + excluded.qty_received;

    insert into public.stock_movements (
      type, qty, product_id, size_id, drop_id, vendor_shipment_id, user_id
    ) values (
      'receive', rec.qty, rec.product_id, rec.size_id, rec.drop_id, p_shipment_id, auth.uid()
    );
  end loop;

  update public.vendor_shipments
  set posted = true, posted_at = now(), received_by = auth.uid()
  where id = p_shipment_id;
end;
$$;
