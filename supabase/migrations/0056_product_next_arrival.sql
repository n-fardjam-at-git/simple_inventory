create or replace function public.product_next_arrival(p_product_id uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select min(co.arrival_date)
  from public.cutting_orders co
  join public.cutting_order_products cop on cop.cutting_order_id = co.id
  where public.is_staff()
    and cop.product_id = p_product_id
    and co.status
    and cop.status
    and co.date_submitted is not null
    and co.arrival_date >= current_date;
$$;

revoke all on function public.product_next_arrival(uuid) from public;
grant execute on function public.product_next_arrival(uuid) to authenticated;

notify pgrst, 'reload schema';
