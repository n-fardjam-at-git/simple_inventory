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
