-- Article "Alpha" and model "ALPHA" are the same: product name is lot_no only.
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

update public.products
set lot_id = lot_id
where type = 1;
