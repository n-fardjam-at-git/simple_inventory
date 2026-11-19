drop policy if exists corp_staff_write on public.customer_order_request_products;
create policy corp_staff_write on public.customer_order_request_products
  for all to authenticated
  using (
    public.is_staff()
    and public.request_visible(request_id)
    and exists (
      select 1
      from public.customer_order_requests r
      where r.id = request_id
        and r.status <> 'accepted'
    )
  )
  with check (
    public.is_staff()
    and public.request_visible(request_id)
    and exists (
      select 1
      from public.customer_order_requests r
      where r.id = request_id
        and r.status <> 'accepted'
    )
  );

drop policy if exists corc_staff_write on public.customer_order_request_cells;
create policy corc_staff_write on public.customer_order_request_cells
  for all to authenticated
  using (
    public.is_staff()
    and public.request_visible(request_id)
    and exists (
      select 1
      from public.customer_order_requests r
      where r.id = request_id
        and r.status <> 'accepted'
    )
  )
  with check (
    public.is_staff()
    and public.request_visible(request_id)
    and exists (
      select 1
      from public.customer_order_requests r
      where r.id = request_id
        and r.status <> 'accepted'
    )
  );

notify pgrst, 'reload schema';
