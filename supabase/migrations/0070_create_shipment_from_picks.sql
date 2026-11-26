-- Pick list: create a customer shipment from picked order products.
--
-- p_picks is a JSON array of { "order_id": uuid, "product_id": uuid }.
-- The shipment gets only those products. A merchandise cell is added with what is
-- left to ship on the order: qty - qty_shipped. A cell with nothing left is left off.
-- All or nothing: any refusal rolls the new shipment back.

create or replace function public.create_customer_shipment_from_picks(
  p_customer_id uuid,
  p_picks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  shp public.customer_shipments;
  ord public.customer_orders;
  first_ord public.customer_orders;
  has_first boolean := false;
  line record;
  new_line uuid;
  wanted integer;
  found_orders integer := 0;
begin
  if not (public.is_admin() or public.is_warehouse()) then
    raise exception 'not allowed';
  end if;

  if p_picks is null
     or jsonb_typeof(p_picks) <> 'array'
     or jsonb_array_length(p_picks) = 0 then
    raise exception 'Nothing is picked';
  end if;

  if not exists (select 1 from public.customers c where c.id = p_customer_id) then
    raise exception 'customer not found';
  end if;

  select count(distinct (e->>'order_id')::uuid)
  into wanted
  from jsonb_array_elements(p_picks) e;

  insert into public.customer_shipments (customer_id)
  values (p_customer_id)
  returning * into shp;

  for ord in
    select o.*
    from public.customer_orders o
    where o.id in (
      select (e->>'order_id')::uuid
      from jsonb_array_elements(p_picks) e
    )
    order by o.order_no
  loop
    found_orders := found_orders + 1;

    if ord.customer_id <> p_customer_id then
      raise exception 'Order % belongs to another customer', ord.order_no;
    end if;
    if ord.status not in ('approved', 'picking', 'back_order') then
      raise exception 'Order % can no longer be shipped', ord.order_no;
    end if;

    if has_first then
      if public.customer_shipment_address_key(
           ord.ship_address_line1, ord.ship_address_line2, ord.ship_city,
           ord.ship_region, ord.ship_postal_code, ord.ship_country
         ) <> public.customer_shipment_address_key(
           first_ord.ship_address_line1, first_ord.ship_address_line2, first_ord.ship_city,
           first_ord.ship_region, first_ord.ship_postal_code, first_ord.ship_country
         ) then
        raise exception 'Order % has a different ship-to address', ord.order_no;
      end if;
      if public.customer_shipment_address_key(
           ord.bill_address_line1, ord.bill_address_line2, ord.bill_city,
           ord.bill_region, ord.bill_postal_code, ord.bill_country
         ) <> public.customer_shipment_address_key(
           first_ord.bill_address_line1, first_ord.bill_address_line2, first_ord.bill_city,
           first_ord.bill_region, first_ord.bill_postal_code, first_ord.bill_country
         ) then
        raise exception 'Order % has a different bill-to address', ord.order_no;
      end if;
      if lower(btrim(coalesce(ord.terms, ''))) <> lower(btrim(coalesce(first_ord.terms, ''))) then
        raise exception 'Order % has different terms', ord.order_no;
      end if;
      if ord.shipment_method_id is distinct from first_ord.shipment_method_id
         or lower(btrim(coalesce(ord.shipping_method, '')))
            <> lower(btrim(coalesce(first_ord.shipping_method, ''))) then
        raise exception 'Order % has a different shipping method', ord.order_no;
      end if;
      if ord.sales_rep_id is distinct from first_ord.sales_rep_id then
        raise exception 'Order % has a different sales rep', ord.order_no;
      end if;
    else
      -- The first order fills the shipment header, the same as Add order.
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
      first_ord := ord;
      has_first := true;
    end if;

    for line in
      select
        k.product_id,
        cop.status,
        cop.price,
        cop.qty,
        p.type,
        coalesce(nullif(btrim(p.name), ''), 'Product') as product_name
      from (
        select distinct (e->>'product_id')::uuid as product_id
        from jsonb_array_elements(p_picks) e
        where (e->>'order_id')::uuid = ord.id
      ) k
      left join public.customer_order_products cop
        on cop.customer_order_id = ord.id
       and cop.product_id = k.product_id
      left join public.products p on p.id = k.product_id
    loop
      if line.status is null then
        raise exception '% is no longer on order %', line.product_name, ord.order_no;
      end if;
      if line.status not in ('pending', 'back_order') then
        raise exception '% on order % is no longer open', line.product_name, ord.order_no;
      end if;

      if line.type = 1 then
        if not exists (
          select 1
          from public.customer_order_cells c
          where c.customer_order_id = ord.id
            and c.product_id = line.product_id
            and c.qty - c.qty_shipped > 0
        ) then
          raise exception '% on order % has nothing left to ship', line.product_name, ord.order_no;
        end if;

        insert into public.customer_shipment_products (
          customer_shipment_id, customer_order_id, product_id
        )
        values (shp.id, ord.id, line.product_id)
        returning id into new_line;

        -- Left to ship is ordered minus shipped. The price is the full unit price.
        insert into public.customer_shipment_cells (
          customer_shipment_product_id, size_id, drop_id, qty, price
        )
        select
          new_line,
          c.size_id,
          c.drop_id,
          c.qty - c.qty_shipped,
          line.price + coalesce(c.price, 0)
        from public.customer_order_cells c
        where c.customer_order_id = ord.id
          and c.product_id = line.product_id
          and c.qty - c.qty_shipped > 0;
      else
        -- An order's freight or surcharge goes on one shipment only.
        if exists (
          select 1
          from public.customer_shipment_products sp
          join public.customer_shipments s on s.id = sp.customer_shipment_id
          where sp.customer_order_id = ord.id
            and sp.product_id = line.product_id
            and s.status <> 'canceled'
        ) then
          raise exception '% on order % is already on a shipment', line.product_name, ord.order_no;
        end if;

        insert into public.customer_shipment_products (
          customer_shipment_id, customer_order_id, product_id, qty, price
        )
        values (
          shp.id,
          ord.id,
          line.product_id,
          case when line.type = 3 then 1 else coalesce(line.qty, 1) end,
          line.price
        );
      end if;
    end loop;
  end loop;

  if found_orders <> wanted then
    raise exception 'An order on the pick list is no longer here';
  end if;

  return jsonb_build_object('id', shp.id, 'shipment_no', shp.shipment_no);
end;
$$;

revoke all on function public.create_customer_shipment_from_picks(uuid, jsonb) from public;
grant execute on function public.create_customer_shipment_from_picks(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
