-- Merchandise product.name is computed:
--   lots.article = models.name  →  lots.lot_no
--   otherwise                   →  lots.lot_no || '>' || models.name
-- Surcharge/freight keep the user-entered name.
-- Name is globally unique and indexed.

create or replace function public.compute_merchandise_product_name(p_lot_id uuid, p_model_id uuid)
returns text
language sql
stable
as $$
  select case
    when upper(btrim(coalesce(l.article, ''))) = upper(btrim(m.name)) then l.lot_no
    else l.lot_no || '>' || m.name
  end
  from public.lots l
  join public.models m on m.id = p_model_id
  where l.id = p_lot_id
$$;

create or replace function public.products_assign_merchandise_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 1 then
    new.name := public.compute_merchandise_product_name(new.lot_id, new.model_id);
  else
    new.name := nullif(btrim(coalesce(new.name, '')), '');
  end if;
  return new;
end;
$$;

drop trigger if exists products_assign_merchandise_name on public.products;
create trigger products_assign_merchandise_name
  before insert or update of type, lot_id, model_id, name
  on public.products
  for each row execute function public.products_assign_merchandise_name();

create or replace function public.products_refresh_names_from_lot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set lot_id = lot_id
  where type = 1 and lot_id = new.id;
  return new;
end;
$$;

drop trigger if exists lots_refresh_product_names on public.lots;
create trigger lots_refresh_product_names
  after update of lot_no, article
  on public.lots
  for each row execute function public.products_refresh_names_from_lot();

create or replace function public.products_refresh_names_from_model()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set model_id = model_id
  where type = 1 and model_id = new.id;
  return new;
end;
$$;

drop trigger if exists models_refresh_product_names on public.models;
create trigger models_refresh_product_names
  after update of name
  on public.models
  for each row execute function public.products_refresh_names_from_model();

update public.products
set lot_id = lot_id
where type = 1;

create unique index if not exists products_name_key on public.products (name);

alter table public.products alter column name set not null;
