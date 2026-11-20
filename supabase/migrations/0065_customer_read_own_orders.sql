create or replace function public.customer_owns_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.customer_orders o
    where o.id = p_order_id
      and public.current_role() = 'customer'
      and o.customer_id = public.current_customer_id()
  );
$$;

revoke all on function public.customer_owns_order(uuid) from public;
grant execute on function public.customer_owns_order(uuid) to authenticated;

create policy customer_orders_own_read on public.customer_orders
  for select to authenticated
  using (public.customer_owns_order(id));

create policy customer_order_products_own_read on public.customer_order_products
  for select to authenticated
  using (public.customer_owns_order(customer_order_id));

create policy customer_order_cells_own_read on public.customer_order_cells
  for select to authenticated
  using (public.customer_owns_order(customer_order_id));

create policy read_products_on_own_order on public.products
  for select to authenticated
  using (
    exists (
      select 1
      from public.customer_order_products p
      where p.product_id = products.id
        and public.customer_owns_order(p.customer_order_id)
    )
  );

create policy profiles_own_order_rep on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.customer_orders o
      where o.sales_rep_id = profiles.id
        and public.customer_owns_order(o.id)
    )
  );

notify pgrst, 'reload schema';
