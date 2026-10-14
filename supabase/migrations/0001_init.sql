-- Gruppo Bravo inventory schema, RLS, and helper RPCs.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Company
-- ---------------------------------------------------------------------------

create table public.company_profile (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  legal_name text not null default 'Gruppo Bravo',
  trade_name text not null default 'Gruppo Bravo',
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text,
  tax_id text,
  notes text,
  constraint company_profile_singleton check (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

create table public.company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_profile_id uuid not null references public.company_profile(id) on delete cascade,
  kind text not null check (kind in ('email', 'phone', 'fax', 'website')),
  label text,
  value text not null,
  sort_order int not null default 0,
  is_primary boolean not null default false
);

create unique index company_contacts_one_primary
  on public.company_contacts (company_profile_id, kind)
  where is_primary;

-- ---------------------------------------------------------------------------
-- Auth profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'warehouse', 'sales_rep', 'customer')),
  display_name text not null default ''
);

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'admin', false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('admin', 'warehouse', 'sales_rep'), false);
$$;

create or replace function public.is_warehouse()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('admin', 'warehouse'), false);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

create table public.size_charts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.size_chart_sizes (
  id uuid primary key default gen_random_uuid(),
  chart_id uuid not null references public.size_charts(id) on delete cascade,
  code text not null,
  sort_order int not null,
  unique (chart_id, code),
  unique (chart_id, sort_order)
);

create table public.size_chart_drops (
  id uuid primary key default gen_random_uuid(),
  chart_id uuid not null references public.size_charts(id) on delete cascade,
  code text not null,
  sort_order int not null,
  unique (chart_id, code),
  unique (chart_id, sort_order)
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table public.colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  default_size_chart_id uuid references public.size_charts(id),
  is_active boolean not null default true
);

create table public.models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  item_id uuid not null references public.items(id),
  size_chart_id uuid not null references public.size_charts(id),
  is_active boolean not null default true,
  unique (item_id, name)
);

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  lot_no text not null,
  article text,
  color_num text,
  brand_id uuid references public.brands(id),
  color_id uuid references public.colors(id),
  pattern_id uuid references public.patterns(id),
  content_id uuid references public.contents(id),
  is_active boolean not null default true,
  unique (brand_id, lot_no)
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  start_season smallint not null check (start_season in (1, 2, 3, 4)),
  is_combo boolean not null default false,
  season text generated always as (
    case
      when is_combo and start_season = 1 then 'Spring/Summer ' || year::text
      when is_combo and start_season = 3 then 'Fall/Winter ' || year::text
      when start_season = 1 then 'Spring ' || year::text
      when start_season = 2 then 'Summer ' || year::text
      when start_season = 3 then 'Fall ' || year::text
      when start_season = 4 then 'Winter ' || year::text
      else null
    end
  ) stored,
  check (not is_combo or start_season in (1, 3)),
  unique (year, start_season, is_combo),
  unique (season)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  type smallint not null default 1 check (type in (1, 2, 3)),
  name text,
  lot_id uuid references public.lots(id) on delete restrict,
  model_id uuid references public.models(id) on delete restrict,
  size_chart_id uuid references public.size_charts(id) on delete restrict,
  standard_price numeric(12,2) not null default 0,
  price_stage smallint not null default 1 check (price_stage in (1, 2, 3)),
  availability text,
  published boolean not null default true,
  is_active boolean not null default true,
  unique (lot_id, model_id),
  check (
    (type = 1 and lot_id is not null and model_id is not null and size_chart_id is not null)
    or (type in (2, 3) and name is not null and length(btrim(name)) > 0)
  )
);

create unique index products_one_freight on public.products (type) where type = 3;

create or replace function public.compute_merchandise_product_name(p_lot_id uuid, p_model_id uuid)
returns text
language sql
stable
as $$
  select case
    when upper(btrim(coalesce(l.article, ''))) = upper(btrim(m.name)) then l.lot_no
    else l.lot_no || '>' || m.name
  end
  from public.lots l
  join public.models m on m.id = p_model_id
  where l.id = p_lot_id
$$;

