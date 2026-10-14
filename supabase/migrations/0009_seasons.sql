-- Seasons lookup. Instock is not a seasons row.
-- products.availability is text: NULL (unset), 'Instock', or seasons.season.

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  start_season smallint not null check (start_season in (1, 2, 3, 4)),
  is_combo boolean not null default false,
  season text generated always as (
    case
      when is_combo and start_season = 1 then 'Spring/Summer ' || year::text
      when is_combo and start_season = 3 then 'Fall/Winter ' || year::text
      when start_season = 1 then 'Spring ' || year::text
      when start_season = 2 then 'Summer ' || year::text
      when start_season = 3 then 'Fall ' || year::text
      when start_season = 4 then 'Winter ' || year::text
      else null
    end
  ) stored,
  check (not is_combo or start_season in (1, 3)),
  unique (year, start_season, is_combo),
  unique (season)
);

alter table public.seasons add column if not exists season text generated always as (
  case
    when is_combo and start_season = 1 then 'Spring/Summer ' || year::text
    when is_combo and start_season = 3 then 'Fall/Winter ' || year::text
    when start_season = 1 then 'Spring ' || year::text
    when start_season = 2 then 'Summer ' || year::text
    when start_season = 3 then 'Fall ' || year::text
    when start_season = 4 then 'Winter ' || year::text
    else null
  end
) stored;

create unique index if not exists seasons_season_key on public.seasons (season);

alter table public.products drop constraint if exists products_availability_season_check;
alter table public.products drop constraint if exists products_availability_check;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products'
      and column_name = 'availability' and data_type = 'smallint'
  ) then
    alter table public.products add column if not exists availability_new text;
    update public.products
      set availability_new = 'Instock'
      where availability = 1;
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'products' and column_name = 'season_id'
    ) then
      update public.products p
        set availability_new = s.season
        from public.seasons s
        where s.id = p.season_id and p.availability = 2;
    end if;
    alter table public.products drop column availability;
    alter table public.products rename column availability_new to availability;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'availability'
  ) then
    alter table public.products add column availability text;
  end if;
end $$;

alter table public.products drop constraint if exists products_season_id_fkey;
alter table public.products drop column if exists season_id;

alter table public.seasons enable row level security;
drop policy if exists read_seasons on public.seasons;
create policy read_seasons on public.seasons for select to authenticated using (true);
drop policy if exists write_seasons on public.seasons;
create policy write_seasons on public.seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
