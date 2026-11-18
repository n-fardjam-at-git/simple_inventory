create or replace function public.shop_next_cutting(p_product_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with next_cut as (
    select co.id, co.arrival_date
    from public.cutting_orders co
    join public.cutting_order_products cop on cop.cutting_order_id = co.id
    join public.products p on p.id = cop.product_id
    where cop.product_id = p_product_id
      and p.type = 1
      and p.is_active
      and p.published
      and co.status
      and cop.status
      and co.date_submitted is not null
      and co.arrival_date >= current_date
    order by co.arrival_date, co.order_num
    limit 1
  )
  select case
    when n.id is null then null
    else jsonb_build_object(
      'arrives', n.arrival_date,
      'cells', coalesce((
        select jsonb_agg(jsonb_build_object(
          'size_id', cq.size_id,
          'drop_id', cq.drop_id
        ))
        from public.cutting_quantities cq
        where cq.cutting_order_id = n.id
          and cq.product_id = p_product_id
          and cq.qty_ordered > 0
      ), '[]'::jsonb)
    )
  end
  from (select 1) stub
  left join next_cut n on true;
$$;

revoke all on function public.shop_next_cutting(uuid) from public;
grant execute on function public.shop_next_cutting(uuid) to authenticated;

notify pgrst, 'reload schema';
