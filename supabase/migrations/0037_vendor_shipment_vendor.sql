alter table public.vendor_shipments
  add column if not exists vendor_id uuid references public.vendors(id);

create index if not exists vendor_shipments_vendor_idx
  on public.vendor_shipments (vendor_id);
