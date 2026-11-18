alter table public.customer_order_requests
  add column if not exists staff_reply text;

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
    else
      new.staff_reply := old.staff_reply;
    end if;
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

create or replace function public.set_order_request_staff_reply(p_request_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'not allowed';
  end if;
  if not public.request_visible(p_request_id) then
    raise exception 'not allowed';
  end if;

  update public.customer_order_requests
  set staff_reply = nullif(btrim(p_reply), '')
  where id = p_request_id;

  if not found then
    raise exception 'order not found';
  end if;
end;
$$;

revoke all on function public.set_order_request_staff_reply(uuid, text) from public;
grant execute on function public.set_order_request_staff_reply(uuid, text) to authenticated;

notify pgrst, 'reload schema';
