create or replace function public.sales_rep_services(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'sales_rep'
    and exists (
      select 1
      from public.customers c
      where c.id = p_customer_id
        and c.sales_rep_id = auth.uid()
    );
$$;

create or replace function public.customer_order_staff_visible(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or public.is_warehouse()
    or exists (
      select 1
      from public.customer_orders o
      where o.id = p_order_id
        and public.sales_rep_services(o.customer_id)
    );
$$;

revoke all on function public.sales_rep_services(uuid) from public;
revoke all on function public.customer_order_staff_visible(uuid) from public;
grant execute on function public.sales_rep_services(uuid) to authenticated;
grant execute on function public.customer_order_staff_visible(uuid) to authenticated;

drop policy if exists customer_orders_staff on public.customer_orders;
create policy customer_orders_staff on public.customer_orders
  for all to authenticated
  using (
    public.is_admin()
    or public.is_warehouse()
    or public.sales_rep_services(customer_orders.customer_id)
  )
  with check (
    public.is_admin()
    or public.is_warehouse()
    or public.sales_rep_services(customer_orders.customer_id)
  );

drop policy if exists customer_order_products_staff on public.customer_order_products;
create policy customer_order_products_staff on public.customer_order_products
  for all to authenticated
  using (public.customer_order_staff_visible(customer_order_id))
  with check (public.customer_order_staff_visible(customer_order_id));

drop policy if exists customer_order_cells_staff on public.customer_order_cells;
create policy customer_order_cells_staff on public.customer_order_cells
  for all to authenticated
  using (public.customer_order_staff_visible(customer_order_id))
  with check (public.customer_order_staff_visible(customer_order_id));

create or replace function public.customer_orders_approval_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists customer_orders_approval_guard on public.customer_orders;
create trigger customer_orders_approval_guard
  before insert or update on public.customer_orders
  for each row
  execute function public.customer_orders_approval_guard();

notify pgrst, 'reload schema';
