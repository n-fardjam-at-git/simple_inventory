-- Deleting a product must not delete its lot (or model / size chart).
alter table public.products drop constraint if exists products_lot_id_fkey;
alter table public.products
  add constraint products_lot_id_fkey
  foreign key (lot_id) references public.lots(id) on delete restrict;

alter table public.products drop constraint if exists products_model_id_fkey;
alter table public.products
  add constraint products_model_id_fkey
  foreign key (model_id) references public.models(id) on delete restrict;

alter table public.products drop constraint if exists products_size_chart_id_fkey;
alter table public.products
  add constraint products_size_chart_id_fkey
  foreign key (size_chart_id) references public.size_charts(id) on delete restrict;
