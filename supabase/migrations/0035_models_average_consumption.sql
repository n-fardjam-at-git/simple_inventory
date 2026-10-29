alter table public.models
  add column if not exists average_consumption numeric(12, 2);
