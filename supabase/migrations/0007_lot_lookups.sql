-- Lot attribute lookups: color (name, not color_num), pattern, content (fiber).

create table if not exists public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table if not exists public.patterns (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

alter table public.lots add column if not exists color_id uuid references public.colors(id);
alter table public.lots add column if not exists pattern_id uuid references public.patterns(id);
alter table public.lots add column if not exists content_id uuid references public.contents(id);

alter table public.colors enable row level security;
alter table public.patterns enable row level security;
alter table public.contents enable row level security;

drop policy if exists read_colors on public.colors;
create policy read_colors on public.colors for select to authenticated using (true);
drop policy if exists write_colors on public.colors;
create policy write_colors on public.colors for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists read_patterns on public.patterns;
create policy read_patterns on public.patterns for select to authenticated using (true);
drop policy if exists write_patterns on public.patterns;
create policy write_patterns on public.patterns for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists read_contents on public.contents;
create policy read_contents on public.contents for select to authenticated using (true);
drop policy if exists write_contents on public.contents;
create policy write_contents on public.contents for all to authenticated using (public.is_admin()) with check (public.is_admin());
