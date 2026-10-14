create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

alter table public.products
  add column collection_id uuid references public.collections(id) on delete restrict;

create index products_collection_id_idx on public.products (collection_id);
create index collections_is_active_idx on public.collections (is_active);

alter table public.collections enable row level security;

create policy read_collections on public.collections
  for select to authenticated using (true);
create policy write_collections on public.collections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
