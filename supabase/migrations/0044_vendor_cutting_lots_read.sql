-- Vendor can read lots on cuttings that were submitted to their factory,
-- so the cutting-order print report can group by article. Run in the SQL editor.

create policy col_vendor_read on public.cutting_order_lots
  for select to authenticated
  using (
    exists (
      select 1
      from public.cutting_orders co
      where co.id = cutting_order_id
        and co.vendor_id = public.current_vendor_id()
        and co.date_submitted is not null
    )
  );
