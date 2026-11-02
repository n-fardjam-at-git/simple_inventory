alter table public.customer_addresses
  rename column label to location_name;

update public.import_templates
set mappings = (
  select coalesce(
    jsonb_agg(
      case
        when elem->>'dest_field' = 'label'
          then jsonb_set(elem, '{dest_field}', '"location_name"')
        else elem
      end
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(mappings) as elem
)
where target = 'customer_addresses'
  and jsonb_typeof(mappings) = 'array';
