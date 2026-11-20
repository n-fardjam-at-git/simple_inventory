create or replace function public.customer_has_login(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customers c
    where c.id = p_customer_id and c.user_id is not null
  )
  or exists (
    select 1 from public.profiles p
    where p.customer_id = p_customer_id and p.role = 'customer'
  );
$$;

revoke all on function public.customer_has_login(uuid) from public;

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
  elsif public.current_role() = 'sales_rep' then
    if tg_op = 'INSERT' then
      if new.status <> 'draft' then
        raise exception 'Start with a draft';
      end if;
      new.created_by := auth.uid();
    elsif old.status = 'draft' and new.status = 'submitted' then
      if public.customer_has_login(new.customer_id) then
        raise exception 'This customer sends the order from My orders';
      end if;
      new.customer_acceptance := true;
      new.submitted_at := now();
    end if;
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create or replace function public.customer_order_requests_online()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted text;
begin
  wanted := case public.current_role()
    when 'customer' then 'Online by customer'
    when 'sales_rep' then 'Online by sales rep'
  end;
  if wanted is not null and new.transmission_method_id is null then
    select m.id, m.name
      into new.transmission_method_id, new.transmission_method
    from public.transmission_methods m
    where m.name = wanted;
    if not found then
      new.transmission_method := wanted;
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
