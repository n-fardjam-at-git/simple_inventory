-- Soft-delete / discontinue flag for master data. Existing rows stay active.

alter table public.products add column if not exists is_active boolean not null default true;
alter table public.customers add column if not exists is_active boolean not null default true;
alter table public.models add column if not exists is_active boolean not null default true;
alter table public.lots add column if not exists is_active boolean not null default true;
alter table public.brands add column if not exists is_active boolean not null default true;
alter table public.items add column if not exists is_active boolean not null default true;
alter table public.vendors add column if not exists is_active boolean not null default true;

create index if not exists products_is_active_idx on public.products (is_active);
create index if not exists customers_is_active_idx on public.customers (is_active);
create index if not exists models_is_active_idx on public.models (is_active);
create index if not exists lots_is_active_idx on public.lots (is_active);
create index if not exists brands_is_active_idx on public.brands (is_active);
create index if not exists items_is_active_idx on public.items (is_active);
create index if not exists vendors_is_active_idx on public.vendors (is_active);
