-- Models are not tied to brands (brand stays on lots only).
alter table public.models drop column if exists brand_id;
