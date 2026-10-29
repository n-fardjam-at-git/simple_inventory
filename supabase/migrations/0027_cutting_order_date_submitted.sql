alter table public.cutting_orders
  add column if not exists date_submitted date;

update public.cutting_orders
set date_submitted = current_date - (1 + floor(random() * 21))::int
where date_submitted is null;
