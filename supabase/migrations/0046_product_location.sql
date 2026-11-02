alter table public.products
  add column location text;

alter table public.products
  add constraint products_location_len
  check (location is null or char_length(btrim(location)) <= 200);

-- Sample aisle for merchandise that does not have one yet.
with numbered as (
  select id, row_number() over (order by name nulls last, id) as n
  from public.products
  where type = 1
    and location is null
)
update public.products p
set location = 'Aisle ' || (((n.n - 1) % 6) + 1)::text
from numbered n
where p.id = n.id;

create or replace function public.set_product_location(p_product_id uuid, p_location text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text;
begin
  if not public.is_warehouse() then
    raise exception 'not allowed';
  end if;
  cleaned := nullif(btrim(p_location), '');
  if cleaned is not null and char_length(cleaned) > 200 then
    raise exception 'location is too long';
  end if;
  update public.products
  set location = cleaned
  where id = p_product_id
    and type = 1;
  if not found then
    raise exception 'product not found';
  end if;
end;
$$;

revoke all on function public.set_product_location(uuid, text) from public;
grant execute on function public.set_product_location(uuid, text) to authenticated;
