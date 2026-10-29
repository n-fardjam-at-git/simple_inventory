create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  src_path text not null,
  thumb_path text,
  sort_order integer not null default 0,
  unique (product_id, src_path),
  check (
    src_path like '/%'
    and src_path not like '%..%'
    and char_length(src_path) <= 500
  ),
  check (
    thumb_path is null
    or (
      thumb_path like '/%'
      and thumb_path not like '%..%'
      and char_length(thumb_path) <= 500
    )
  )
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

alter table public.product_images enable row level security;

create policy read_product_images on public.product_images
  for select to authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_id
        and (public.is_staff() or p.published = true)
    )
  );

create policy write_product_images on public.product_images
  for all to authenticated
  using (public.is_admin())
  with check (
    public.is_admin()
    and exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.type = 1
    )
  );

grant select, insert, update, delete on public.product_images to authenticated;
