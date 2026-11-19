create or replace function public.set_order_request_handling(
  p_request_id uuid,
  p_terms text,
  p_shipment_method_id uuid,
  p_sales_rep_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.customer_order_requests;
  ship text;
  chosen_terms text;
begin
  if not public.is_staff() then
    raise exception 'not allowed';
  end if;
  if not public.request_visible(p_request_id) then
    raise exception 'not allowed';
  end if;

  select * into req from public.customer_order_requests where id = p_request_id;
  if not found then
    raise exception 'order not found';
  end if;
  if req.status = 'accepted' then
    raise exception 'That order can no longer be changed';
  end if;

  ship := null;
  if p_shipment_method_id is not null then
    select case
      when m.shipper is null or btrim(m.shipper) = '' then m.method
      else m.shipper || ' · ' || m.method
    end
    into ship
    from public.shipment_methods m
    where m.id = p_shipment_method_id
      and (m.is_active or m.id = req.shipment_method_id);
    if ship is null then
      raise exception 'Pick a shipping method.';
    end if;
  end if;

  if p_sales_rep_id is not null and not exists (
    select 1
    from public.profiles p
    where p.id = p_sales_rep_id
      and (p.role = 'sales_rep' or p.id = req.sales_rep_id)
  ) then
    raise exception 'Pick a sales rep.';
  end if;

  chosen_terms := nullif(btrim(p_terms), '');
  if chosen_terms is not null
     and chosen_terms is distinct from req.terms
     and not exists (select 1 from public.payment_terms t where t.term = chosen_terms) then
    raise exception 'Pick a term.';
  end if;

  update public.customer_order_requests
  set
    terms = chosen_terms,
    shipment_method_id = p_shipment_method_id,
    shipping_method = ship,
    sales_rep_id = p_sales_rep_id
  where id = p_request_id;
end;
$$;

revoke all on function public.set_order_request_handling(uuid, text, uuid, uuid) from public;
grant execute on function public.set_order_request_handling(uuid, text, uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
