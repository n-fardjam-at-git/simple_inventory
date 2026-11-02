-- Sample catalog. Run after 0001_init.sql. Does not create Auth users.

insert into public.company_profile (
  id, legal_name, trade_name, address_line1, city, region, postal_code, country
) values (
  '00000000-0000-0000-0000-000000000001',
  'Gruppo Bravo Inc.',
  'Gruppo Bravo',
  '100 Fashion Ave',
  'New York',
  'NY',
  '10018',
  'US'
) on conflict (id) do update set trade_name = excluded.trade_name;

insert into public.size_charts (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Us jacket'),
  ('22222222-2222-2222-2222-222222222222', 'Us dress shirt'),
  ('33333333-3333-3333-3333-333333333333', 'Us trouser')
on conflict do nothing;

insert into public.size_chart_sizes (id, chart_id, code, sort_order) values
  ('11111111-0000-0000-0000-000000000036', '11111111-1111-1111-1111-111111111111', '36', 1),
  ('11111111-0000-0000-0000-000000000038', '11111111-1111-1111-1111-111111111111', '38', 2),
  ('11111111-0000-0000-0000-000000000040', '11111111-1111-1111-1111-111111111111', '40', 3),
  ('11111111-0000-0000-0000-000000000042', '11111111-1111-1111-1111-111111111111', '42', 4),
  ('11111111-0000-0000-0000-000000000044', '11111111-1111-1111-1111-111111111111', '44', 5),
  ('11111111-0000-0000-0000-000000000046', '11111111-1111-1111-1111-111111111111', '46', 6),
  ('11111111-0000-0000-0000-000000000048', '11111111-1111-1111-1111-111111111111', '48', 7),
  ('11111111-0000-0000-0000-000000000050', '11111111-1111-1111-1111-111111111111', '50', 8),
  ('22222222-0000-0000-0000-000000000155', '22222222-2222-2222-2222-222222222222', '15.5', 1),
  ('22222222-0000-0000-0000-000000000160', '22222222-2222-2222-2222-222222222222', '16', 2),
  ('22222222-0000-0000-0000-000000000165', '22222222-2222-2222-2222-222222222222', '16.5', 3),
  ('22222222-0000-0000-0000-000000000170', '22222222-2222-2222-2222-222222222222', '17', 4),
  ('33333333-0000-0000-0000-000000000030', '33333333-3333-3333-3333-333333333333', '30', 1),
  ('33333333-0000-0000-0000-000000000032', '33333333-3333-3333-3333-333333333333', '32', 2),
  ('33333333-0000-0000-0000-000000000034', '33333333-3333-3333-3333-333333333333', '34', 3),
  ('33333333-0000-0000-0000-000000000036', '33333333-3333-3333-3333-333333333333', '36', 4)
on conflict do nothing;

insert into public.size_chart_drops (id, chart_id, code, sort_order) values
  ('11111111-dddd-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Short', 1),
  ('11111111-dddd-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Regular', 2),
  ('11111111-dddd-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Long', 3),
  ('22222222-dddd-0000-0000-000000000032', '22222222-2222-2222-2222-222222222222', '32', 1),
  ('22222222-dddd-0000-0000-000000000033', '22222222-2222-2222-2222-222222222222', '33', 2),
  ('22222222-dddd-0000-0000-000000000034', '22222222-2222-2222-2222-222222222222', '34', 3),
  ('33333333-dddd-0000-0000-000000000030', '33333333-3333-3333-3333-333333333333', '30', 1),
  ('33333333-dddd-0000-0000-000000000032', '33333333-3333-3333-3333-333333333333', '32', 2),
  ('33333333-dddd-0000-0000-000000000034', '33333333-3333-3333-3333-333333333333', '34', 3)
on conflict do nothing;

insert into public.brands (id, name) values
  ('b0000000-0000-0000-0000-000000000001', 'BRAVO UOMO'),
  ('b0000000-0000-0000-0000-000000000002', 'HARBOR & CO'),
  ('b0000000-0000-0000-0000-000000000003', 'MANTONI')
on conflict do nothing;

insert into public.items (id, name, default_size_chart_id) values
  ('i0000000-0000-0000-0000-000000000001', 'Jacket', '11111111-1111-1111-1111-111111111111'),
  ('i0000000-0000-0000-0000-000000000002', 'Shirt', '22222222-2222-2222-2222-222222222222'),
  ('i0000000-0000-0000-0000-000000000003', 'Pants', '33333333-3333-3333-3333-333333333333')
on conflict do nothing;

insert into public.models (id, name, item_id, size_chart_id) values
  ('m0000000-0000-0000-0000-000000000001', 'TB-2B-PEAK', 'i0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('m0000000-0000-0000-0000-000000000002', 'DRESS SHIRT CLASSIC', 'i0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222'),
  ('m0000000-0000-0000-0000-000000000003', 'FLAT FRONT', 'i0000000-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333')
on conflict do nothing;

insert into public.lots (id, lot_no, article, color_num, brand_id) values
  ('l0000000-0000-0000-0000-000000000001', 'M40901-1', 'M40901', '1', 'b0000000-0000-0000-0000-000000000001'),
  ('l0000000-0000-0000-0000-000000000002', 'M40901-2', 'M40901', '2', 'b0000000-0000-0000-0000-000000000001'),
  ('l0000000-0000-0000-0000-000000000003', 'S88012-1', 'S88012', '1', 'b0000000-0000-0000-0000-000000000002')
on conflict do nothing;

-- Fuller jacket (all sizes 36-50)
insert into public.products (id, lot_id, model_id, size_chart_id, standard_price, published) values
  ('p0000000-0000-0000-0000-000000000001', 'l0000000-0000-0000-0000-000000000001', 'm0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 89, true),
  ('p0000000-0000-0000-0000-000000000002', 'l0000000-0000-0000-0000-000000000002', 'm0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 89, true),
  ('p0000000-0000-0000-0000-000000000003', 'l0000000-0000-0000-0000-000000000003', 'm0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 45, true)
on conflict do nothing;

insert into public.product_sizes (product_id, size_id)
select 'p0000000-0000-0000-0000-000000000001', id from public.size_chart_sizes
where chart_id = '11111111-1111-1111-1111-111111111111'
on conflict do nothing;

-- Subset jacket: 38-46 only
insert into public.product_sizes (product_id, size_id)
select 'p0000000-0000-0000-0000-000000000002', id from public.size_chart_sizes
where chart_id = '11111111-1111-1111-1111-111111111111'
  and code in ('38', '40', '42', '44', '46')
on conflict do nothing;

insert into public.product_drops (product_id, drop_id)
select 'p0000000-0000-0000-0000-000000000001', id from public.size_chart_drops
where chart_id = '11111111-1111-1111-1111-111111111111'
on conflict do nothing;

insert into public.product_drops (product_id, drop_id)
select 'p0000000-0000-0000-0000-000000000002', id from public.size_chart_drops
where chart_id = '11111111-1111-1111-1111-111111111111'
on conflict do nothing;

insert into public.product_sizes (product_id, size_id)
select 'p0000000-0000-0000-0000-000000000003', id from public.size_chart_sizes
where chart_id = '22222222-2222-2222-2222-222222222222'
on conflict do nothing;

insert into public.product_drops (product_id, drop_id)
select 'p0000000-0000-0000-0000-000000000003', id from public.size_chart_drops
where chart_id = '22222222-2222-2222-2222-222222222222'
on conflict do nothing;

select public.sync_product_inventory('p0000000-0000-0000-0000-000000000001');
select public.sync_product_inventory('p0000000-0000-0000-0000-000000000002');
select public.sync_product_inventory('p0000000-0000-0000-0000-000000000003');

update public.inventory set qty_on_hand = 8, reorder_point = 2
where product_id = 'p0000000-0000-0000-0000-000000000001'
  and size_id = '11111111-0000-0000-0000-000000000040'
  and drop_id = '11111111-dddd-0000-0000-000000000002';

update public.inventory set qty_on_hand = 12, reorder_point = 2
where product_id = 'p0000000-0000-0000-0000-000000000001'
  and size_id = '11111111-0000-0000-0000-000000000042'
  and drop_id = '11111111-dddd-0000-0000-000000000002';

update public.inventory set qty_on_hand = 6
where product_id = 'p0000000-0000-0000-0000-000000000001'
  and size_id = '11111111-0000-0000-0000-000000000048'
  and drop_id = '11111111-dddd-0000-0000-000000000002';

insert into public.product_price_upcharges (product_id, size_id, drop_id, upcharge_amount)
select 'p0000000-0000-0000-0000-000000000001', s.id, d.id, 10
from public.size_chart_sizes s
cross join public.size_chart_drops d
where s.chart_id = '11111111-1111-1111-1111-111111111111'
  and d.chart_id = '11111111-1111-1111-1111-111111111111'
  and s.code in ('48', '50')
on conflict do nothing;

insert into public.vendors (id, name, notes) values
  ('v0000000-0000-0000-0000-000000000001', 'Milano mills', 'Jacket mill')
on conflict do nothing;

insert into public.cutting_orders (id, vendor_id, brand_id, arrival_date, date_submitted, reference, status, notes) values
  ('c0000000-0000-0000-0000-000000000001', 'v0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', current_date + 14, current_date - (3 + floor(random() * 18))::int, 'CO-1001', true, 'Spring fill-in')
on conflict do nothing;

insert into public.cutting_order_lots (cutting_order_id, lot_id) values
  ('c0000000-0000-0000-0000-000000000001', 'l0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'l0000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into public.cutting_order_products (cutting_order_id, product_id, status) values
  ('c0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001', true),
  ('c0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000002', false)
on conflict do nothing;

insert into public.size_drop_scales (id, name, brand_id, item_id, size_chart_id, last_updated) values
  ('sc000000-0000-0000-0000-000000000001', 'Jacket fill-in', 'b0000000-0000-0000-0000-000000000001', 'i0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2025-03-18'),
  ('sc000000-0000-0000-0000-000000000002', 'Jacket close-out', 'b0000000-0000-0000-0000-000000000001', 'i0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-01-09')
on conflict do nothing;

insert into public.size_drop_scale_cells (scale_id, size_id, drop_id, percent) values
  ('sc000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000040', '11111111-dddd-0000-0000-000000000002', 40),
  ('sc000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000042', '11111111-dddd-0000-0000-000000000002', 60),
  ('sc000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000038', '11111111-dddd-0000-0000-000000000002', 25),
  ('sc000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000040', '11111111-dddd-0000-0000-000000000002', 50),
  ('sc000000-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000042', '11111111-dddd-0000-0000-000000000002', 25)
on conflict do nothing;

insert into public.customers (
  id, company_name, business_name, account_number, contact, email, phone, cell_phone,
  payment_term_id, do_not_ship, notes, is_active
) values
  (
    '60000000-0000-0000-0000-000000000001',
    'Metro menswear', 'Metro menswear llc', 'SAGE-4410',
    'Alan Reed', 'orders@metro.example', '212-555-0140', '917-555-0141',
    (select id from public.payment_terms where term = 'Net 30'),
    false, 'Ships from the Newark warehouse.', true
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    'Coast formal', 'Coast formal ltd', 'SAGE-2288',
    'Mina Cho', 'buying@coast.example', '310-555-0172', null,
    (select id from public.payment_terms where term = 'Net 60'),
    false, null, true
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    'Harbor clothiers', 'Harbor clothiers inc', 'SAGE-1104',
    'Owen Blake', 'owen@harbor.example', '617-555-0190', '617-555-0191',
    (select id from public.payment_terms where term = 'COD'),
    true, 'Hold every shipment.', true
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    'Northline attire', 'Northline atelier', 'SAGE-7731',
    'Priya Shah', 'priya@northline.example', null, '206-555-0166',
    (select id from public.payment_terms where term = 'Prepaid'),
    false, null, true
  ),
  (
    '60000000-0000-0000-0000-000000000005',
    'Pike and company', 'Pike and company', 'SAGE-9055',
    'Luis Ortega', 'ap@pike.example', '312-555-0133', null,
    (select id from public.payment_terms where term = 'Net 30'),
    false, 'Bill only. No ship-to on file.', true
  ),
  (
    '60000000-0000-0000-0000-000000000006',
    'Atlas tailors', 'Atlas tailors', 'SAGE-3340',
    'Helen Park', 'studio@atlas.example', '415-555-0188', '415-555-0189',
    null, false, null, false
  )
on conflict (id) do update set
  company_name = excluded.company_name,
  business_name = excluded.business_name,
  account_number = excluded.account_number,
  contact = excluded.contact,
  email = excluded.email,
  phone = excluded.phone,
  cell_phone = excluded.cell_phone,
  payment_term_id = excluded.payment_term_id,
  do_not_ship = excluded.do_not_ship,
  notes = excluded.notes,
  is_active = excluded.is_active;

insert into public.customer_addresses (
  id, customer_id, address_type, location_name, address_line1, address_line2, city, region, postal_code, country
) values
  ('a0000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'shipping', 'Warehouse', '12 Dock St', null, 'Newark', 'NJ', '07102', 'US'),
  ('a0000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'billing', 'Accounts', '12 Dock St', 'Suite 4', 'Newark', 'NJ', '07102', 'US'),
  ('a0000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', 'both', 'Store', '88 Broadway', null, 'New York', 'NY', '10006', 'US'),
  ('a0000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000002', 'shipping', 'Showroom', '400 Ocean Ave', null, 'Santa Monica', 'CA', '90401', 'US'),
  ('a0000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000002', 'billing', 'Office', '400 Ocean Ave', 'Floor 2', 'Santa Monica', 'CA', '90401', 'US'),
  ('a0000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000003', 'both', 'Main', '18 Harbor St', null, 'Boston', 'MA', '02110', 'US'),
  ('a0000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000004', 'shipping', 'Dock', '90 Pier Ave', null, 'Seattle', 'WA', '98104', 'US'),
  ('a0000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000005', 'billing', 'Accounts payable', '1 Wacker Dr', null, 'Chicago', 'IL', '60606', 'US'),
  ('a0000000-0000-0000-0000-000000000009', '60000000-0000-0000-0000-000000000006', 'shipping', 'Workroom', '55 Geary St', null, 'San Francisco', 'CA', '94108', 'US'),
  ('a0000000-0000-0000-0000-00000000000a', '60000000-0000-0000-0000-000000000006', 'both', 'Shop', '55 Geary St', null, 'San Francisco', 'CA', '94108', 'US')
on conflict (id) do update set
  customer_id = excluded.customer_id,
  address_type = excluded.address_type,
  location_name = excluded.location_name,
  address_line1 = excluded.address_line1,
  address_line2 = excluded.address_line2,
  city = excluded.city,
  region = excluded.region,
  postal_code = excluded.postal_code,
  country = excluded.country;

insert into public.customer_shipments (id, customer_id, customer_address_id, shipping_date, status) values
  ('s0000000-0000-0000-0000-000000000001', 'u0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', current_date, 'open')
on conflict do nothing;

insert into public.customer_shipment_products (id, customer_shipment_id, product_id) values
  ('sp000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'p0000000-0000-0000-0000-000000000001')
on conflict do nothing;

insert into public.customer_shipment_cells (customer_shipment_product_id, size_id, drop_id, qty) values
  ('sp000000-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000040', '11111111-dddd-0000-0000-000000000002', 2)
on conflict do nothing;
