-- Distinct cutting + product lines on a vendor shipment (no shipment_cuttings table).

create or replace view public.vendor_shipment_cutting_view
with (security_invoker = true) as
select
  vsp.id,
  vsp.shipment_id,
  vsp.cutting_order_id,
  vsp.product_id,
  co.order_num,
  coalesce(nullif(btrim(p.name), ''), 'Product') as product_label
from public.vendor_shipment_products vsp
join public.cutting_orders co on co.id = vsp.cutting_order_id
join public.products p on p.id = vsp.product_id;

grant select on public.vendor_shipment_cutting_view to authenticated;
