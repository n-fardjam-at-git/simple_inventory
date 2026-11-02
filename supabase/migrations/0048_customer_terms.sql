create table public.payment_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  description text,
  days_due integer check (days_due is null or days_due >= 0)
);

insert into public.payment_terms (term, days_due) values
  ('Net 30', 30),
  ('Net 60', 60),
  ('COD', 0),
  ('Prepaid', 0);

alter table public.customers
  add column business_name text,
  add column payment_term_id uuid references public.payment_terms(id),
  add column do_not_ship boolean not null default false,
  add column notes text;

update public.customers
set business_name = company_name
where business_name is null;

alter table public.customers
  alter column business_name set not null;

create or replace function public.customers_business_name()
returns trigger
language plpgsql
as $$
begin
  if new.business_name is null or btrim(new.business_name) = '' then
    new.business_name := new.company_name;
  else
    new.business_name := btrim(new.business_name);
  end if;
  return new;
end;
$$;

create trigger customers_business_name
before insert or update of company_name, business_name on public.customers
for each row execute function public.customers_business_name();

alter table public.payment_terms enable row level security;

create policy payment_terms_read on public.payment_terms
  for select to authenticated
  using (public.is_staff());

create policy payment_terms_write on public.payment_terms
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.payment_terms to authenticated;
