-- Add order on a customer shipment can take a list of products.
-- p_product_ids null adds every open product of the order, as before.
-- A list adds only those products, each under the same rules: the line is open,
-- it is not already on this shipment, and something is left to ship.
-- The old two-argument function is dropped so the name has one meaning.

drop function if exists public.add_order_to_customer_shipment(uuid, uuid);

create or replace function public.add_order_to_customer_shipment(
  p_shipment_id uuid,
  p_order_id uuid,
  p_product_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  shp public.customer_shipments;
  ord public.customer_orders;
  rec record;
  has_orders boolean;
  new_line uuid;
  added integer := 0;
begin
  if not (public.is_admin() or public.is_warehouse()) then
    raise exception 'not allowed';
  end if;

  if p_product_ids is not null and coalesce(array_length(p_product_ids, 1), 0) = 0 then
    raise exception 'Check at least one product';
  end if;

  select * into shp
  from public.customer_shipments
  where id = p_shipment_id
  for update;
  if not found then
    raise exception 'shipment not found';
  end if;
  if shp.status in ('shipped', 'canceled') then
    raise exception 'This shipment can no longer be changed';
  end if;

  select * into ord from public.customer_orders where id = p_order_id;
  if not found then
    raise exception 'order not found';
  end if;
  if ord.customer_id <> shp.customer_id then
    raise exception 'That order belongs to another customer';
  end if;
  if ord.status not in ('approved', 'picking', 'back_order') then
    raise exception 'Only an approved order can be shipped';
  end if;

  select exists (
    select 1
    from public.customer_shipment_products sp
    where sp.customer_shipment_id = shp.id
      and sp.customer_order_id is not null
  )
  into has_orders;

  if has_orders then
    if public.customer_shipment_address_key(
         ord.ship_address_line1, ord.ship_address_line2, ord.ship_city,
         ord.ship_region, ord.ship_postal_code, ord.ship_country
       ) <> public.customer_shipment_address_key(
         shp.ship_address_line1, shp.ship_address_line2, shp.ship_city,
         shp.ship_region, shp.ship_postal_code, shp.ship_country
       ) then
      raise exception 'Order % has a different ship-to address', ord.order_no;
    end if;
    if public.customer_shipment_address_key(
         ord.bill_address_line1, ord.bill_address_line2, ord.bill_city,
         ord.bill_region, ord.bill_postal_code, ord.bill_country
       ) <> public.customer_shipment_address_key(
         shp.bill_address_line1, shp.bill_address_line2, shp.bill_city,
         shp.bill_region, shp.bill_postal_code, shp.bill_country
       ) then
      raise exception 'Order % has a different bill-to address', ord.order_no;
    end if;
    if lower(btrim(coalesce(ord.terms, ''))) <> lower(btrim(coalesce(shp.terms, ''))) then
      raise exception 'Order % has different terms', ord.order_no;
    end if;
    if ord.shipment_method_id is distinct from shp.shipment_method_id
       or lower(btrim(coalesce(ord.shipping_method, '')))
          <> lower(btrim(coalesce(shp.shipping_method, ''))) then
      raise exception 'Order % has a different shipping method', ord.order_no;
    end if;
    if ord.sales_rep_id is distinct from shp.sales_rep_id then
      raise exception 'Order % has a different sales rep', ord.order_no;
    end if;
  else
    update public.customer_shipments
    set
      terms = ord.terms,
      shipment_method_id = ord.shipment_method_id,
      shipping_method = ord.shipping_method,
      sales_rep_id = ord.sales_rep_id,
      ship_address_line1 = ord.ship_address_line1,
      ship_address_line2 = ord.ship_address_line2,
      ship_city = ord.ship_city,
      ship_region = ord.ship_region,
      ship_postal_code = ord.ship_postal_code,
      ship_country = ord.ship_country,
      bill_address_line1 = ord.bill_address_line1,
      bill_address_line2 = ord.bill_address_line2,
      bill_city = ord.bill_city,
      bill_region = ord.bill_region,
      bill_postal_code = ord.bill_postal_code,
      bill_country = ord.bill_country
    where id = shp.id;
  end if;

  for rec in
    select cop.product_id, cop.price, cop.qty, p.type
    from public.customer_order_products cop
    join public.products p on p.id = cop.product_id
    where cop.customer_order_id = ord.id
      and cop.status in ('pending', 'back_order')
      and (p_product_ids is null or cop.product_id = any(p_product_ids))
      and not exists (
        select 1
        from public.customer_shipment_products sp
        where sp.customer_shipment_id = shp.id
          and sp.customer_order_id = ord.id
          and sp.product_id = cop.product_id
      )
  loop
    if rec.type = 1 then
      if not exists (
        select 1
        from public.customer_order_cells c
        where c.customer_order_id = ord.id
          and c.product_id = rec.product_id
          and c.qty - c.qty_shipped
              - public.customer_shipment_open_qty(ord.id, rec.product_id, c.size_id, c.drop_id) > 0
      ) then
        continue;
      end if;

      insert into public.customer_shipment_products (
        customer_shipment_id, customer_order_id, product_id
      )
      values (shp.id, ord.id, rec.product_id)
      returning id into new_line;

      insert into public.customer_shipment_cells (
        customer_shipment_product_id, size_id, drop_id, qty, price
      )
      select
        new_line,
        c.size_id,
        c.drop_id,
        greatest(
          0,
          c.qty - c.qty_shipped
            - public.customer_shipment_open_qty(ord.id, rec.product_id, c.size_id, c.drop_id)
        ),
        rec.price + coalesce(c.price, 0)
      from public.customer_order_cells c
      where c.customer_order_id = ord.id
        and c.product_id = rec.product_id
        and c.qty > 0;
    else
      if exists (
        select 1
        from public.customer_shipment_products sp
        join public.customer_shipments s on s.id = sp.customer_shipment_id
        where sp.customer_order_id = ord.id
          and sp.product_id = rec.product_id
          and s.status <> 'canceled'
      ) then
        continue;
      end if;

      insert into public.customer_shipment_products (
        customer_shipment_id, customer_order_id, product_id, qty, price
      )
      values (
        shp.id,
        ord.id,
        rec.product_id,
        case when rec.type = 3 then 1 else coalesce(rec.qty, 1) end,
        rec.price
      );
    end if;
    added := added + 1;
  end loop;

  if added = 0 then
    raise exception 'Nothing is left to ship on order %', ord.order_no;
  end if;
  return added;
end;
$$;

revoke all on function public.add_order_to_customer_shipment(uuid, uuid, uuid[]) from public;
grant execute on function public.add_order_to_customer_shipment(uuid, uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';
