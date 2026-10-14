-- Price stage: 1 Line, 2 Promo, 3 Close-out. Default Line.

alter table public.products
  add column if not exists price_stage smallint not null default 1;

alter table public.products drop constraint if exists products_price_stage_check;
alter table public.products
  add constraint products_price_stage_check check (price_stage in (1, 2, 3));
