alter table public.size_drop_scales
  drop constraint if exists size_drop_scales_brand_id_item_id_name_key;

alter table public.size_drop_scales
  drop constraint if exists size_drop_scales_brand_id_name_key;

alter table public.size_drop_scales
  add constraint size_drop_scales_brand_id_name_key unique (brand_id, name);
