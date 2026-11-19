create or replace function public.customer_order_requests_online()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_role() = 'customer' and new.transmission_method_id is null then
    select m.id, m.name
      into new.transmission_method_id, new.transmission_method
    from public.transmission_methods m
    where m.name = 'Online by customer';
  end if;
  return new;
end;
$$;

drop trigger if exists customer_order_requests_online on public.customer_order_requests;
create trigger customer_order_requests_online
  before insert on public.customer_order_requests
  for each row
  execute function public.customer_order_requests_online();

alter table public.customer_order_requests disable trigger customer_order_requests_guard;

update public.customer_order_requests r
set
  transmission_method_id = m.id,
  transmission_method = m.name
from public.transmission_methods m
where m.name = 'Online by customer'
  and r.transmission_method_id is null
  and (r.transmission_method is null or r.transmission_method = 'Online by customer');

alter table public.customer_order_requests enable trigger customer_order_requests_guard;

notify pgrst, 'reload schema';
