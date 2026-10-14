alter table public.items
  add column in_set boolean not null default false;

create index items_in_set_idx on public.items (in_set);
