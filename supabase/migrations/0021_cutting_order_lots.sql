create table if not exists public.cutting_order_lots (
  cutting_order_id uuid not null references public.cutting_orders(id) on delete cascade,
  lot_id uuid not null references public.lots(id) on delete restrict,
  primary key (cutting_order_id, lot_id)
);

create index if not exists cutting_order_lots_lot_id_idx on public.cutting_order_lots (lot_id);

insert into public.cutting_order_lots (cutting_order_id, lot_id)
select distinct cop.cutting_order_id, p.lot_id
from public.cutting_order_products cop
join public.products p on p.id = cop.product_id
where p.lot_id is not null
on conflict do nothing;

alter table public.cutting_order_lots enable row level security;

drop policy if exists col_all on public.cutting_order_lots;
create policy col_all on public.cutting_order_lots
  for all to authenticated
  using (public.is_admin() or public.is_warehouse())
  with check (public.is_admin() or public.is_warehouse());

create or replace function public.cutting_order_lots_brand_match()
returns trigger
language plpgsql
as $$
declare
  order_brand uuid;
  lot_brand uuid;
begin
  select brand_id into order_brand from public.cutting_orders where id = new.cutting_order_id;
  select brand_id into lot_brand from public.lots where id = new.lot_id;
  if order_brand is null or lot_brand is distinct from order_brand then
    raise exception 'Lot brand does not match this order.';
  end if;
  return new;
end;
$$;

drop trigger if exists cutting_order_lots_brand_match on public.cutting_order_lots;
create trigger cutting_order_lots_brand_match
  before insert or update of lot_id, cutting_order_id on public.cutting_order_lots
  for each row
  execute function public.cutting_order_lots_brand_match();

create or replace function public.cutting_order_products_lot_on_order()
returns trigger
language plpgsql
as $$
declare
  lid uuid;
begin
  select lot_id into lid from public.products where id = new.product_id;
  if lid is null or not exists (
    select 1
    from public.cutting_order_lots
    where cutting_order_id = new.cutting_order_id
      and lot_id = lid
  ) then
    raise exception 'Lot must be on this cutting order before adding a product.';
  end if;
  return new;
end;
$$;

drop trigger if exists cutting_order_products_lot_on_order on public.cutting_order_products;
create trigger cutting_order_products_lot_on_order
  before insert or update of product_id, cutting_order_id on public.cutting_order_products
  for each row
  execute function public.cutting_order_products_lot_on_order();

create or replace function public.cutting_order_lots_delete_guard()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.cutting_order_products cop
    join public.products p on p.id = cop.product_id
    where cop.cutting_order_id = old.cutting_order_id
      and p.lot_id = old.lot_id
  ) then
    raise exception 'Remove this lot''s products from the order first.';
  end if;
  return old;
end;
$$;

drop trigger if exists cutting_order_lots_delete_guard on public.cutting_order_lots;
create trigger cutting_order_lots_delete_guard
  before delete on public.cutting_order_lots
  for each row
  execute function public.cutting_order_lots_delete_guard();

create or replace function public.cutting_orders_brand_lock()
returns trigger
language plpgsql
as $$
begin
  if new.brand_id is distinct from old.brand_id
     and (
       exists (
         select 1 from public.cutting_order_lots where cutting_order_id = old.id
       )
       or exists (
         select 1 from public.cutting_order_products where cutting_order_id = old.id
       )
     ) then
    raise exception 'Brand cannot be changed while lots or products are on this order.';
  end if;
  return new;
end;
$$;