create or replace function public.products_assign_merchandise_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 1 then
    new.name := public.compute_merchandise_product_name(new.lot_id, new.model_id);
  else
    new.name := nullif(btrim(coalesce(new.name, '')), '');
  end if;
  return new;
end;
$$;

drop trigger if exists products_assign_merchandise_name on public.products;
create trigger products_assign_merchandise_name
  before insert or update of type, lot_id, model_id, name
  on public.products
  for each row execute function public.products_assign_merchandise_name();

create or replace function public.products_refresh_names_from_lot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set lot_id = lot_id
  where type = 1 and lot_id = new.id;
  return new;
end;
$$;

drop trigger if exists lots_refresh_product_names on public.lots;
create trigger lots_refresh_product_names
  after update of lot_no, article
  on public.lots
  for each row execute function public.products_refresh_names_from_lot();

create or replace function public.products_refresh_names_from_model()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set model_id = model_id
  where type = 1 and model_id = new.id;
  return new;
end;
$$;

drop trigger if exists models_refresh_product_names on public.models;
create trigger models_refresh_product_names
  after update of name
  on public.models
  for each row execute function public.products_refresh_names_from_model();

alter table public.products alter column name set not null;
create unique index if not exists products_name_key on public.products (name);

create table public.product_sizes (
  product_id uuid not null references public.products(id) on delete cascade,
  size_id uuid not null references public.size_chart_sizes(id),
  primary key (product_id, size_id)
);

create table public.product_drops (
  product_id uuid not null references public.products(id) on delete cascade,
  drop_id uuid not null references public.size_chart_drops(id),
  primary key (product_id, drop_id)
);

create table public.product_price_upcharges (
  product_id uuid not null references public.products(id) on delete cascade,
  size_id uuid not null references public.size_chart_sizes(id),
  drop_id uuid not null references public.size_chart_drops(id),
  upcharge_amount numeric(12,2) not null check (upcharge_amount >= 0),
  primary key (product_id, size_id, drop_id)
);

create table public.inventory (
  product_id uuid not null references public.products(id) on delete cascade,
  size_id uuid not null references public.size_chart_sizes(id),
  drop_id uuid not null references public.size_chart_drops(id),
  qty_on_hand int not null default 0,
  reorder_point int not null default 0,
  primary key (product_id, size_id, drop_id)
);

create or replace function public.sync_product_inventory(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventory (product_id, size_id, drop_id, qty_on_hand, reorder_point)
  select p_product_id, ps.size_id, pd.drop_id, 0, 0
  from public.product_sizes ps
  cross join public.product_drops pd
  where ps.product_id = p_product_id
    and pd.product_id = p_product_id
  on conflict do nothing;

  delete from public.inventory i
  where i.product_id = p_product_id
    and (
      not exists (select 1 from public.product_sizes s where s.product_id = i.product_id and s.size_id = i.size_id)
      or not exists (select 1 from public.product_drops d where d.product_id = i.product_id and d.drop_id = i.drop_id)
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  account_number text,
  user_id uuid references public.profiles(id),
  sales_rep_id uuid references public.profiles(id),
  is_active boolean not null default true
);

create unique index customers_sage_account_unique
  on public.customers (account_number)
  where account_number is not null;

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  address_type text not null check (address_type in ('shipping', 'billing', 'both')),
  label text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text
);

create table public.import_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  target text not null check (target in ('customers', 'customer_addresses')),
  mappings jsonb not null default '[]'::jsonb
);

-- ---------------------------------------------------------------------------
-- Vendors / cutting
-- ---------------------------------------------------------------------------

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  is_active boolean not null default true
);

create table public.cutting_orders (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id),
  arrival_date date not null,
  reference text,
  status text not null default 'open' check (status in ('open', 'received', 'cancelled')),
  notes text
);

create table public.cutting_order_products (
  cutting_order_id uuid not null references public.cutting_orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  status text not null default 'open' check (status in ('open', 'complete')),
  primary key (cutting_order_id, product_id)
);

