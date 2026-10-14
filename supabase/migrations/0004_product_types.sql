-- Product types: 1 merchandise, 2 surcharge, 3 freight (sort order for shipment reports).
-- Existing rows stay merchandise. Surcharge/freight use name; lot/model/chart optional.

alter table public.products
  add column if not exists type smallint not null default 1;

alter table public.products
  add column if not exists name text;

alter table public.products
  alter column lot_id drop not null;

alter table public.products
  alter column model_id drop not null;

alter table public.products
  alter column size_chart_id drop not null;

alter table public.products drop constraint if exists products_type_check;
alter table public.products
  add constraint products_type_check check (type in (1, 2, 3));

alter table public.products drop constraint if exists products_type_shape;
alter table public.products
  add constraint products_type_shape check (
    (type = 1 and lot_id is not null and model_id is not null and size_chart_id is not null)
    or (type in (2, 3) and name is not null and length(btrim(name)) > 0)
  );

create unique index if not exists products_one_freight
  on public.products (type)
  where type = 3;

alter table public.customer_shipment_products
  add column if not exists qty int not null default 0;

comment on column public.products.type is '1 merchandise, 2 surcharge, 3 freight';
comment on column public.customer_shipment_products.qty is 'Used for surcharge (any qty) and freight (always 1). Merchandise uses size×drop cells.';
