alter table public.cutting_orders
  add column if not exists brand_id uuid references public.brands(id);

insert into public.brands (name)
values ('MANTONI')
on conflict (name) do nothing;

update public.cutting_orders
set brand_id = (select id from public.brands where name = 'MANTONI' limit 1)
where brand_id is null;

alter table public.cutting_orders
  alter column brand_id set not null;

create index if not exists cutting_orders_brand_id_idx on public.cutting_orders (brand_id);

create or replace function public.cutting_orders_brand_lock()
returns trigger
language plpgsql
as $$
begin
  if new.brand_id is distinct from old.brand_id
     and exists (
       select 1
       from public.cutting_order_products
       where cutting_order_id = old.id
     ) then
    raise exception 'Brand cannot be changed while products are on this order.';
  end if;
  return new;
end;
$$;

drop trigger if exists cutting_orders_brand_lock on public.cutting_orders;
create trigger cutting_orders_brand_lock
  before update of brand_id on public.cutting_orders
  for each row
  execute function public.cutting_orders_brand_lock();
