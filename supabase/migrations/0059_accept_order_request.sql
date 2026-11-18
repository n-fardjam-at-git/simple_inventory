create or replace function public.accept_customer_order_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.customer_order_requests;
  oid uuid;
begin
  if not (public.is_admin() or public.is_warehouse()) then
    raise exception 'not allowed';
  end if;

  select * into req from public.customer_order_requests where id = p_request_id for update;
  if not found then
    raise exception 'order not found';
  end if;
  if req.status <> 'submitted' then
    raise exception 'order is not submitted';
  end if;

  insert into public.customer_orders (
    customer_id,
    status,
    future_season,
    start_date,
    cancel_date,
    terms,
    shipment_method_id,
    shipping_method,
    transmission_method_id,
    transmission_method,
    ship_address_line1,
    ship_address_line2,
    ship_city,
    ship_region,
    ship_postal_code,
    ship_country,
    bill_address_line1,
    bill_address_line2,
    bill_city,
    bill_region,
    bill_postal_code,
    bill_country,
    sales_rep_id,
    created_by,
    updated_by,
    notes
  )
  values (
    req.customer_id,
    'pending',
    req.future_season,
    req.start_date,
    req.cancel_date,
    req.terms,
    req.shipment_method_id,
    req.shipping_method,
    req.transmission_method_id,
    req.transmission_method,
    req.ship_address_line1,
    req.ship_address_line2,
    req.ship_city,
    req.ship_region,
    req.ship_postal_code,
    req.ship_country,
    req.bill_address_line1,
    req.bill_address_line2,
    req.bill_city,
    req.bill_region,
    req.bill_postal_code,
    req.bill_country,
    req.sales_rep_id,
    auth.uid(),
    auth.uid(),
    req.notes
  )
  returning id into oid;

  insert into public.customer_order_products (
    customer_order_id, product_id, price, qty, commission_rate, status
  )
  select oid, product_id, price, qty, commission_rate, 'pending'
  from public.customer_order_request_products
  where request_id = req.id;

  insert into public.customer_order_cells (
    customer_order_id, product_id, size_id, drop_id, qty, qty_shipped, price
  )
  select oid, product_id, size_id, drop_id, qty, 0, price
  from public.customer_order_request_cells
  where request_id = req.id
    and qty > 0;

  update public.customer_order_requests
  set status = 'accepted', accepted_order_id = oid
  where id = req.id;

  return oid;
end;
$$;

create or replace function public.return_customer_order_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_admin() or public.is_warehouse()) then
    raise exception 'not allowed';
  end if;

  update public.customer_order_requests
  set status = 'draft'
  where id = p_request_id
    and status = 'submitted';

  if not found then
    raise exception 'order is not submitted';
  end if;
end;
$$;

revoke all on function public.accept_customer_order_request(uuid) from public;
revoke all on function public.return_customer_order_request(uuid) from public;
grant execute on function public.accept_customer_order_request(uuid) to authenticated;
grant execute on function public.return_customer_order_request(uuid) to authenticated;

notify pgrst, 'reload schema';
