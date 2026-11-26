-- Picking on a customer order is automatic.
-- An order is picking while one of its products is on a customer shipment that is
-- not shipped and not canceled. When the last such shipment is shipped, canceled,
-- or deleted, or the order's last line is taken off it, the header goes back to
-- what its merchandise lines say: approved, back order, or complete.
-- Picking can no longer be set by hand.

-- One place that sets the header: the merchandise rollup (0055), then picking on top.
create or replace function public.customer_order_sync_status(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  n_cancel int;
  n_complete int;
  n_short int;
  n_back int;
  n_pending int;
  n_active int;
  current_status text;
  next_status text;
  has_open boolean;
begin
  if p_order_id is null then
    return;
  end if;

  select status into current_status
  from public.customer_orders
  where id = p_order_id;
  if not found then
    return;
  end if;

  select
    count(*),
    count(*) filter (where cop.status = 'canceled'),
    count(*) filter (where cop.status = 'complete'),
    count(*) filter (where cop.status = 'short_shipped'),
    count(*) filter (where cop.status = 'back_order'),
    count(*) filter (where cop.status = 'pending')
  into n, n_cancel, n_complete, n_short, n_back, n_pending
  from public.customer_order_products cop
  join public.products p on p.id = cop.product_id
  where cop.customer_order_id = p_order_id
    and p.type = 1;

  -- An order with no merchandise keeps its header.
  next_status := current_status;

  if coalesce(n, 0) > 0 then
    n_active := n_pending + n_back;
    if n_cancel = n then
      next_status := 'canceled';
    elsif n_complete + n_cancel = n and n_complete > 0 then
      next_status := 'complete';
    elsif n_active = 0 and n_short > 0 then
      next_status := 'short_shipped';
    elsif n_back > 0 then
      next_status := 'back_order';
    elsif n_pending > 0 and (n_short > 0 or n_complete > 0) then
      next_status := 'back_order';
    elsif n_pending + n_cancel = n and n_pending > 0 then
      if current_status in ('pending', 'approved', 'picking') then
        next_status := current_status;
      else
        next_status := 'pending';
      end if;
    end if;
  end if;

  select exists (
    select 1
    from public.customer_shipment_products sp
    join public.customer_shipments s on s.id = sp.customer_shipment_id
    where sp.customer_order_id = p_order_id
      and s.status not in ('shipped', 'canceled')
  )
  into has_open;

  if has_open then
    if next_status in ('approved', 'back_order') then
      next_status := 'picking';
    end if;
  elsif next_status = 'picking' then
    next_status := 'approved';
  end if;

  if next_status is distinct from current_status then
    perform set_config('app.order_status_sync', '1', true);
    update public.customer_orders
    set status = next_status, updated_at = now()
    where id = p_order_id;
    perform set_config('app.order_status_sync', '', true);
  end if;
end;
$$;

revoke all on function public.customer_order_sync_status(uuid) from public, anon, authenticated;

-- The line rollup trigger (customer_order_products_rollup) now goes through the same function.
create or replace function public.customer_order_rollup_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.customer_order_sync_status(
    coalesce(new.customer_order_id, old.customer_order_id)
  );
  return null;
end;
$$;

-- A line joins or leaves a shipment. Deleting a shipment removes its lines, so that lands here too.
create or replace function public.customer_shipment_products_sync_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' and old.customer_order_id is not null then
    perform public.customer_order_sync_status(old.customer_order_id);
  end if;
  if tg_op <> 'DELETE' and new.customer_order_id is not null then
    if tg_op = 'INSERT' or new.customer_order_id is distinct from old.customer_order_id then
      perform public.customer_order_sync_status(new.customer_order_id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists customer_shipment_products_sync_orders on public.customer_shipment_products;
create trigger customer_shipment_products_sync_orders
  after insert or delete or update of customer_order_id on public.customer_shipment_products
  for each row
  execute function public.customer_shipment_products_sync_orders();

-- A shipment is shipped or canceled.
create or replace function public.customer_shipments_sync_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  for rec in
    select distinct sp.customer_order_id
    from public.customer_shipment_products sp
    where sp.customer_shipment_id = new.id
      and sp.customer_order_id is not null
  loop
    perform public.customer_order_sync_status(rec.customer_order_id);
  end loop;
  return null;
end;
$$;

drop trigger if exists customer_shipments_sync_orders on public.customer_shipments;
create trigger customer_shipments_sync_orders
  after update of status on public.customer_shipments
  for each row
  when (old.status is distinct from new.status)
  execute function public.customer_shipments_sync_orders();

-- Picking is not set by hand, and a picking order is not moved by hand.
-- The sales rep rules from 0068 are unchanged.
create or replace function public.customer_orders_approval_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('app.order_status_sync', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'picking' then
      raise exception 'Picking is set by an open shipment';
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'picking' then
      raise exception 'Picking is set by an open shipment';
    end if;
    if old.status = 'picking' then
      raise exception 'This order is on an open shipment';
    end if;
  end if;

  if public.current_role() = 'sales_rep' then
    if tg_op = 'INSERT' then
      if new.status in ('approved', 'picking') then
        raise exception 'A sales rep cannot approve an order';
      end if;
    elsif new.status is distinct from old.status then
      if new.status in ('approved', 'picking') then
        raise exception 'A sales rep cannot approve an order';
      end if;
      if old.status in ('approved', 'picking') and new.status = 'pending' then
        raise exception 'A sales rep cannot revoke an approval';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Orders as they are now: on an open shipment turns to picking, and picking that was
-- set by hand with no open shipment goes back to approved.
do $$
declare
  rec record;
begin
  for rec in
    select o.id
    from public.customer_orders o
    where o.status = 'picking'
       or exists (
         select 1
         from public.customer_shipment_products sp
         join public.customer_shipments s on s.id = sp.customer_shipment_id
         where sp.customer_order_id = o.id
           and s.status not in ('shipped', 'canceled')
       )
  loop
    perform public.customer_order_sync_status(rec.id);
  end loop;
end;
$$;

notify pgrst, 'reload schema';
