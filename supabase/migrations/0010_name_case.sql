-- Brands and model names uppercase; other stored names sentence case.
-- Does not change lot numbers, size/drop codes, emails, or account numbers.

create or replace function public._sentence_case(t text)
returns text
language sql
immutable
as $$
  select case
    when t is null or btrim(t) = '' then t
    else upper(left(lower(btrim(t)), 1)) || substr(lower(btrim(t)), 2)
  end
$$;

update public.brands set name = upper(btrim(name)) where name is not null;

update public.items set name = public._sentence_case(name);
update public.models set name = upper(btrim(name)) where name is not null;
update public.size_charts set name = public._sentence_case(name);
update public.colors set name = public._sentence_case(name);
update public.patterns set name = public._sentence_case(name);
update public.contents set name = public._sentence_case(name);
update public.vendors set
  name = public._sentence_case(name),
  notes = public._sentence_case(notes);
update public.customers set company_name = public._sentence_case(company_name);
update public.customer_addresses set label = public._sentence_case(label);
update public.products set name = public._sentence_case(name) where name is not null;

drop function public._sentence_case(text);
