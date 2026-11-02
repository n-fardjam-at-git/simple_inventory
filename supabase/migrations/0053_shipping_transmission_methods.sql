-- Customer shipping services and how an order was received.
-- UPS names: ups.com domestic services and the 2026 Rate & Service Guide.
-- FedEx names: fedex.com shipping pages and the January 5, 2026 Service Guide.

create table public.shipment_methods (
  id uuid primary key default gen_random_uuid(),
  shipper text,
  method text not null,
  is_active boolean not null default true,
  sort_order integer not null
);

create unique index shipment_methods_pair_key
  on public.shipment_methods (coalesce(shipper, ''), method);

insert into public.shipment_methods (shipper, method, sort_order) values
  (null, 'Pickup', 10),
  ('FedEx', 'Ground', 20),
  ('FedEx', 'Home Delivery', 21),
  ('FedEx', 'Express Saver', 30),
  ('FedEx', '2Day', 40),
  ('FedEx', '2Day A.M.', 41),
  ('FedEx', 'Standard Overnight', 50),
  ('FedEx', 'Priority Overnight', 51),
  ('FedEx', 'First Overnight', 52),
  ('UPS', 'Ground', 60),
  ('UPS', '3 Day Select', 70),
  ('UPS', '2nd Day Air', 80),
  ('UPS', '2nd Day Air A.M.', 81),
  ('UPS', 'Next Day Air Saver', 90),
  ('UPS', 'Next Day Air', 91),
  ('UPS', 'Next Day Air Early', 92);

create table public.transmission_methods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null
);

insert into public.transmission_methods (name, sort_order) values
  ('Customer by phone', 10),
  ('Customer by email', 20),
  ('Convention order', 30),
  ('Online by customer', 40),
  ('Online by sales rep', 50),
  ('Customer by fax', 60),
  ('Sales rep by fax', 70);

alter table public.customer_orders
  add column shipment_method_id uuid references public.shipment_methods(id),
  add column transmission_method_id uuid references public.transmission_methods(id);

alter table public.shipment_methods enable row level security;
alter table public.transmission_methods enable row level security;

create policy shipment_methods_read on public.shipment_methods
  for select to authenticated
  using (public.is_staff());

create policy shipment_methods_write on public.shipment_methods
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy transmission_methods_read on public.transmission_methods
  for select to authenticated
  using (public.is_staff());

create policy transmission_methods_write on public.transmission_methods
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.shipment_methods to authenticated;
grant select, insert, update, delete on public.transmission_methods to authenticated;
