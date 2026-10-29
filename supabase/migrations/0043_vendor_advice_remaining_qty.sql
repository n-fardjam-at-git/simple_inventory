-- Vendor can read remaining qty on their own cuttings, so an advice line
-- can be seeded the same way as a vendor shipment. Run in the SQL editor.

create policy cq_vendor_read on public.cutting_quantities
  for select to authenticated
  using (
    exists (
      select 1
      from public.cutting_orders co
      where co.id = cutting_order_id
        and co.vendor_id = public.current_vendor_id()
    )
  );
