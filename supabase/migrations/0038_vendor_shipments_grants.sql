grant select, insert, update, delete on public.vendor_shipments to authenticated;
grant select, insert, update, delete on public.vendor_shipment_products to authenticated;
grant select, insert, update, delete on public.vendor_shipment_cells to authenticated;

do $$
declare
  seq text;
begin
  select pg_get_serial_sequence('public.vendor_shipments', 'shipment_num') into seq;
  if seq is not null then
    execute format('grant usage, select on sequence %s to authenticated', seq);
  end if;
end $$;
