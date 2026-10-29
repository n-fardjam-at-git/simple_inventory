alter table public.size_drop_scales
  add column if not exists last_updated date not null default current_date;

create or replace function public.size_drop_scales_set_last_updated()
returns trigger
language plpgsql
as $$
begin
  new.last_updated := current_date;
  return new;
end;
$$;

drop trigger if exists size_drop_scales_set_last_updated on public.size_drop_scales;
create trigger size_drop_scales_set_last_updated
  before update on public.size_drop_scales
  for each row
  execute function public.size_drop_scales_set_last_updated();
