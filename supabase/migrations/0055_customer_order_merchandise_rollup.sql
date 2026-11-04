-- Order header status follows merchandise lines only (products.type = 1).
-- Freight and surcharge stay on the order and keep their own line status.

create or replace function public.customer_order_rollup_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  oid uuid;
  n int;
  n_cancel int;
  n_complete int;
  n_short int;
  n_back int;
  n_pending int;
  n_active int;
  current_status text;
  next_status text;
begin
  oid := coalesce(new.customer_order_id, old.customer_order_id);

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
  where cop.customer_order_id = oid
    and p.type = 1;

  if coalesce(n, 0) = 0 then
    return null;
  end if;

  n_active := n_pending + n_back;
  select status into current_status from public.customer_orders where id = oid;

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
  else
    next_status := current_status;
  end if;

  if next_status is distinct from current_status then
    update public.customer_orders
    set status = next_status, updated_at = now()
    where id = oid;
  end if;
  return null;
end;
$$;

-- Recompute orders that already have garments. A charge-only order whose
-- header was set by the old rollup returns to pending.
update public.customer_order_products cop
set status = cop.status
from public.products p
where p.id = cop.product_id
  and p.type = 1;

update public.customer_orders o
set status = 'pending', updated_at = now()
where o.status not in ('pending', 'approved', 'picking')
  and not exists (
    select 1
    from public.customer_order_products cop
    join public.products p on p.id = cop.product_id
    where cop.customer_order_id = o.id
      and p.type = 1
  );
