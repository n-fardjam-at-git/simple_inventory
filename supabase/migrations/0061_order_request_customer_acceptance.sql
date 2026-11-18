alter table public.customer_order_requests
  add column if not exists customer_acceptance boolean;

create or replace function public.customer_order_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if public.current_role() = 'customer' then
      if old.status <> 'draft' or old.customer_id is distinct from public.current_customer_id() then
        raise exception 'Only a draft order can be deleted';
      end if;
    end if;
    return old;
  end if;

  if public.current_role() = 'customer' then
    if tg_op = 'INSERT' then
      new.staff_reply := null;
      new.customer_acceptance := null;
    else
      new.staff_reply := old.staff_reply;
      if new.status = 'draft' then
        new.customer_acceptance := null;
      elsif new.status = 'submitted' and new.customer_acceptance is null then
        raise exception 'Choose whether to accept prices and terms';
      end if;
    end if;
  elsif tg_op = 'INSERT' then
    new.customer_acceptance := null;
  elsif old.status = 'draft' and new.status = 'draft' then
    new.customer_acceptance := old.customer_acceptance;
  end if;

  if new.status = 'accepted' and not (public.is_admin() or public.is_warehouse()) then
    raise exception 'Staff accept an order request';
  end if;

  if public.current_role() = 'customer' then
    if new.customer_id is distinct from public.current_customer_id() then
      raise exception 'Not your account';
    end if;
    if tg_op = 'INSERT' then
      if new.status <> 'draft' then
        raise exception 'Start with a draft';
      end if;
      new.created_by := auth.uid();
    else
      if old.customer_id is distinct from public.current_customer_id() then
        raise exception 'Not your account';
      end if;
      if old.status <> 'draft' then
        raise exception 'This order can no longer be changed';
      end if;
      if new.status not in ('draft', 'submitted') then
        raise exception 'Send the order or keep it a draft';
      end if;
      if new.status = 'submitted' then
        new.submitted_at := now();
      end if;
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

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
  if req.customer_acceptance is not true then
    raise exception 'The customer has not accepted prices and terms';
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
  set status = 'draft', customer_acceptance = null
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