create table public.cutting_shipments (
  id uuid primary key default gen_random_uuid(),
  cutting_order_id uuid not null references public.cutting_orders(id) on delete cascade,
  received_at timestamptz not null default now(),
  received_by uuid references public.profiles(id),
  posted_at timestamptz
);

create table public.cutting_shipment_products (
  id uuid primary key default gen_random_uuid(),
  cutting_shipment_id uuid not null references public.cutting_shipments(id) on delete cascade,
  product_id uuid not null references public.products(id)
);

create table public.cutting_shipment_cells (
  cutting_shipment_product_id uuid not null references public.cutting_shipment_products(id) on delete cascade,
  size_id uuid not null references public.size_chart_sizes(id),
  drop_id uuid not null references public.size_chart_drops(id),
  qty int not null check (qty >= 0),
  primary key (cutting_shipment_product_id, size_id, drop_id)
);

-- ---------------------------------------------------------------------------
-- Customer shipments
-- ---------------------------------------------------------------------------

create table public.customer_shipments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  customer_address_id uuid references public.customer_addresses(id),
  shipping_date date not null,
  status text not null default 'open' check (status in ('open', 'shipped', 'cancelled')),
  created_by uuid references public.profiles(id),
  posted_at timestamptz
);

create table public.customer_shipment_products (
  id uuid primary key default gen_random_uuid(),
  customer_shipment_id uuid not null references public.customer_shipments(id) on delete cascade,
  product_id uuid not null references public.products(id),
  qty int not null default 0
);

create table public.customer_shipment_cells (
  customer_shipment_product_id uuid not null references public.customer_shipment_products(id) on delete cascade,
  size_id uuid not null references public.size_chart_sizes(id),
  drop_id uuid not null references public.size_chart_drops(id),
  qty int not null check (qty >= 0),
  primary key (customer_shipment_product_id, size_id, drop_id)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('receive', 'ship', 'adjust')),
  qty int not null,
  product_id uuid not null references public.products(id),
  size_id uuid not null references public.size_chart_sizes(id),
  drop_id uuid not null references public.size_chart_drops(id),
  customer_id uuid references public.customers(id),
  cutting_shipment_id uuid references public.cutting_shipments(id),
  customer_shipment_id uuid references public.customer_shipments(id),
  user_id uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Posting RPCs
-- ---------------------------------------------------------------------------

