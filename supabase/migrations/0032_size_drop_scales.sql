create table if not exists public.size_drop_scales (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand_id uuid not null references public.brands (id),
  item_id uuid not null references public.items (id),
  size_chart_id uuid not null references public.size_charts (id),
  last_updated date not null default current_date,
  unique (brand_id, name)
);

create table if not exists public.size_drop_scale_cells (
  scale_id uuid not null references public.size_drop_scales (id) on delete cascade,
  size_id uuid not null references public.size_chart_sizes (id),
  drop_id uuid not null references public.size_chart_drops (id),
  percent numeric(8, 4) not null check (percent >= 0),
  primary key (scale_id, size_id, drop_id)
);

create or replace function public.size_drop_scale_cell_chart()
returns trigger
language plpgsql
as $$
declare
  chart uuid;
  sz_chart uuid;
  dr_chart uuid;
begin
  select size_chart_id into chart from public.size_drop_scales where id = new.scale_id;
  select chart_id into sz_chart from public.size_chart_sizes where id = new.size_id;
  select chart_id into dr_chart from public.size_chart_drops where id = new.drop_id;
  if sz_chart is distinct from chart or dr_chart is distinct from chart then
    raise exception 'Size and drop must belong to the scale chart';
  end if;
  return new;
end;
$$;

drop trigger if exists size_drop_scale_cell_chart on public.size_drop_scale_cells;
create trigger size_drop_scale_cell_chart
  before insert or update of scale_id, size_id, drop_id on public.size_drop_scale_cells
  for each row
  execute function public.size_drop_scale_cell_chart();

alter table public.size_drop_scales enable row level security;
alter table public.size_drop_scale_cells enable row level security;

drop policy if exists sds_read on public.size_drop_scales;
create policy sds_read on public.size_drop_scales
  for select to authenticated
  using (true);

drop policy if exists sds_write on public.size_drop_scales;
create policy sds_write on public.size_drop_scales
  for all to authenticated
  using (public.is_admin() or public.is_warehouse())
  with check (public.is_admin() or public.is_warehouse());

drop policy if exists sdsc_read on public.size_drop_scale_cells;
create policy sdsc_read on public.size_drop_scale_cells
  for select to authenticated
  using (true);

drop policy if exists sdsc_write on public.size_drop_scale_cells;
create policy sdsc_write on public.size_drop_scale_cells
  for all to authenticated
  using (public.is_admin() or public.is_warehouse())
  with check (public.is_admin() or public.is_warehouse());
