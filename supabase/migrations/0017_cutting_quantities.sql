create table if not exists public.cutting_quantities (
  id uuid primary key default gen_random_uuid(),
  cutting_order_id uuid not null,
  product_id uuid not null,
  size_id uuid not null references public.size_chart_sizes(id),
  drop_id uuid not null references public.size_chart_drops(id),
  qty_ordered int not null default 0 check (qty_ordered >= 0),
  qty_received int not null default 0 check (qty_received >= 0),
  unique (cutting_order_id, product_id, size_id, drop_id),
  foreign key (cutting_order_id, product_id)
    references public.cutting_order_products (cutting_order_id, product_id)
    on delete cascade
);

create index if not exists cutting_quantities_line_idx
  on public.cutting_quantities (cutting_order_id, product_id);

alter table public.cutting_quantities enable row level security;

drop policy if exists cq_all on public.cutting_quantities;
create policy cq_all on public.cutting_quantities
  for all to authenticated
  using (public.is_admin() or public.is_warehouse())
  with check (public.is_admin() or public.is_warehouse());