create or replace function public.post_cutting_shipment(p_shipment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  if not public.is_warehouse() then
    raise exception 'not allowed';
  end if;
  if exists (select 1 from public.cutting_shipments where id = p_shipment_id and posted_at is not null) then
    raise exception 'already posted';
  end if;

  for rec in
    select sp.product_id, c.size_id, c.drop_id, c.qty
    from public.cutting_shipment_products sp
    join public.cutting_shipment_cells c on c.cutting_shipment_product_id = sp.id
    where sp.cutting_shipment_id = p_shipment_id and c.qty <> 0
  loop
    insert into public.inventory (product_id, size_id, drop_id, qty_on_hand, reorder_point)
    values (rec.product_id, rec.size_id, rec.drop_id, rec.qty, 0)
    on conflict (product_id, size_id, drop_id)
    do update set qty_on_hand = public.inventory.qty_on_hand + excluded.qty_on_hand;

    insert into public.stock_movements (
      type, qty, product_id, size_id, drop_id, cutting_shipment_id, user_id
    ) values (
      'receive', rec.qty, rec.product_id, rec.size_id, rec.drop_id, p_shipment_id, auth.uid()
    );
  end loop;

  update public.cutting_shipments
  set posted_at = now(), received_by = auth.uid()
  where id = p_shipment_id;
end;
$$;

create or replace function public.post_customer_shipment(p_shipment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  on_hand int;
begin
  if not (public.is_warehouse() or public.current_role() = 'sales_rep') then
    raise exception 'not allowed';
  end if;
  if exists (select 1 from public.customer_shipments where id = p_shipment_id and status <> 'open') then
    raise exception 'shipment is not open';
  end if;

  for rec in
    select sp.product_id, c.size_id, c.drop_id, c.qty
    from public.customer_shipment_products sp
    join public.customer_shipment_cells c on c.customer_shipment_product_id = sp.id
    where sp.customer_shipment_id = p_shipment_id and c.qty <> 0
  loop
    select qty_on_hand into on_hand
    from public.inventory
    where product_id = rec.product_id and size_id = rec.size_id and drop_id = rec.drop_id;

    if coalesce(on_hand, 0) < rec.qty then
      raise exception 'insufficient stock';
    end if;

    update public.inventory
    set qty_on_hand = qty_on_hand - rec.qty
    where product_id = rec.product_id and size_id = rec.size_id and drop_id = rec.drop_id;

    insert into public.stock_movements (
      type, qty, product_id, size_id, drop_id, customer_shipment_id, user_id
    ) values (
      'ship', rec.qty, rec.product_id, rec.size_id, rec.drop_id, p_shipment_id, auth.uid()
    );
  end loop;

  update public.customer_shipments
  set status = 'shipped', posted_at = now()
  where id = p_shipment_id;
end;
$$;

create or replace function public.adjust_inventory(
  p_product_id uuid,
  p_size_id uuid,
  p_drop_id uuid,
  p_qty int,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_warehouse() then
    raise exception 'not allowed';
  end if;
  update public.inventory
  set qty_on_hand = qty_on_hand + p_qty
  where product_id = p_product_id and size_id = p_size_id and drop_id = p_drop_id;
  if not found then
    insert into public.inventory (product_id, size_id, drop_id, qty_on_hand)
    values (p_product_id, p_size_id, p_drop_id, p_qty);
  end if;
  insert into public.stock_movements (type, qty, product_id, size_id, drop_id, user_id, notes)
  values ('adjust', p_qty, p_product_id, p_size_id, p_drop_id, auth.uid(), p_notes);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.company_profile enable row level security;
alter table public.company_contacts enable row level security;
alter table public.profiles enable row level security;
alter table public.size_charts enable row level security;
alter table public.size_chart_sizes enable row level security;
alter table public.size_chart_drops enable row level security;
alter table public.brands enable row level security;
alter table public.colors enable row level security;
alter table public.patterns enable row level security;
alter table public.contents enable row level security;
alter table public.items enable row level security;
alter table public.models enable row level security;
alter table public.lots enable row level security;
alter table public.seasons enable row level security;
alter table public.products enable row level security;
alter table public.product_sizes enable row level security;
alter table public.product_drops enable row level security;
alter table public.product_price_upcharges enable row level security;
alter table public.inventory enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.import_templates enable row level security;
alter table public.vendors enable row level security;
alter table public.cutting_orders enable row level security;
alter table public.cutting_order_products enable row level security;
alter table public.cutting_shipments enable row level security;
alter table public.cutting_shipment_products enable row level security;
alter table public.cutting_shipment_cells enable row level security;
alter table public.customer_shipments enable row level security;
alter table public.customer_shipment_products enable row level security;
alter table public.customer_shipment_cells enable row level security;
alter table public.stock_movements enable row level security;

create policy company_select on public.company_profile for select to authenticated using (true);
create policy company_update on public.company_profile for update to authenticated using (public.is_admin());
create policy company_insert on public.company_profile for insert to authenticated with check (public.is_admin());

create policy contacts_select on public.company_contacts for select to authenticated using (true);
create policy contacts_admin on public.company_contacts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_self on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy profiles_admin on public.profiles for update to authenticated using (public.is_admin());

create policy staff_read_charts on public.size_charts for select to authenticated using (public.is_staff() or true);
create policy staff_write_charts on public.size_charts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy staff_read_sizes on public.size_chart_sizes for select to authenticated using (true);
create policy admin_write_sizes on public.size_chart_sizes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy staff_read_drops on public.size_chart_drops for select to authenticated using (true);
create policy admin_write_drops on public.size_chart_drops for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy read_brands on public.brands for select to authenticated using (true);
create policy write_brands on public.brands for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy read_colors on public.colors for select to authenticated using (true);
create policy write_colors on public.colors for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy read_patterns on public.patterns for select to authenticated using (true);
create policy write_patterns on public.patterns for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy read_contents on public.contents for select to authenticated using (true);
create policy write_contents on public.contents for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy read_items on public.items for select to authenticated using (true);
create policy write_items on public.items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy read_models on public.models for select to authenticated using (true);
create policy write_models on public.models for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy read_lots on public.lots for select to authenticated using (true);
create policy write_lots on public.lots for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy read_seasons on public.seasons for select to authenticated using (true);
create policy write_seasons on public.seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy read_products on public.products for select to authenticated
  using (public.is_staff() or published = true);
create policy write_products on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy read_product_sizes on public.product_sizes for select to authenticated using (true);
create policy write_product_sizes on public.product_sizes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy read_product_drops on public.product_drops for select to authenticated using (true);
create policy write_product_drops on public.product_drops for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy read_upcharges on public.product_price_upcharges for select to authenticated using (true);
create policy write_upcharges on public.product_price_upcharges for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy read_inventory on public.inventory for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.products p where p.id = inventory.product_id and p.published)
  );
create policy write_inventory on public.inventory for all to authenticated using (public.is_warehouse()) with check (public.is_warehouse());

create policy read_customers on public.customers for select to authenticated
  using (
    public.is_admin() or public.is_warehouse()
    or (public.current_role() = 'sales_rep' and sales_rep_id = auth.uid())
    or user_id = auth.uid()
  );
create policy write_customers on public.customers for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy read_c_addr on public.customer_addresses for select to authenticated
  using (exists (
    select 1 from public.customers c
    where c.id = customer_id
      and (
        public.is_admin() or public.is_warehouse()
        or (public.current_role() = 'sales_rep' and c.sales_rep_id = auth.uid())
        or c.user_id = auth.uid()
      )
  ));
create policy write_c_addr on public.customer_addresses for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy import_admin on public.import_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy import_admin_select on public.import_templates for select to authenticated using (public.is_admin());

create policy vendors_staff on public.vendors for select to authenticated using (public.is_staff());
create policy vendors_write on public.vendors for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy cutting_read on public.cutting_orders for select to authenticated using (public.is_warehouse() or public.is_admin());
create policy cutting_write on public.cutting_orders for all to authenticated using (public.is_admin() or public.is_warehouse()) with check (public.is_admin() or public.is_warehouse());
create policy cop_all on public.cutting_order_products for all to authenticated using (public.is_admin() or public.is_warehouse()) with check (public.is_admin() or public.is_warehouse());
create policy cs_all on public.cutting_shipments for all to authenticated using (public.is_warehouse()) with check (public.is_warehouse());
create policy csp_all on public.cutting_shipment_products for all to authenticated using (public.is_warehouse()) with check (public.is_warehouse());
create policy csc_all on public.cutting_shipment_cells for all to authenticated using (public.is_warehouse()) with check (public.is_warehouse());

create policy cust_ship_select on public.customer_shipments for select to authenticated
  using (
    public.is_admin() or public.is_warehouse()
    or (
      public.current_role() = 'sales_rep'
      and exists (select 1 from public.customers c where c.id = customer_id and c.sales_rep_id = auth.uid())
    )
  );
create policy cust_ship_insert on public.customer_shipments for insert to authenticated
  with check (
    public.is_admin() or public.is_warehouse()
    or (
      public.current_role() = 'sales_rep'
      and exists (select 1 from public.customers c where c.id = customer_id and c.sales_rep_id = auth.uid())
    )
  );
create policy cust_ship_update on public.customer_shipments for update to authenticated
  using (
    status = 'open' and (
      public.is_admin() or public.is_warehouse()
      or (
        public.current_role() = 'sales_rep'
        and exists (select 1 from public.customers c where c.id = customer_id and c.sales_rep_id = auth.uid())
      )
    )
  );

create policy cshp_all on public.customer_shipment_products for all to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy cshc_all on public.customer_shipment_cells for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy movements_staff on public.stock_movements for select to authenticated using (public.is_staff());
create policy movements_insert on public.stock_movements for insert to authenticated with check (public.is_staff());

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
