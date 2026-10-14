-- Model names are uppercase (same as brands).
update public.models set name = upper(btrim(name)) where name is not null;
